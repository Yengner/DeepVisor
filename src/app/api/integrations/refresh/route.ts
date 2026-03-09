import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { validateMetaAccessToken } from '@/lib/server/integrations/adapters/meta';
import {
  extractAccessToken,
  listBusinessIntegrations,
  markIntegrationError,
  markIntegrationHealthy,
  syncMetaAdAccountsSnapshot,
} from '@/lib/server/integrations/service';
import type { RefreshIntegrationsResponse } from '@/lib/shared/types/integrations';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);

    const integrations = await listBusinessIntegrations(supabase, context.businessId);

    let refreshedCount = 0;
    let failedCount = 0;

    for (const integration of integrations) {
      if (!integration.isIntegrated) {
        continue;
      }

      if (integration.platformKey !== 'meta') {
        continue;
      }

      const accessToken = extractAccessToken(integration.integrationDetails, integration.accessToken);
      if (!accessToken) {
        failedCount += 1;
        await markIntegrationError(supabase, integration.id, 'Missing access token');
        continue;
      }

      try {
        await validateMetaAccessToken(accessToken);
        await syncMetaAdAccountsSnapshot(supabase, {
          businessId: context.businessId,
          platformId: integration.platformId,
          accessToken,
        });
        await markIntegrationHealthy(supabase, integration.id);
        refreshedCount += 1;
      } catch (error) {
        failedCount += 1;
        await markIntegrationError(
          supabase,
          integration.id,
          error instanceof Error ? error.message : 'Failed to refresh integration'
        );
      }
    }

    return NextResponse.json({
      success: true,
      refreshedCount,
      failedCount,
    } satisfies RefreshIntegrationsResponse);
  } catch (error) {
    console.error('Refresh integrations failed:', error);
    return NextResponse.json(
      {
        success: false,
        refreshedCount: 0,
        failedCount: 0,
      } satisfies RefreshIntegrationsResponse,
      { status: 500 }
    );
  }
}
