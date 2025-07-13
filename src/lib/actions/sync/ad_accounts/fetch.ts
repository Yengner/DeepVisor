import { AdAccountWithMetrics } from "./types";

/**
 * Fetch Meta ad account details and metrics for a specific ad account
 * @param accessToken - The access token for the Meta API
 * @param adAccountId - The ID of the ad account to fetch
 * @returns Ad account details with metrics
 */
export async function fetchMetaAdAccountWithMetrics(
    accessToken: string,
    adAccountId: string
): Promise<AdAccountWithMetrics> {
    console.log(`Fetching Meta ad account details and metrics for ad account: ${adAccountId}`);

    const batchBody: Array<{ method: string; relative_url: string }> = [
        // Fetch ad account details
        {
            method: "GET",
            relative_url: `/${adAccountId}?fields=id,name,account_status,amount_spent`,
        },
        // Fetch metrics for "maximum" preset
        {
            method: "GET",
            relative_url: `/${adAccountId}/insights?fields=clicks,impressions,spend,reach,actions,cpm,ctr,cpc,date_start,date_stop&date_preset=maximum`,
        },
        // Fetch metrics for dynamic increments
        ...[
            { increment: "1", range: getDateRangeForLastDays(7) }, // Daily for the last 7 days
            { increment: "7", range: getDateRangeForLastDays(56) }, // Weekly for the last 8 weeks
            { increment: "30", range: getDateRangeForLastDays(365) }, // Monthly for the current year
        ].map(({ increment, range }) => ({
            method: "GET",
            relative_url: `/${adAccountId}/insights?fields=clicks,impressions,spend,reach,actions,cpm,ctr,cpc,date_start,date_stop&time_range=${JSON.stringify(
                range
            )}&time_increment=${increment}`,
        })),
    ];

    const batchUrl = `https://graph.facebook.com/v23.0`;

    try {
        // Send the batched request
        const response = await fetch(batchUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ batch: batchBody }),
        });

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error("Batch API request failed:", errorDetails);
            throw new Error(`Failed to fetch Meta ad account details and metrics for ad account: ${adAccountId}`);
        }

        const results: Array<{ code: number; body: string }> = await response.json();

        let adAccountDetails: AdAccountDetails | null = null;
        let maximumMetrics: MaximumMetrics | null = null;
        const incrementMetrics: IncrementMetrics = {};

        results.forEach((result, index) => {
            if (result.code === 200) {
                const data = JSON.parse(result.body);

                // Process ad account details
                if (index === 0) {
                    adAccountDetails = data as AdAccountDetails;
                }
                // Process "maximum" preset metrics
                else if (index === 1) {
                    const aggregated = (data.data as Array<InsightEntry>).reduce(
                        (acc, entry) => {
                            const actions = entry.actions || [];
                            return {
                                clicks: acc.clicks + parseInt(entry.clicks || "0", 10),
                                impressions: acc.impressions + parseInt(entry.impressions || "0", 10),
                                spend: acc.spend + parseFloat(entry.spend || "0"),
                                reach: acc.reach + parseInt(entry.reach || "0", 10),
                                cpm: acc.cpm + parseFloat(entry.cpm || "0"),
                                ctr: acc.ctr + parseFloat(entry.ctr || "0"),
                                cpc: acc.cpc + parseFloat(entry.cpc || "0"),
                                leads: parseInt(
                                    actions.find((action) => action.action_type === "onsite_conversion.lead_grouped")?.value || "0",
                                    10
                                ),
                                link_clicks: parseInt(
                                    actions.find((action) => action.action_type === "link_click")?.value || "0",
                                    10
                                ),
                                messages: parseInt(
                                    actions.find((action) => action.action_type === "onsite_conversion.total_messaging_connection")?.value || "0",
                                    10
                                ),
                            };
                        },
                        {
                            clicks: 0,
                            impressions: 0,
                            spend: 0,
                            reach: 0,
                            cpm: 0,
                            ctr: 0,
                            cpc: 0,
                            leads: 0,
                            link_clicks: 0,
                            messages: 0,
                        }
                    );
                    maximumMetrics = aggregated;
                }
                // Process dynamic increments
                else {
                    const increment = ["1", "7", "30"][index - 2];
                    incrementMetrics[increment] = (data.data as Array<InsightEntry>).map((entry) => {
                        const actions = entry.actions || [];
                        return {
                            date_start: entry.date_start,
                            date_stop: entry.date_stop,
                            spend: parseFloat(entry.spend || "0"),
                            clicks: parseInt(entry.clicks || "0", 10),
                            impressions: parseInt(entry.impressions || "0", 10),
                            reach: parseInt(entry.reach || "0", 10),
                            actions: actions.reduce<Record<string, number>>((actionAcc, action) => {
                                actionAcc[action.action_type] = parseInt(action.value || "0", 10);
                                return actionAcc;
                            }, {}),
                        };
                    });
                }
            } else {
                console.error(`Error in batch response for index ${index}:`, result);
            }
        });

        if (!adAccountDetails) {
            throw new Error(`Failed to fetch details for ad account: ${adAccountId}`);
        }

        return {
            ...(adAccountDetails as AdAccountDetails),
            maximumMetrics,
            incrementMetrics,
        };
    } catch (error) {
        console.error("Error fetching ad account details and metrics:", error);
        throw new Error("Failed to fetch ad account details and metrics.");
    }
}

/**
 * Type definitions for ad account and metrics
 */
export interface AdAccountDetails {
    id: string;
    name: string;
    account_status: number;
    amount_spent: number;
}

export interface InsightEntry {
    date_start: string;
    date_stop: string;
    spend: string;
    clicks: string;
    impressions: string;
    reach: string;
    cpm: string;
    ctr: string;
    cpc: string;
    actions?: Array<{ action_type: string; value: string }>;
}

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

export interface IncrementMetrics {
    [increment: string]: Array<{
        date_start: string;
        date_stop: string;
        spend: number;
        clicks: number;
        impressions: number;
        reach: number;
        actions: Record<string, number>;
    }>;
}

export function getDateRangeForLastDays(days: number): { since: string; until: string } {
    const today = new Date();
    const since = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    return {
        since: since.toISOString().split("T")[0],
        until: today.toISOString().split("T")[0],
    };
}