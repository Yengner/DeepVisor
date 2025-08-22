import CustomCampaignFlow from '@/components/campaigns/create/flows/manual/ManualCampaignFlow';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { cookies } from 'next/headers';

export default async function CreateCampaignPage() {

    const supabase = await createSupabaseClient();

    const cookieStore = await cookies();
    const platformIntegrationId = cookieStore.get('platform_integration_id')?.value;
    const adAccountDBId = cookieStore.get('ad_account_row_id')?.value;

    if (!platformIntegrationId || !adAccountDBId) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Please select an ad account first</h2>
                <p>Use the dropdown in the top navigation to select an ad account.</p>
            </div>
        );
    }

    // Get platform name
    const { data: platformData } = await supabase
        .from('platform_integrations')
        .select('id, platform_name')
        .eq('id', platformIntegrationId)

        .single();

    // Get ad account ID
    const { data: adAccountData } = await supabase
        .from('ad_accounts')
        .select('external_account_id')
        .eq('id', adAccountDBId)
        .single();

    if (!platformData?.id || !adAccountData?.external_account_id) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Invalid ad account selection</h2>
                <p>Please select a different ad account from the dropdown.</p>
            </div>
        );
    }


    return (
        <CustomCampaignFlow
            platformData={platformData}
            adAccountId={adAccountData.external_account_id}
        />
    );
}