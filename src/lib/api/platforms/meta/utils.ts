import { AdAccountMetrics, InsightEntry } from "./types";

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