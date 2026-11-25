import { refuseWithoutInternalApiKey } from '@/lib/server/auth/internalApiKey';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { syncConnectedBusinessPlatforms } from '@/lib/server/sync';
import type {
  RefetchAdAccountsResponse,
  SupportedIntegrationPlatform,
} from '@/lib/shared/types/integrations';

type RefetchAdAccountsRequest = {
  businessId?: string;
  platform?: SupportedIntegrationPlatform;
};

function normalizePlatform(value: unknown): SupportedIntegrationPlatform | undefined {
  return value === 'meta' ? 'meta' : undefined;
}

export async function POST(request: NextRequest) {
  const authError = refuseWithoutInternalApiKey(request);
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
      const summary = await syncConnectedBusinessPlatforms({
        businessId,
        trigger: 'cron',
        platformKey: platform,
      });

      refreshedIntegrations += summary.successCount;
      failedIntegrations += summary.failedCount;
      syncedAdAccounts += summary.syncedAdAccounts;

      results.push({
        businessId,
        refreshedIntegrations: summary.successCount,
        failedIntegrations: summary.failedCount,
        syncedAdAccounts: summary.syncedAdAccounts,
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
