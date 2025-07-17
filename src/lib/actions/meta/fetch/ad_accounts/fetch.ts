import { formatIncrementMetrics, formatMaximumMetrics, getDateRangeForLastDays } from "../../../utils";
import { AdAccountDetails, AdAccountIncrementMetrics, AdAccountMetrics, AdAccountWithMetrics, InsightEntry } from "../types";
import { AdAccount, FacebookAdsApi } from "../../sdk/client";

/**
 * Fetch Meta ad accounts details and metrics for a specific ad account
 * @param withMetrics - Whether to fetch metrics or not
 * @param accessToken - The access token for the Meta API
 * @param adAccountId - The ID of the ad account to fetch
 * @returns Ad account details with metrics
 */
export async function fetchMetaAdAccounts(
    withMetrics: boolean = false,
    accessToken: string,
    adAccountId?: string
): Promise<AdAccountWithMetrics | AdAccountWithMetrics[] | AdAccountDetails[]> {
    const api = FacebookAdsApi.init(accessToken);

    if (adAccountId) {
        const account = await new AdAccount(adAccountId).read([
            AdAccount.Fields.id,
            AdAccount.Fields.name,
            AdAccount.Fields.account_status
        ]);
        const metrics = await fetchMetricsForAccount(adAccountId, accessToken);
        return {
            details: account._data,
            ...metrics
        };
    }

    const response = await api.call('GET', ['me', 'adaccounts'], {
        fields: [AdAccount.Fields.id, AdAccount.Fields.name, AdAccount.Fields.account_status],
        limit: 10,
    });
    const adAccounts: AdAccountDetails[] = response.data;

    if (!withMetrics) {
        return adAccounts;
    }

    const results = await Promise.all(
        adAccounts.map(async (account) => {
            try {
                const metrics = await fetchMetricsForAccount(account.id, accessToken);
                return {
                    details: account,
                    ...metrics,
                };
            } catch (err) {
                console.error(`Failed to fetch metrics for account ${account.id}:`, err);
                return null;
            }
        })
    );

    return results.filter(Boolean);
}

/**
 * @param accountId 
 * @param accessToken 
 * @returns AdAccountWithMetrics
 */

export async function fetchMetricsForAccount(accountId: string, accessToken: string): Promise<any> {
    FacebookAdsApi.init(accessToken);
    const account = new AdAccount(accountId);

    const insightFields = [
        'clicks',
        'impressions',
        'spend',
        'reach',
        'actions',
        'cpm',
        'ctr',
        'cpc',
        'date_start',
        'date_stop'
    ];

    // Maximum metrics
    const maxMetricsCursor = await account.getInsights(insightFields, { date_preset: 'maximum' });
    const maxMetricsData: InsightEntry[] = maxMetricsCursor.map(insights => insights._data);
    const maximumMetrics = formatMaximumMetrics(maxMetricsData);

    // Increment metrics
    const increments = [
        { key: '1', range: getDateRangeForLastDays(7) },
        { key: '7', range: getDateRangeForLastDays(56) },
        { key: '30', range: getDateRangeForLastDays(365) }
    ];

    const incrementMetrics: AdAccountIncrementMetrics = { '1': [], '7': [], '30': [] };

    await Promise.all(
        increments.map(async ({ key, range }) => {
            const cursor = await account.getInsights(insightFields, {
                time_range: JSON.stringify(range),
                time_increment: key,
            });
            const data: InsightEntry[] = cursor.map(insights => insights._data);
            incrementMetrics[key as '1' | '7' | '30'] = formatIncrementMetrics(data);
        })
    );

    return {
        maximumMetrics,
        incrementMetrics
    };
}

