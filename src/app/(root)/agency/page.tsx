import AgencyClient from './AgencyClient';
import { EmptyCampaignState } from '@/components/campaigns/EmptyStates';
import { getCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';

export default async function AgencyPage() {
    const { user } = await getRequiredAppContext();
    const userId = user.id;
    const { selectedPlatformId, selectedAdAccountId } = await getCurrentSelection();
    if (!selectedPlatformId || !selectedAdAccountId) {
        return <EmptyCampaignState type="platform" />;
    }

    /// Question: Unused??? What would this be used for
    // const adAccountId = await getAdAccountData(selectedAdAccountId, selectedPlatformId, userId).then((account: { external_account_id: string }) => account?.external_account_id);

    ///
      // Update: Add Skeleton to Agency Client for unprocessed data while server loads data
    ////
    return <AgencyClient userId={userId} adAccountId={selectedAdAccountId} tenantId={selectedPlatformId}/>;
}
