import 'server-only'

import { AdAccount, FacebookAdsApi } from "@/lib/server/sdk/client";
import { AdAccountDetails, AdAccountIncrementMetrics, AdAccountWithMetrics, InsightEntry } from "../types";
import { formatIncrementMetrics, formatMaximumMetrics, getDateRangeForLastDays } from "../utils";

type MetaAdAccountsResponse = {
    data?: AdAccountDetails[];
    paging?: {
        next?: string;
    };
    error?: {
        message?: string;
    };
};

async function fetchAllMetaAdAccountDetails(accessToken: string): Promise<AdAccountDetails[]> {
    let nextUrl: URL | null = new URL('https://graph.facebook.com/v23.0/me/adaccounts');
    nextUrl.searchParams.set('fields', [
        AdAccount.Fields.id,
        AdAccount.Fields.name,
        AdAccount.Fields.account_status
    ].join(','));
    nextUrl.searchParams.set('limit', '200');
    nextUrl.searchParams.set('access_token', accessToken);

    const rows: AdAccountDetails[] = [];

    while (nextUrl) {
        const response = await fetch(nextUrl);
        if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as MetaAdAccountsResponse;
            throw new Error(body.error?.message || 'Failed to fetch Meta ad accounts');
        }

        const body = (await response.json()) as MetaAdAccountsResponse;
        rows.push(...(body.data || []));
        nextUrl = body.paging?.next ? new URL(body.paging.next) : null;
    }

    return rows;
}

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
): Promise<AdAccountWithMetrics | AdAccountWithMetrics[] | AdAccountDetails | AdAccountDetails[]> {
    FacebookAdsApi.init(accessToken);

    if (adAccountId) {
        const account = await new AdAccount(adAccountId).read([
            'id',
            'name',
            'account_status',
            'currency',
            'timezone_name',
        ]);

        if (!withMetrics) {
            return account._data as AdAccountDetails;
        }

        const metrics = await fetchMetricsForAccount(adAccountId, accessToken);
        return {
            details: account._data as AdAccountDetails,
            ...metrics
        };
    }

    const adAccounts = await fetchAllMetaAdAccountDetails(accessToken);

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

export async function fetchMetricsForAccount(accountId: string, accessToken: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
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
