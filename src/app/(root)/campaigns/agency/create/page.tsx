import SmartCampaignClient from "./SmartCampaignClient";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getCurrentSelection } from "@/lib/server/actions/app/selection";
import { getRequiredAppContext } from "@/lib/server/actions/app/context";
import { getAdAccountData, getPlatformDetails } from '@/lib/server/data';


export default async function SmartCampaignPage() {
    const { user, businessId } = await getRequiredAppContext();
    const userId = user.id;

    const { selectedPlatformId, selectedAdAccountId } = await getCurrentSelection();

    if (!selectedPlatformId) {
        return <EmptyCampaignState type="platform" />;
    }

    const platformDetails = await getPlatformDetails(selectedPlatformId, businessId);
    if (!platformDetails || platformDetails.status !== "connected") {
        return <EmptyCampaignState type="platform" />;
    }

    if (!selectedAdAccountId) {
        return <EmptyCampaignState type="adAccount" platformName={platformDetails.vendor} />;
    }
    const adAccount = await getAdAccountData(selectedAdAccountId, selectedPlatformId, businessId);
    if (!adAccount?.ad_account_id) {
        return <EmptyCampaignState type="adAccount" platformName={platformDetails.vendor} />;
    }

    return (
        <SmartCampaignClient
            userId={userId}
            platformName={platformDetails.displayName}
            platformId={platformDetails.integrationId}
            adAccountId={adAccount.ad_account_id}
        />);
}
