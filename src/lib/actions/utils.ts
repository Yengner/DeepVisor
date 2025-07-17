import { AdAccountMetrics, AdAccountWithMetrics, InsightEntry } from './meta/fetch/types';

/**
 * Update user's connected accounts in profile
 */
export async function updateUserConnectedAccounts(
    supabase: any,
    userId: string,
    accountsToAdd: AdAccountWithMetrics | AdAccountWithMetrics[],
    savedAdAccountIds: { [adAccountId: string]: string }
): Promise<void> {

    if (Array.isArray(accountsToAdd) && accountsToAdd.length === 0) {
        return;
    }

    // Get existing connected accounts
    const { data } = await supabase
        .from('profiles')
        .select('connected_accounts')
        .eq('id', userId)
        .single();

    const connectedAccounts = data?.connected_accounts || [];
    const currentTime = new Date().toISOString();

    // Add each new account if not already connected
    let updated = false;

    for (const account of Array.isArray(accountsToAdd) ? accountsToAdd : [accountsToAdd]) {
        const existingIndex = connectedAccounts.findIndex(
            (acc: any) => acc.platform === 'meta' && acc.accountId === account.details.id
        );

        if (existingIndex === -1) {
            connectedAccounts.push({
                platform: 'meta',
                accountId: account.details.id,
                accountName: account.details.name,
                connectedAt: currentTime,
                ad_account_ref: savedAdAccountIds[account.details.id]
            });
            updated = true;
        } else if (savedAdAccountIds[account.details.id]) {

            connectedAccounts[existingIndex] = {
                ...connectedAccounts[existingIndex],
                ad_account_ref: savedAdAccountIds[account.details.id],
                accountName: account.details.name,
                updatedAt: currentTime
            };
            updated = true;
        }
    }

    if (updated) {
        await supabase
            .from('profiles')
            .update({ connected_accounts: connectedAccounts })
            .eq('id', userId);
    }
}

export function getDateRangeForLastDays(days: number): { since: string; until: string } {
    const today = new Date();
    const since = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    return {
        since: since.toISOString().split("T")[0],
        until: today.toISOString().split("T")[0],
    };
}

function extractActionMetrics(
    actions: Array<{ action_type: string; value: string }>
) {
    const findValue = (type: string) =>
        parseInt(actions.find(a => a.action_type === type)?.value || "0", 10);

    return {
        leads: findValue("onsite_conversion.lead_grouped"),
        link_clicks: findValue("link_click"),
        messages: findValue("onsite_conversion.total_messaging_connection"),
    };
}


export function formatMaximumMetrics(data: InsightEntry[]): AdAccountMetrics | null {
    if (!data || data.length === 0) return null;
    const entry = data[0];
    const { leads, link_clicks, messages } = extractActionMetrics(entry.actions || []);
    return {
        clicks: parseInt(entry.clicks || "0", 10),
        impressions: parseInt(entry.impressions || "0", 10),
        spend: parseFloat(entry.spend || "0"),
        reach: parseInt(entry.reach || "0", 10),
        actions: entry.actions || [],
        leads,
        link_clicks,
        messages,
        cpm: parseFloat(entry.cpm || "0"),
        ctr: parseFloat(entry.ctr || "0"),
        cpc: parseFloat(entry.cpc || "0"),
        date_start: entry.date_start,
        date_stop: entry.date_stop,
    };
}

export function formatIncrementMetrics(data: InsightEntry[]): AdAccountMetrics[] {
    if (!data || data.length === 0) return [];
    return data.map(entry => {
        const { leads, link_clicks, messages } = extractActionMetrics(entry.actions || []);
        return {
            clicks: parseInt(entry.clicks || "0", 10),
            impressions: parseInt(entry.impressions || "0", 10),
            spend: parseFloat(entry.spend || "0"),
            reach: parseInt(entry.reach || "0", 10),
            actions: entry.actions || [],
            leads,
            link_clicks,
            messages,
            cpm: parseFloat(entry.cpm || "0"),
            ctr: parseFloat(entry.ctr || "0"),
            cpc: parseFloat(entry.cpc || "0"),
            date_start: entry.date_start,
            date_stop: entry.date_stop,
        };
    });
}

export const date = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
