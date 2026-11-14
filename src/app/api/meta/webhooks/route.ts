import { after, NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
import { processMetaBackfillJobs } from '@/lib/server/sync/meta/processBackfillJobs';
import { ingestMetaWebhook, MAX_WEBHOOK_BYTES, verifyChallenge, verifySignature, webhooksEnabled } from '@/lib/server/webhooks/meta';
import { parseMetaWebhook } from '@/lib/shared/webhooks/meta';
import { asRecord } from '@/lib/shared/utils/format';

export const maxDuration = 300;
const headers = { 'Cache-Control': 'no-store' };
const notFound = () => new NextResponse('Not found', { status: 404, headers });

/** Meta's subscription handshake. */
export async function GET(request: NextRequest) {
  if (!webhooksEnabled()) return notFound();
  const challenge = verifyChallenge(request.nextUrl.searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN);
  return challenge === null ? new NextResponse('Forbidden', { status: 403, headers }) : new NextResponse(challenge, { status: 200, headers: { ...headers, 'Content-Type': 'text/plain' } });
}

/**
 * Demand that arrived while other work held the account's single job slot: start it as soon as
 * that work finishes instead of waiting for the next scheduled worker pass. Bounded to ~40s.
 */
function startWhenFree(adAccountId: string, businessId: string) {
  after(async () => {
    try {
      const db = createAdminClient();
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const promoted = await db.rpc('promote_account_resource', { p_account: adAccountId });
        if (promoted.error) return;
        const row = asRecord(promoted.data);
        if (typeof row.jobId === 'string') {
          await processMetaBackfillJobs({ targetJobId: row.jobId });
          revalidateTag(`dashboard-context:${businessId}`, { expire: 0 });
          return;
        }
        if (row.reason !== 'existing_job') return;
      }
    } catch { console.error('Meta webhook follow-up unavailable'); }
  });
}

/** Verified deliveries only. The body is a trigger: the worker re-reads Meta before anything is shown. */
export async function POST(request: NextRequest) {
  if (!webhooksEnabled()) return notFound();
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_WEBHOOK_BYTES) return new NextResponse('Payload too large', { status: 413, headers });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_WEBHOOK_BYTES) return new NextResponse('Payload too large', { status: 413, headers });
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) return new NextResponse('Invalid signature', { status: 401, headers });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new NextResponse('Invalid payload', { status: 400, headers }); }
  const events = parseMetaWebhook(body);
  // A signed delivery for another object type is acknowledged so Meta does not retry it for 36 hours.
  if (events === null) return NextResponse.json({ received: 0 }, { headers });
  try {
    const result = await ingestMetaWebhook(events);
    for (const job of result.jobs) dispatchAccountSync(job.jobId, job.businessId);
    for (const scope of result.waiting) startWhenFree(scope.adAccountId, scope.businessId);
    return NextResponse.json({ received: result.received, recorded: result.recorded, duplicates: result.duplicates }, { headers });
  } catch {
    // 5xx asks Meta to retry; recorded deliveries are de-duplicated, so a retry is safe.
    console.error('Meta webhook could not be recorded');
    return new NextResponse('Temporarily unavailable', { status: 503, headers });
  }
}
