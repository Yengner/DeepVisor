import CustomCampaignFlow from '@/components/campaigns/create/flows/manual/ManualCampaignFlow';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getAdAccountData, getPlatformDetails } from '@/lib/server/data';

export default async function CreateCampaignPage() {

    const { businessId } = await getRequiredAppContext();

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


    return (
        <CustomCampaignFlow
            platformData={{
                id: platformData.integrationId,
                platform_name: platformData.vendor,
            }}
            adAccountId={adAccountData.external_account_id}
        />
    );
}
