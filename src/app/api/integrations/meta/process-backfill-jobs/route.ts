import { NextRequest, NextResponse } from 'next/server';
import { processMetaBackfillJobs } from '@/lib/server/sync/meta/processBackfillJobs';

function getRequestApiKey(request: NextRequest): string | null {
  const apiKeyHeader = request.headers.get('x-internal-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function assertAuthorized(request: NextRequest): NextResponse | null {
  const expectedApiKey = process.env.INTERNAL_API_KEY;
  if (!expectedApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_API_KEY is not configured',
      },
      { status: 500 }
    );
  }

  const requestApiKey = getRequestApiKey(request);
  if (!requestApiKey || requestApiKey !== expectedApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      { status: 401 }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit =
      typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0
        ? Math.min(Math.floor(body.limit), 5)
        : 1;
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
