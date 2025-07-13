import { fetchWithValidation } from "@/lib/actions/common/apiUtils";

// Types for API responses
interface InsightAction {
  action_type: string;
  value: string | number;
}

interface InsightEntry {
  clicks?: string;
  spend?: string;
  actions?: InsightAction[];
  date_start?: string;
  date_stop?: string;
}

interface AccountDetails {
  name: string;
  currency: string;
  spend_cap: string;
  amount_spent: string;
  account_status: number;
}

interface CampaignEntry {
  id: string;
}

interface AccountInfo {
  balance: number;
  todaySpend: number;
  name: string;
  currency: string;
  spendCap: number;
  lifetimeSpend: number;
  accountStatus: number;
  totalCampaigns: number;
  insights: {
    clicks: number;
    linkClicks: number;
    postEngagement: number;
  };
}

interface InsightsResponse {
  data: InsightEntry[];
}

interface BalanceResponse {
  balance: string;
}

interface SpendResponse {
  data: { spend: string }[];
}

interface CampaignsResponse {
  data: CampaignEntry[];
}

// Helper to process insights
const processInsights = (data: InsightEntry[]) => {
  return data.map((entry) => {
    const linkClicks = entry.actions?.find((action) => action.action_type === "link_click")?.value || 0;
    const postEngagement = entry.actions?.find((action) => action.action_type === "post_engagement")?.value || 0;

    return {
      clicks: parseInt(entry.clicks || "0", 10),
      linkClicks: parseInt(linkClicks.toString(), 10),
      postEngagement: parseInt(postEngagement.toString(), 10),
    };
  });
};

export const fetchAccountInfo = async (
  adAccountId: string,
  accessToken: string
): Promise<AccountInfo> => {
  const today = new Date().toISOString().split("T")[0];

  const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL;

  if (!API_BASE_URL) {
    throw new Error("FACEBOOK_GRAPH_API_BASE_URL is not set in the environment variables");
  }

  // API URLs for fetching data
  const urls = {
    balance: `${API_BASE_URL}/${adAccountId}?fields=balance`,
    spend: `${API_BASE_URL}/${adAccountId}/insights?fields=spend&time_range[since]=${today}&time_range[until]=${today}`,
    insights: `${API_BASE_URL}/${adAccountId}/insights?fields=clicks,spend,actions&date_preset=maximum`,
    accountDetails: `${API_BASE_URL}/${adAccountId}?fields=name,currency,spend_cap,amount_spent,account_status`,
    campaigns: `${API_BASE_URL}/${adAccountId}/campaigns?fields=id`,
  };

  try {
    // Fetch all data in parallel with proper typing
    const [
      balanceData,
      spendData,
      insightsData,
      accountDetailsData,
      campaignsData,
    ] = await Promise.all([
      fetchWithValidation<BalanceResponse>(urls.balance, accessToken),
      fetchWithValidation<SpendResponse>(urls.spend, accessToken),
      fetchWithValidation<InsightsResponse>(urls.insights, accessToken),
      fetchWithValidation<AccountDetails>(urls.accountDetails, accessToken),
      fetchWithValidation<CampaignsResponse>(urls.campaigns, accessToken),
    ]);

    // Process insights
    const processedInsights = processInsights(insightsData.data);

    // Parse and return account information
    return {
      balance: parseFloat(balanceData.balance || "0"),
      todaySpend: parseFloat(spendData.data?.[0]?.spend || "0"),
      name: accountDetailsData.name || "Unknown",
      currency: accountDetailsData.currency || "USD",
      spendCap: parseFloat(accountDetailsData.spend_cap || "0"),
      lifetimeSpend: parseFloat(accountDetailsData.amount_spent || "0") / 100,
      accountStatus: accountDetailsData.account_status || 0,
      totalCampaigns: campaignsData.data?.length || 0,
      insights: processedInsights[0],
    };
  } catch (error) {
    console.error("Error in fetchAccountInfo:", error);
    throw new Error("Failed to fetch account information.");
  }
};
