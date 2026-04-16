import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getAccountSyncJobById } from '@/lib/server/repositories/ad_accounts/syncState';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { processMetaBackfillJobs } from '@/lib/server/sync/meta/processBackfillJobs';
import { ErrorCode, fail, ok } from '@/lib/shared';

/**
 * Best-effort dispatch for a queued first-sync job so the UI can nudge the background worker immediately.
 *
 * The durable source of truth remains the queued job row in Postgres. If this dispatch attempt fails
 * or the runtime stops early, cron can still claim and finish the same job later.
 *
 * @param _request - Next.js request object. Authorization is derived from the current business context.
 * @param context - Dynamic route params containing the queued first-sync job id.
 * @returns A JSON acknowledgement that the job is queued, already running, or no longer dispatchable.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { businessId } = await getRequiredAppContext();
    const { jobId } = await context.params;

    if (!jobId) {
      return NextResponse.json(
        fail('Missing sync job id', ErrorCode.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const job = await getAccountSyncJobById(supabase, jobId);

    if (!job || job.business_id !== businessId || job.sync_type !== 'initial_historical') {
      return NextResponse.json(
        fail('Meta first-sync job not found', ErrorCode.NOT_FOUND),
        { status: 404 }
      );
    }

    if (job.status === 'queued') {
      void processMetaBackfillJobs({
        limit: 1,
        targetJobId: job.id,
      }).catch((error) => {
        console.error('Failed to dispatch Meta first-sync job:', error);
      });
    }

    return NextResponse.json(
      ok({
        acknowledged: true,
        jobId: job.id,
        status: job.status,
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to dispatch Meta first-sync job',
        ErrorCode.UNKNOWN_ERROR
      ),
      { status: 500 }
    );
  }
}
