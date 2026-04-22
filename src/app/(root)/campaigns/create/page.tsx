import CustomCampaignFlow from '@/components/campaigns/create/flows/manual/ManualCampaignFlow';
import ManualMetaAdBuilder from '@/components/campaigns/create/platforms/meta/builders/ManualMetaAdBuilder';
import ManualMetaAdStarter from '@/components/campaigns/create/platforms/meta/components/ManualMetaAdStarter';
import ManualMetaAdSetStarter from '@/components/campaigns/create/platforms/meta/components/ManualMetaAdSetStarter';
import ManualMetaAdSetBuilder from '@/components/campaigns/create/platforms/meta/builders/ManualMetaAdSetBuilder';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getCampaignDraftById, readCampaignDraftPayload } from '@/lib/server/campaigns/drafts';
import { getAdAccountData, getCampaignsWithAdSetsAndAds, getPlatformDetails } from '@/lib/server/data';
import { createServerClient } from '@/lib/server/supabase/server';

export default async function CreateCampaignPage({
    searchParams,
}: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

    const { businessId } = await getRequiredAppContext();
    const params = searchParams ? await searchParams : {};
    const requestedDraftId = typeof params?.draft === 'string' ? params.draft : null;
    const requestedScope = params?.scope;
    const requestedCampaignId = typeof params?.campaign_id === 'string' ? params.campaign_id : null;
    const requestedAdSetId = typeof params?.adset_id === 'string' ? params.adset_id : null;
    const createScope =
        requestedScope === 'adset'
            ? 'adset'
            : requestedScope === 'ad'
                ? 'ad'
                : 'campaign';

    const { selectedPlatformId: platformIntegrationId, selectedAdAccountId: adAccountDBId } = await resolveCurrentSelection(businessId);

    if (!platformIntegrationId || !adAccountDBId) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Please select an ad account first</h2>
                <p>Use the dropdown in the top navigation to select an ad account.</p>
            </div>
        );
    }

    const [platformData, adAccountData, campaignTree] = await Promise.all([
        getPlatformDetails(platformIntegrationId, businessId),
        getAdAccountData(adAccountDBId, platformIntegrationId, businessId),
        createScope === 'campaign' ? Promise.resolve([]) : getCampaignsWithAdSetsAndAds(adAccountDBId),
    ]);

    if (!platformData?.integrationId || platformData.status !== 'connected' || !adAccountData?.external_account_id) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Invalid ad account selection</h2>
                <p>Please select a different ad account from the dropdown.</p>
            </div>
        );
    }

    const supabase = await createServerClient();
    const draftRow = requestedDraftId
        ? await getCampaignDraftById(supabase, {
            businessId,
            draftId: requestedDraftId,
        })
        : null;
    const draftPayload = readCampaignDraftPayload(draftRow);
    const manualDraft = draftPayload?.mode === 'manual' ? draftPayload.form : null;
    const campaignWithSelectedAdSet =
        createScope === 'ad' && requestedAdSetId
            ? campaignTree.find((campaign) =>
                campaign.adset_metrics.some((adSet) => adSet.id === requestedAdSetId)
            ) ?? null
            : null;
    const selectedCampaign =
        createScope === 'ad'
            ? campaignWithSelectedAdSet ??
            (requestedCampaignId
                ? campaignTree.find((campaign) => campaign.id === requestedCampaignId) ?? null
                : null)
            : createScope === 'adset' && requestedCampaignId
                ? campaignTree.find((campaign) => campaign.id === requestedCampaignId) ?? null
                : null;
    const selectedAdSet =
        createScope === 'ad' && requestedAdSetId
            ? selectedCampaign?.adset_metrics.find((adSet) => adSet.id === requestedAdSetId) ?? null
            : null;

    if (createScope === 'adset') {
        if (campaignTree.length === 0) {
            return (
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold mb-4">No campaigns found yet</h2>
                    <p>Create at least one Meta campaign before adding a new ad set inside it.</p>
                </div>
            );
        }

        if (!selectedCampaign) {
            return (
                <ManualMetaAdSetStarter
                    campaigns={campaignTree}
                    initialCampaignId={requestedCampaignId}
                />
            );
        }

        return (
            <ManualMetaAdSetBuilder
                platformData={{
                    id: platformData.integrationId,
                    platform_name: platformData.vendor,
                }}
                adAccountId={adAccountData.external_account_id}
                existingCampaign={selectedCampaign}
            />
        );
    }

    if (createScope === 'ad') {
        if (campaignTree.length === 0) {
            return (
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold mb-4">No campaigns found yet</h2>
                    <p>Create at least one Meta campaign and ad set before adding a new ad inside it.</p>
                </div>
            );
        }

        const adSetCount = campaignTree.reduce((total, campaign) => total + campaign.adset_metrics.length, 0);
        if (adSetCount === 0) {
            return (
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold mb-4">No ad sets found yet</h2>
                    <p>Create at least one Meta ad set before adding a new ad inside it.</p>
                </div>
            );
        }

        if (!selectedCampaign || !selectedAdSet) {
            return (
                <ManualMetaAdStarter
                    campaigns={campaignTree}
                    initialCampaignId={requestedCampaignId}
                    initialAdSetId={requestedAdSetId}
                />
            );
        }

        return (
            <ManualMetaAdBuilder
                platformData={{
                    id: platformData.integrationId,
                    platform_name: platformData.vendor,
                }}
                adAccountId={adAccountData.external_account_id}
                existingCampaign={selectedCampaign}
                existingAdSet={selectedAdSet}
            />
        );
    }

    return (
        <CustomCampaignFlow
            platformData={{
                id: platformData.integrationId,
                platform_name: platformData.vendor,
            }}
            adAccountId={adAccountData.external_account_id}
            draft={manualDraft}
        />
    );
}
