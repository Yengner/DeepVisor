import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  buildFirstSyncJobStatus,
  getAccountSyncJobById,
  getAdAccountSyncCoverage,
} from '@/lib/server/repositories/ad_accounts/syncState';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { ErrorCode, fail, ok } from '@/lib/shared';

/**
 * Returns the latest persisted progress snapshot for one first-sync job owned by the active business.
 *
 * @param _request - Next.js request object. The route is business-scoped through server auth context.
 * @param context - Dynamic route params containing the account sync job id.
 * @returns A JSON payload describing the current first-sync status for polling clients.
 */
export async function GET(
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

    const syncCoverage = await getAdAccountSyncCoverage(supabase, job.ad_account_id);

    return NextResponse.json(
      ok({
        job: buildFirstSyncJobStatus(job, syncCoverage),
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to load Meta first-sync status',
        ErrorCode.UNKNOWN_ERROR
      ),
      { status: 500 }
    );
  }
}
