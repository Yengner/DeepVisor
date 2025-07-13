import { fetchWithValidation } from "@/lib/actions/common/apiUtils";
import { PerformanceMetrics, TrendDataEntry, FacebookMetricsResponse } from "../../types";

export const fetchPerformanceMetrics = async (
  adAccountId: string,
  accessToken: string,
  timeRange: string = "maximum",
  timeIncrement: string = "monthly"
): Promise<PerformanceMetrics> => {

  const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL;

  if (!API_BASE_URL) {
    throw new Error("FACEBOOK_GRAPH_API_BASE_URL is not set in the environment variables");
  }

  const url = `${API_BASE_URL}/${adAccountId}/insights?fields=impressions,clicks,spend,reach,actions,ctr,cpc,cpm,date_start,date_stop&date_preset=${timeRange}&time_increment=${timeIncrement}`;

  try {
    const data: FacebookMetricsResponse = await fetchWithValidation(url, accessToken);

    const trendData: TrendDataEntry[] = data.data.map((entry) => {
      const messagingConversationsStarted = entry.actions?.find(
        (action) => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
      )?.value || 0;

      const leads = entry.actions?.find(
        (action) => action.action_type === 'lead'
      )?.value || 0;

      return {
        date: entry.date_start,
        cost: parseFloat(entry.spend || "0"),
        impressions: parseInt(entry.impressions || "0", 10),
        clicks: parseInt(entry.clicks || "0", 10),
        leads: parseInt(leads.toString(), 10),
        messagingConversationsStarted: parseInt(messagingConversationsStarted.toString(), 10),
        reach: parseInt(entry.reach || "0", 10),
        ctr: parseFloat(entry.ctr || "0"),
        cpc: parseFloat(entry.cpc || "0"),
      };
    });

    return {
      cost: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.cost, 0),
      impressions: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.impressions, 0),
      clicks: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.clicks, 0),
      leads: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.leads, 0),
      messagingConversationsStarted: trendData.reduce(
        (sum: number, item: TrendDataEntry) => sum + item.messagingConversationsStarted,
        0
      ),
      reach: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.reach, 0),
      ctr: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.ctr, 0) / trendData.length || 0,
      cpc: trendData.reduce((sum: number, item: TrendDataEntry) => sum + item.cpc, 0) / trendData.length || 0,
      trendData,

    };
  } catch (error) {
    console.error("Error in fetchPerformanceMetrics:", error);
    throw new Error("Failed to fetch performance metrics.");
  }
};
