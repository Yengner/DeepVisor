import CalendarClient from './CalendarClient';
import { EmptyCampaignState } from '@/components/campaigns/EmptyStates';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { buildBusinessIntelligenceWorkspace } from '@/lib/server/intelligence';
import type { BusinessIntelligencePlanningScope } from '@/lib/server/intelligence';

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
    const { businessId } = await getRequiredAppContext();
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

    return <CalendarClient workspace={workspace} />;
}
