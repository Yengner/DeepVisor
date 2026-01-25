
// getPlatformData() interface
export interface AggregatedMetric {
    total_spend: number;
    total_leads: number;
    total_clicks: number;
    total_ctr: number;
    total_link_clicks: number;
    total_impressions: number;
    total_messages: number;
    total_conversions: number;
}


// getPlatformDetails() interface
export interface PlatformDetails {
    id: string;
    vendor:  "meta" | "google" | "tiktok";
    is_integrated: boolean;
    access_token: string;
    updated_at: string;
}

// getPlatformTopCampaigns() interface
export interface AdAccount {
    ad_account_id: string;
    name: string;
}

// getTopAdAccountCampaigns() interface
export interface CampaignMetric {
    ad_account_id: string;
    campaign_id: string;
    campaign_name: string;
    leads: number;
    clicks: number;
    messages: number;
    spend: number;
    link_clicks: number;
    conversion: number;
    conversion_rate: number;
    status: string;
    impressions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    cost_per_result: number;
    ad_account_name: string;
}

// - none
export interface CampaignData {
    campaign_id: string;
    name: string;
    leads: number | null;
    clicks: number | null;
    messages: number | null;
    spend: number | null;
    link_clicks: number | null;
    status: string;
}

// getAdAccountData() interface
export interface AdAccountData {
    id: string;
    user_id: string;
    platform_integration_id: string; account_status: string;
    created_at: string;
    updated_at: string;
    aggregated_metrics: AdAccountAggregatedMetrics;
    last_synced: string;
    ad_account_id: string;
    name: string;
    platform_name: string;
    time_increment_metrics: {
        '1': any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
        '7': any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
        '30': any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    //{ '1': [], '7': [], '30': [Array] }
}

// -> getAdAccountData()
export interface AdAccountAggregatedMetrics {
    cpc: number;
    cpm: number;
    ctr: number;
    leads: number;
    reach: number;
    spend: number;
    clicks: number;
    messages: number;
    updated_at: string;
    impressions: number;
    link_clicks: number;
    ad_account_id: string;
}


// getTopAdAccountCampaigns() interface
export interface CampaignMetrics {
    cpc: number;
    cpm: number;
    ctr: number;
    leads: number;
    reach: number;
    spend: number;
    clicks: number;
    messages: number;
    campaign_id: string;
    impressions: number;
    link_clicks: number;
}

// Needs Updating
export interface RawCampaignData {
    id: string;
    name: string;
    status: string;
    insights: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    objective: string;
    stop_time: string;
    start_time: string;
}

export interface TopAdAccountCampaign {
    id: number;
    ad_account_id: string;
    campaign_id: string;
    name: string;
    status: string;
    objective: string;
    start_date: string;
    end_date: string;
    clicks: number;
    impressions: number;
    spend: number;
    leads: number;
    reach: number;
    link_clicks: number;
    messages: number;
    cpm: number;
    ctr: number;
    cpc: number;
    raw_data: RawCampaignData;
    created_at: string;
    updated_at: string;
    platform_name: string;
    today_metrics: CampaignMetrics;
    yesterday_metrics: CampaignMetrics;
    last_7d_metrics: CampaignMetrics;
    last_30d_metrics: CampaignMetrics;
    this_month_metrics: CampaignMetrics;
    last_month_metrics: CampaignMetrics;
    conversion: number;
    conversion_rate: number;
    cost_per_result: number;
}