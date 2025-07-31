/**
 * Type definitions for ad account and metrics
 */

export interface CombinedAdAccountDetails {
    AdAccount: AdAccountDetails;
    maximumMetrics: AdAccountMetrics | null;
}
export interface AdAccountWithMetrics {
    details: AdAccountDetails;
    maximumMetrics: AdAccountMetrics | null; // Aggregated metrics for the "maximum" preset
    incrementMetrics: AdAccountMetrics; // Time-based metrics for increments (daily, weekly, monthly)
}

/**
 * Type definition for aggregated metrics (maximum preset)
 */
export interface AdAccountMetrics {
    clicks: number;
    impressions: number;
    spend: number;
    reach: number;
    actions: Array<{ action_type: string; value: string }>;
    cpm: number;
    ctr: number;
    cpc: number;
    leads: number;
    link_clicks: number;
    messages: number;
    date_start: string;
    date_stop: string;
}

export interface InsightEntry {
    clicks: string;
    impressions: string;
    spend: string;
    reach: string;
    actions?: Array<{ action_type: string; value: string }>;
    cpm?: string;
    ctr?: string;
    cpc?: string;
    date_start: string;
    date_stop: string;
}

export interface AdAccountIncrementMetrics {
    '1': AdAccountMetrics[];
    '7': AdAccountMetrics[];
    '30': AdAccountMetrics[];
}

/**
 * Type definitions for ad account and metrics
 */
export interface AdAccountDetails {
    id: string;
    name: string;
    account_status: number;
}


export interface PageAccount {
    id: string;
    name: string;
    account: string;
    access_token: string;
    instagram_business_account?: {
        id: string;
    }
}