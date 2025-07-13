import { fetchWithValidation } from "@/lib/actions/common/apiUtils";
import { Action, MetricEntry } from "../../types";

export const fetchMetrics = async (
  adAccountId: string,
  accessToken: string,
  timeRange: string = "maximum"
): Promise<MetricEntry> => {

  const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL;

  if (!API_BASE_URL) {
    throw new Error("FACEBOOK_GRAPH_API_BASE_URL is not set in the environment variables");
  }

  const url = `${API_BASE_URL}/${adAccountId}/insights?fields=impressions,clicks,spend,reach,actions,ctr,cpc,cpm,date_start,date_stop&date_preset=${timeRange}`;

  try {
    // Explicitly define the expected structure of the response
    const data = await fetchWithValidation(url, accessToken) as {
      data: {
        impressions?: string;
        clicks?: string;
        spend?: string;
        reach?: string;
        ctr?: string;
        cpc?: string;
        cpm?: string;
        actions?: Action[];
        date_start?: string;
        date_stop?: string;
      }[];
    };

    // Safely access the data structure
    const entry = data.data?.[0] || {};
    const leads = entry.actions?.find((action: Action) => action.action_type === "lead")?.value || 0;

    return {
      impressions: parseInt(entry.impressions || "0", 10),
      clicks: parseInt(entry.clicks || "0", 10),
      spend: parseFloat(entry.spend || "0").toFixed(2),
      reach: parseInt(entry.reach || "0", 10),
      ctr: parseFloat(entry.ctr || "0").toFixed(2),
      cpc: parseFloat(entry.cpc || "0").toFixed(2),
      cpm: parseFloat(entry.cpm || "0").toFixed(2),
      leads: leads || 0,
      dateStart: entry.date_start || "",
      dateStop: entry.date_stop || "",
    };
  } catch (error) {
    console.error("Error in fetchMetrics:", error);
    throw new Error("Failed to fetch metrics.");
  }
};
