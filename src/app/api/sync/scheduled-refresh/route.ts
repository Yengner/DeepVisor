import { NextRequest, NextResponse } from 'next/server';
import { enqueueScheduledAccountSyncJobs } from '@/lib/server/sync/scheduledRefresh';

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

function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await enqueueScheduledAccountSyncJobs({
      limit: positiveInteger(body.limit),
      lookbackDays: positiveInteger(body.lookbackDays ?? body.lookback_days),
      staleAfterMinutes: positiveInteger(body.staleAfterMinutes ?? body.stale_after_minutes),
      businessId: optionalString(body.businessId ?? body.business_id),
      adAccountId: optionalString(body.adAccountId ?? body.ad_account_id),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Scheduled sync refresh enqueue failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enqueue scheduled sync refresh',
      },
      { status: 500 }
    );
  }
}
