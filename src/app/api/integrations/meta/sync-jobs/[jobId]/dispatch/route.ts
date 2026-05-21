import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getAccountSyncJobById } from '@/lib/server/repositories/ad_accounts/syncState';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { ErrorCode, fail, ok } from '@/lib/shared';

/**
 * Acknowledges a queued first-sync job without starting long-running work in the Vercel request.
 *
 * The durable source of truth is the queued job row in Postgres. The external sync worker/cron
 * claims queued `account_sync_jobs`; this route intentionally does not run sync work after returning.
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
