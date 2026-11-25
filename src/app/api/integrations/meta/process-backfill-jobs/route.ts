import { refuseWithoutInternalApiKey } from '@/lib/server/auth/internalApiKey';
import { after, NextRequest, NextResponse } from 'next/server';
import { processMetaBackfillJobs } from '@/lib/server/sync/meta/processBackfillJobs';
import { drainShadowJobs } from '@/lib/server/decisions/shadow/service';
import { processActionOutcomes } from '@/lib/server/decisions/outcomes/service';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authError = refuseWithoutInternalApiKey(request);
  if (authError) {
    return authError;
  }

  // Runs even on idle sync ticks, so durable shadow backlog can drain independently.
  after(drainShadowJobs);
  after(processActionOutcomes);

  try {
    const body = await request.json().catch(() => ({}));
    const limit =
      typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0
        ? Math.min(Math.floor(body.limit), 5)
        : 5;
    const jobId =
      typeof body.jobId === 'string' && body.jobId.trim().length > 0
        ? body.jobId.trim()
        : null;
    const result = await processMetaBackfillJobs({
      limit,
      targetJobId: jobId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Processing Meta backfill jobs failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process Meta backfill jobs',
      },
      { status: 500 }
    );
  }
}
