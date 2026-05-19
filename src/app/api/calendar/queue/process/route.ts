import { NextRequest, NextResponse } from 'next/server';
import { processCalendarQueue } from '@/lib/server/intelligence/calendarQueueProcessor';
import { createAdminClient } from '@/lib/server/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ProcessCalendarQueueBody = {
  limit?: number;
  lookbackDays?: number;
  businessId?: string;
  adAccountId?: string;
  now?: string;
};

function normalizeProcessLimit(value: unknown): number {
  const numericValue =
    typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 1;
  }

  return Math.min(Math.floor(numericValue), 1);
}

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

function parseNow(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseOptionalId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) {
    console.warn('[calendar-queue:process] unauthorized request', {
      hasInternalApiKey: Boolean(request.headers.get('x-internal-api-key')),
      hasAuthorization: Boolean(request.headers.get('authorization')),
    });
    return authError;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ProcessCalendarQueueBody;
    const supabase = createAdminClient();
    const startedAt = Date.now();
    const requestedLimit = body.limit;
    const input = {
      limit: normalizeProcessLimit(body.limit),
      lookbackDays: body.lookbackDays,
      businessId: parseOptionalId(body.businessId),
      adAccountId: parseOptionalId(body.adAccountId),
      now: parseNow(body.now),
    };

    console.info('[calendar-queue:process] start', {
      requestedLimit,
      limit: input.limit,
      lookbackDays: input.lookbackDays,
      businessScoped: Boolean(input.businessId),
      adAccountScoped: Boolean(input.adAccountId),
      hasNowOverride: Boolean(input.now),
    });

    const result = await processCalendarQueue(supabase, {
      ...input,
    });

    console.info('[calendar-queue:process] complete', {
      elapsedMs: Date.now() - startedAt,
      success: result.success,
      materializedCount: result.materializedCount,
      processedCount: result.processedCount,
      notificationCount: result.notificationCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      errorCount: result.errors.length,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 207,
    });
  } catch (error) {
    console.error('Failed to process calendar queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process calendar queue',
      },
      { status: 500 }
    );
  }
}
