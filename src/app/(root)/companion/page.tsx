import { getLoggedInUser } from '@/lib/actions/user';
import CompanionClient from './CompanionClient';
import { cookies } from 'next/headers';
import { getAdAccountData } from '@/lib/quieries/ad_accounts';
import { EmptyCampaignState } from '@/components/campaigns/EmptyStates';

export default async function CompanionPage() {
    const userId = await getLoggedInUser().then((user: { id: string }) => user?.id);
    const cookieStore = await cookies();
    const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;
    const selectedAdAccountId = cookieStore.get('ad_account_row_id')?.value;
    if (!selectedPlatformId || !selectedAdAccountId) {
        return <EmptyCampaignState type="platform" />;
    }

    const adAccountId = await getAdAccountData(selectedAdAccountId, selectedPlatformId, userId).then((account: { external_account_id: string }) => account?.external_account_id);

    return <CompanionClient userId={userId} adAccountId={adAccountId} />;
}