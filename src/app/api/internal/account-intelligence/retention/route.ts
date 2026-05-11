import { NextRequest, NextResponse } from 'next/server';
import { runAccountIntelligenceRetentionJob } from '@/lib/server/jobs/accountIntelligenceRetention';

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
    const result = await runAccountIntelligenceRetentionJob();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Account intelligence retention job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to run account intelligence retention',
      },
      { status: 500 }
    );
  }
}
