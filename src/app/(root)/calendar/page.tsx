import CalendarClient from './CalendarClient';
import { EmptyCampaignState } from '@/components/campaigns/EmptyStates';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  buildBusinessIntelligenceWorkspace,
  getMetaAccountIntelligenceReadModel,
} from '@/lib/server/intelligence';
import { listCalendarQueueTemplates } from '@/lib/server/intelligence/repositories/calendarQueueTemplates';
import type { BusinessIntelligencePlanningScope } from '@/lib/server/intelligence';
import { getCampaignSummaries } from '@/lib/server/repositories/campaigns/getCampaignSummaries';
import { isLikelyActiveStatus } from '@/lib/server/dashboard/buildPayload';

function parseScope(value: string | string[] | undefined): BusinessIntelligencePlanningScope | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    if (
        raw === 'business' ||
        raw === 'integration' ||
        raw === 'selected_integrations'
    ) {
        return raw;
    }

    return undefined;
}

function parseIdList(value: string | string[] | undefined): string[] {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) {
        return [];
    }

    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export default async function CalendarPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { businessId, user } = await getRequiredAppContext();
    const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);
    const params = await searchParams;

    const workspace = await buildBusinessIntelligenceWorkspace(
      businessId,
      {
        scope: parseScope(params.scope),
        platformIntegrationId:
          typeof params.platform_integration_id === 'string'
            ? params.platform_integration_id
            : null,
        platformIntegrationIds: parseIdList(params.platform_integration_ids),
        defaultPlatformIntegrationId: selectedPlatformId,
        defaultAdAccountId: selectedAdAccountId,
      }
    );
    const adminSupabase = createAdminClient();
    const intelligence =
      workspace.selectedAdAccountId
        ? await getMetaAccountIntelligenceReadModel(adminSupabase, {
            businessId,
            adAccountId: workspace.selectedAdAccountId,
            userId: user.id,
          })
        : { signals: [], queueItems: [] };
    const queueTemplates =
      workspace.selectedAdAccountId
        ? await listCalendarQueueTemplates(adminSupabase, {
            businessId,
            adAccountId: workspace.selectedAdAccountId,
            userId: user.id,
          })
        : [];
    const campaignReviewOptions =
      workspace.selectedAdAccountId
        ? (
            await getCampaignSummaries({
              adAccountIds: [workspace.selectedAdAccountId],
              windowDays: 30,
              includeEmpty: false,
              sort: 'spend',
              limit: 200,
              supabase: adminSupabase as any,
            })
          )
            .filter(
              (campaign) =>
                campaign.spend > 0 ||
                campaign.impressions > 0 ||
                campaign.conversion > 0 ||
                isLikelyActiveStatus(campaign.status)
            )
            .map((campaign) => ({
              campaignExternalId: campaign.campaignId,
              campaignInternalId: campaign.campaignInternalId,
              campaignName: campaign.campaignName,
              status: campaign.status,
              spend: campaign.spend,
              results: campaign.conversion,
            }))
        : [];

    if (workspace.platforms.length === 0) {
        return <EmptyCampaignState type="platform" />;
    }

    if (workspace.adAccounts.length === 0) {
        return (
            <EmptyCampaignState
                type="adAccount"
                platformName={workspace.platforms[0]?.label || 'connected'}
            />
        );
    }

    return (
      <CalendarClient
        workspace={workspace}
        initialQueueItems={intelligence.queueItems}
        initialQueueTemplates={queueTemplates}
        campaignReviewOptions={campaignReviewOptions}
        initialNowIso={new Date().toISOString()}
      />
    );
}
