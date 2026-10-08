import { after, NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { processMetaBackfillJobs } from '@/lib/server/sync/meta/processBackfillJobs';
import { runManualBusinessSync } from '@/lib/server/sync/manualRefresh';
import { performanceFingerprint } from '@/lib/server/sync/manualRefreshStatus';
import { asRecord } from '@/lib/shared';

export const maxDuration = 300;

function dispatch(jobId: string, businessId: string) {
  after(async () => {
    try {
      await processMetaBackfillJobs({ targetJobId: jobId });
      revalidateTag(`dashboard-context:${businessId}`, { expire: 0 });
      revalidatePath('/dashboard');
    } catch { console.error('Manual Meta refresh worker unavailable', { jobId }); }
  });
}

export async function POST() {
  try {
    const { businessId } = await getRequiredAppContext();
    const selection = await resolveCurrentSelection(businessId);
    if (!selection.selectedPlatformId || !selection.selectedAdAccountId) {
      return NextResponse.json({ success: false, message: 'Select a connected Meta account first.' }, { status: 400 });
    }
    const client = createAdminClient();
    const { data: existing, error } = await client.from('account_sync_jobs').select('id,status')
      .eq('business_id', businessId).eq('platform_integration_id', selection.selectedPlatformId)
      .eq('ad_account_id', selection.selectedAdAccountId).in('status', ['queued', 'running'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (existing) {
      if (existing.status === 'queued') dispatch(existing.id, businessId);
      return NextResponse.json({ success: true, jobId: existing.id, status: existing.status, message: 'An account refresh is already running.' }, { status: 202 });
    }
    const result = await runManualBusinessSync({ businessId, platformKey: 'meta', integrationId: selection.selectedPlatformId, adAccountId: selection.selectedAdAccountId });
    if (!result.allowed) return NextResponse.json({ success: false, message: 'Please wait before refreshing again.', retryAfterMs: result.retryAfterMs, nextAllowedAt: result.nextAllowedAt }, { status: 429, headers: { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } });
    const job = result.jobs[0];
    if (!job || result.failedCount) throw new Error('Manual refresh could not be queued');
    // Durable job + existing atomic worker claim. Polling never starts another sync.
    dispatch(job.jobId, businessId);
    return NextResponse.json({ success: true, jobId: job.jobId, status: job.status, message: 'Refresh in progress.' }, { status: 202 });
  } catch {
    console.error('Manual Meta refresh request failed');
    return NextResponse.json({ success: false, message: 'Could not start the Meta refresh. Please check your connection and try again.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const selection = await resolveCurrentSelection(businessId);
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return NextResponse.json({ success: false }, { status: 400 });
    const client = createAdminClient();
    const { data: job, error } = await client.from('account_sync_jobs').select('*')
      .eq('id', jobId).eq('business_id', businessId)
      .eq('ad_account_id', selection.selectedAdAccountId ?? '')
      .eq('platform_integration_id', selection.selectedPlatformId ?? '').maybeSingle();
    if (error) throw error;
    if (!job) return NextResponse.json({ success: false, message: 'Refresh is unavailable for the selected account.' }, { status: 404 });
    let unchanged: boolean | null = null;
    if (job.status === 'completed') {
      revalidateTag(`dashboard-context:${businessId}`, { expire: 0 });
      const baseline = asRecord(asRecord(job.metadata).last_processed_ids).performanceFingerprint;
      if (typeof baseline === 'string' && job.requested_start_date && job.requested_end_date) {
        try {
          unchanged = baseline === await performanceFingerprint(client, job.ad_account_id, job.requested_start_date, job.requested_end_date);
        } catch { console.warn('Completed refresh comparison unavailable', { jobId: job.id }); }
      }
      revalidatePath('/dashboard');
    }
    return NextResponse.json({ success: true, status: job.status, completedAt: job.finished_at, unchanged,
      message: job.status === 'failed' || job.status === 'partial' ? 'Could not finish the Meta refresh. Some data may have updated; check your connection before trying again.' : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Manual Meta refresh status unavailable');
    return NextResponse.json({ success: false, message: 'Could not confirm refresh status. The job may still be running.' }, { status: 500 });
  }
}
