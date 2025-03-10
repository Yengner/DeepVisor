import { fetchMetrics } from '@/lib/api/platforms/meta/metrics';
import { fetchAccountInfo } from '@/lib/api/platforms/meta/accountInfo';
import { fetchCampaignMetrics } from '@/lib/api/platforms/meta/topCampaigns';
import { fetchAgeGenderCountryMetrics } from './platforms/meta/demographics';
import { fetchPerformanceMetrics } from './platforms/meta/performanceMetrics';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
// import { fetchHourlyBreakdown } from './platforms/meta/hourlyBreakdown';

export const fetchDashboardMetrics = async (platform: string, adAccountId: string, userId: string) => {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('platform_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('platform_name', platform)
    .single();

  if (error || !data) {
    throw new Error('Access token not found for the user and platform');
  }

  const accessToken = data.access_token;

  const [metrics, accountInfo, topCampaigns, ageGenderMetrics, performanceMetrics] = await Promise.all([
    fetchMetrics(adAccountId, accessToken),
    fetchAccountInfo(adAccountId, accessToken),
    fetchCampaignMetrics(adAccountId, accessToken),
    fetchAgeGenderCountryMetrics(adAccountId, accessToken),
    fetchPerformanceMetrics(adAccountId, accessToken),
  ]);

  return {
    metrics,
    topCampaigns,
    accountInfo,
    ageGenderMetrics,
    performanceMetrics,
    // hourlyBreakdown
  };
};
