import { AdAccount } from "facebook-nodejs-business-sdk";

/**
 * Type definitions for ad account and metrics
 */
export interface AdAccountWithMetrics {
    id: string; // Ad account ID
    name: string; // Ad account name
    account_status: number; // Status of the ad account
    maximumMetrics: MaximumMetrics | null; // Aggregated metrics for the "maximum" preset
    incrementMetrics: IncrementMetrics; // Time-based metrics for increments (daily, weekly, monthly)
}

/**
 * Type definition for aggregated metrics (maximum preset)
 */
export interface MaximumMetrics {
    clicks: number;
    impressions: number;
    spend: number;
    reach: number;
    cpm: number;
    ctr: number;
    cpc: number;
    leads: number;
    link_clicks: number;
    messages: number;
}

/**
 * Type definition for time-based metrics (increments)
 */
export interface IncrementMetrics {
    [increment: string]: Array<{
        date_start: string; // Start date of the time range
        date_stop: string; // End date of the time range
        spend: number; // Total spend during the time range
        clicks: number; // Total clicks during the time range
        impressions: number; // Total impressions during the time range
        reach: number; // Total reach during the time range
        actions: Record<string, number>; // Actions performed during the time range (e.g., leads, link clicks)
    }>;
}