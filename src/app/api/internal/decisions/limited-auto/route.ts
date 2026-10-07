import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { JevDecisionProvider } from '@/lib/server/decisions/providers/JevDecisionProvider';
import { limitedAutoEnabled, runLimitedAuto } from '@/lib/server/advertising/limitedAuto';

export const maxDuration = 180;
const inputSchema = z.object({businessId:z.string().uuid(),sourceSnapshotId:z.string().uuid()}).strict();

/** Explicit internal worker invocation only; never registered as a default cron. */
export async function POST(request: NextRequest) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key || request.headers.get('authorization') !== `Bearer ${key}`) return NextResponse.json({error:'Unauthorized'},{status:401});
  const input = inputSchema.safeParse(await request.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:'Invalid evaluation request'},{status:400});
  if (!limitedAutoEnabled(input.data.businessId)) return NextResponse.json({outcome:'BLOCK',reason:'AUTO_DISABLED'});
  let provider: JevDecisionProvider;
  try { provider = new JevDecisionProvider(); }
  catch { return NextResponse.json({outcome:'HOLD',reason:'PROVIDER_UNAVAILABLE'}); }
  try {
    const result = await runLimitedAuto(createAdminClient(),{...input.data,provider});
    console.info(JSON.stringify({event:'limited_auto.completed',businessId:input.data.businessId,sourceSnapshotId:input.data.sourceSnapshotId,...result}));
    return NextResponse.json(result);
  } catch {
    console.error(JSON.stringify({event:'limited_auto.failed',businessId:input.data.businessId,sourceSnapshotId:input.data.sourceSnapshotId}));
    // A transport/audit failure may have occurred after a write. Never retry the
    // action here; the durable reservation/claim remains for reconciliation.
    return NextResponse.json({outcome:'BLOCK',reason:'AUTO_PROCESSING_FAILED'},{status:503});
  }
}
