import { cookies } from "next/headers";
import SmartCampaignClient from "./SmartCampaignClient";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { getLoggedInUser } from "@/lib/actions/user";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { getAdAccountData } from "@/lib/quieries/ad_accounts";


export default async function SmartCampaignPage() {
    const userId = await getLoggedInUser().then((user: { id: string }) => user?.id);
    const supabase = await createSupabaseClient();

    const cookieStore = await cookies();
    const selectedPlatformId = cookieStore.get('platform_integration_id')?.value;
    const { data } = await supabase
        .from("platform_integrations")
        .select("platform_name")
        .eq("id", selectedPlatformId)
        .single();

    const platformName = data?.platform_name;
    if (!selectedPlatformId || !platformName) {
        return <EmptyCampaignState type="platform" />;
    }

    const selectedAdAccountId = cookieStore.get('ad_account_id')?.value;
    if (!selectedAdAccountId) {
        return <EmptyCampaignState type="adAccount" platformName={platformName} />;
    }
    const adAccountId = await getAdAccountData(selectedAdAccountId, selectedPlatformId, userId).then((account: { ad_account_id: string }) => account?.ad_account_id);

    return (
        <SmartCampaignClient
            userId={userId}
            platformName={platformName}
            platformId={selectedPlatformId}
            adAccountId={adAccountId}
        />);
}