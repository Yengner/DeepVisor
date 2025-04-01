import { createSupabaseClient } from "../../utils/supabase/clients/server";

interface AggregatedMetric {
  platform_integration_id: string;
  total_spend: number;
  total_leads: number;
  total_clicks: number;
  total_ctr: number;
  total_link_clicks: number;
  total_impressions: number;
  total_messages: number;
  total_conversions: number;
  platform_name: string;
}

export async function getTopPlatforms(userId: string) {
  const supabase = await createSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('platform_aggregated_metrics')
      .select(`
        platform_integration_id,
        total_spend,
        total_leads,
        total_messages,
        total_clicks,
        total_link_clicks,
        total_ctr,
        total_impressions,
        total_conversions,
        platform_integrations!inner (
          user_id,
          platform_name
        )
      `)
      .eq('platform_integrations.user_id', userId);

    if (error) {
      console.error('Error fetching aggregated metrics:', error.message);
      throw new Error('Failed to fetch aggregated metrics');
    }

    if (!data || data.length === 0) {
      throw new Error('No aggregated metrics found');
    }

    // normalize the data
    const normalizedData: AggregatedMetric[] = data.map((item) => {
      const integration = item.platform_integrations as { platform_name?: string };
      return {
        platform_integration_id: item.platform_integration_id,
        total_spend: item.total_spend || 0,
        total_leads: item.total_leads || 0,
        total_clicks: item.total_clicks || 0,
        total_ctr: item.total_ctr || 0,
        total_link_clicks: item.total_link_clicks || 0,
        total_impressions: item.total_impressions || 0,
        total_messages: item.total_messages || 0,
        total_conversions: item.total_conversions || 0,
        platform_name: integration.platform_name || 'Unknown',
      };
    });
    // Determine the best platforms by each metric
    const topPlatform = {
      leads: getBestPlatform(normalizedData, 'total_leads'),
      ctr: getBestPlatform(normalizedData, 'total_ctr'),
      link_clicks: getBestPlatform(normalizedData, 'total_link_clicks'),
      impressions: getBestPlatform(normalizedData, 'total_impressions'),
      messages: getBestPlatform(normalizedData, 'total_messages'),
    };

    // Sort the platforms by total leads or another primary metric
    const topPlatforms = normalizedData
      .sort((a, b) => b.total_conversions - a.total_conversions)
      .slice(0, 5);

    return { metrics: normalizedData, topPlatform, topPlatforms };
  } catch (error) {
    console.error('Error in getTopPlatforms function:', error);
    throw error;
  }
}

// Determine the best platform based on a specific metric
function getBestPlatform(data: AggregatedMetric[], metric: keyof AggregatedMetric) {
  return data.reduce((best, current) => {
    if (current[metric] > (best[metric] ?? -Infinity)) {
      return current;
    }
    return best;
  }, {} as AggregatedMetric);
}
