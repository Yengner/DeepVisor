export type CampaignMetrics = {
    id: string;
    name: string;
    status: string;
    objective: string;
    raw_data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    clicks: number;
    impressions: number;
    spend: string; // formatted as string with .toFixed(2)
    leads: number;
    reach: number;
    link_clicks: number;
    messages: number;
    cpm: string; // formatted as string with .toFixed(2)
    ctr: string; // formatted as string with .toFixed(2)
    cpc: string; // formatted as string with .toFixed(2)
    start_date: string;
    end_date: string;
    today_metrics: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    yesterday_metrics: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    platform_name: string;
};