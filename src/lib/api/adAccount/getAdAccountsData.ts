import { createSupabaseClient } from "../../utils/supabase/clients/server";


interface MappedAdAccount {
  ad_account_id: string;
  name: string;
  account_status: string;
  time_increment_metrics: Record<string, unknown>;
  aggregated_metrics: Record<string, unknown>;
  industry: string | null;
}

export async function getAdAccountsData(platform: string, userId: string): Promise<MappedAdAccount[] | []> {
  const supabase = await createSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('ad_account_id, name, account_status, time_increment_metrics, aggregated_metrics, industry_id(name), time_increment_metrics')
      .eq('platform_name', platform)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching platform data:', error);
      return [];
    }

    
    const mappedData = data.map((adAccount) => {
      const industry = adAccount.industry_id as { name?: string };
      return {
        ad_account_id: adAccount.ad_account_id,
        name: adAccount.name,
        account_status: adAccount.account_status,
        time_increment_metrics: adAccount.time_increment_metrics || {},
        aggregated_metrics: adAccount.aggregated_metrics || {},
        industry: industry.name || null,
      }
    })

    
    return mappedData
  } catch (err) {
    console.error('Unexpected error fetching platform data:', err);
    return [];
  }
}
