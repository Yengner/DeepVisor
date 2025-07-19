import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { AggregatedMetric } from "../types";

/**
 * Fetches platform data including aggregated metrics
 * @param selectedPlatformId - The ID of the platform to fetch data for
 * @returns An object containing the aggregated metrics for the platform
 */
export async function getPlatformAggregatedData(selectedPlatformId: string, userId: string) {
    const supabase = await createSupabaseClient();

    try {
        const { data, error: PlatformDataError } = await supabase
            .from('platform_aggregated_metrics')
            .select(`
                total_leads,
                total_spend,
                total_clicks,
                total_messages,
                total_ctr,
                total_link_clicks,
                total_conversions,
                total_impressions
                `)
            .eq('platform_integration_id', selectedPlatformId)
            .eq('platform_integration_id.user_id', userId)
            .single();

        if (PlatformDataError) {
            console.error('Error fetching aggregated metrics:', PlatformDataError.message);
            throw new Error('Failed to fetch aggregated metrics');
        }

        if (!data) {
            throw new Error('No aggregated metrics found');
        }

        // normalize the data
        const platformData: AggregatedMetric = {
            total_spend: data.total_spend,
            total_leads: data.total_leads || 0,
            total_clicks: data.total_clicks || 0,
            total_ctr: data.total_ctr || 0,
            total_link_clicks: data.total_link_clicks || 0,
            total_impressions: data.total_impressions || 0,
            total_messages: data.total_messages || 0,
            total_conversions: data.total_conversions || 0,
        };

        return platformData;
    } catch (error) {
        console.error('Error in getPlatformData Function:', error);
        throw error;
    }
}
