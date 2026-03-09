import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { refreshBusinessAdAccounts } from '@/lib/server/integrations/service';
import type {
  RefetchAdAccountsResponse,
  SupportedIntegrationPlatform,
} from '@/lib/shared/types/integrations';

type RefetchAdAccountsRequest = {
  businessId?: string;
  platform?: SupportedIntegrationPlatform;
};

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
      } satisfies RefetchAdAccountsResponse,
      { status: 500 }
    );
  }

  const requestApiKey = getRequestApiKey(request);
  if (!requestApiKey || requestApiKey !== expectedApiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      } satisfies RefetchAdAccountsResponse,
      { status: 401 }
    );
  }

  return null;
}

function normalizePlatform(value: unknown): SupportedIntegrationPlatform {
  return value === 'meta' ? 'meta' : 'meta';
}

export async function POST(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as RefetchAdAccountsRequest;
    const platform = normalizePlatform(body.platform);
    const supabase = createAdminClient();

    let businessIds: string[] = [];

    if (typeof body.businessId === 'string' && body.businessId.trim().length > 0) {
      businessIds = [body.businessId.trim()];
    } else {
      const { data: businesses, error } = await supabase
        .from('business_profiles')
        .select('id');

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch businesses: ${error.message}`,
          } satisfies RefetchAdAccountsResponse,
          { status: 500 }
        );
      }

      businessIds = (businesses ?? []).map((business) => business.id);
    }

    let refreshedIntegrations = 0;
    let failedIntegrations = 0;
    let syncedAdAccounts = 0;

    const results: Array<{
      businessId: string;
      refreshedIntegrations: number;
      failedIntegrations: number;
      syncedAdAccounts: number;
    }> = [];

    for (const businessId of businessIds) {
      const summary = await refreshBusinessAdAccounts(supabase, { businessId, platform });

      refreshedIntegrations += summary.refreshedCount;
      failedIntegrations += summary.failedCount;
      syncedAdAccounts += summary.syncedAccountCount;

      results.push({
        businessId,
        refreshedIntegrations: summary.refreshedCount,
        failedIntegrations: summary.failedCount,
        syncedAdAccounts: summary.syncedAccountCount,
      });
    }

    return NextResponse.json({
      success: true,
      platform,
      businessesProcessed: businessIds.length,
      refreshedIntegrations,
      failedIntegrations,
      syncedAdAccounts,
      results,
    } satisfies RefetchAdAccountsResponse);
  } catch (error) {
    console.error('Refetch ad accounts route failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refetch ad accounts',
      } satisfies RefetchAdAccountsResponse,
      { status: 500 }
    );
  }
}
