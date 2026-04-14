import CustomCampaignFlow from '@/components/campaigns/create/flows/manual/ManualCampaignFlow';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getCampaignDraftById, readCampaignDraftPayload } from '@/lib/server/campaigns/drafts';
import { getAdAccountData, getPlatformDetails } from '@/lib/server/data';
import { createServerClient } from '@/lib/server/supabase/server';

export default async function CreateCampaignPage({
    searchParams,
}: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

    const { businessId } = await getRequiredAppContext();
    const params = searchParams ? await searchParams : {};
    const requestedDraftId = typeof params?.draft === 'string' ? params.draft : null;

    const { selectedPlatformId: platformIntegrationId, selectedAdAccountId: adAccountDBId } = await resolveCurrentSelection(businessId);

    if (!platformIntegrationId || !adAccountDBId) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Please select an ad account first</h2>
                <p>Use the dropdown in the top navigation to select an ad account.</p>
            </div>
        );
    }

    const [platformData, adAccountData] = await Promise.all([
        getPlatformDetails(platformIntegrationId, businessId),
        getAdAccountData(adAccountDBId, platformIntegrationId, businessId),
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
