import type { Json } from '@/lib/shared/types/supabase';
import { asRecord } from '@/lib/shared/utils/format';
export type HistoricalCampaign = {
    external_id: string;
    name: string | null;
    objective: string | null;
    raw: Json;
    updated_at: string;
};
function positive(value: unknown) { const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN; return Number.isFinite(n) && n > 0 ? n : null; }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2); return sorted.length < 3 ? null : sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2; }
export function historicalDefaults(campaigns: HistoricalCampaign[], currency: string | null, objective: string | null) {
    const comparable = campaigns.filter(c => objective && c.objective === objective);
    // Do not guess Meta budget scaling for unverified currencies.
    const scale = currency && ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'].includes(currency) ? 100 : null;
    const daily: number[] = [], lifetime: number[] = [], durations: number[] = [];
    for (const campaign of comparable) {
        const raw = asRecord(campaign.raw);
        const d = positive(raw.daily_budget), l = positive(raw.lifetime_budget);
        if (scale && d && !l)
            daily.push(d / scale);
        if (scale && l && !d)
            lifetime.push(l / scale);
        const start = typeof raw.start_time === 'string' ? Date.parse(raw.start_time) : NaN;
        const end = typeof raw.stop_time === 'string' ? Date.parse(raw.stop_time) : NaN;
        const duration = (end - start) / 86400000;
        if (duration > 0 && duration <= 366 && end < Date.now())
            durations.push(duration);
    }
    return {
        source: 'historical_observation', currency, objective,
        scope: 'Latest 50 saved campaigns; campaign-owned budgets only. Ad-set budgets are not combined. Scheduled durations are not measured delivery duration.',
        dailyBudget: { median: median(daily), sampleSize: daily.length },
        lifetimeBudget: { median: median(lifetime), sampleSize: lifetime.length },
        durationDays: { median: median(durations), sampleSize: durations.length },
        observedFrom: comparable.map(c => c.updated_at).sort()[0] ?? null,
        observedThrough: comparable.map(c => c.updated_at).sort().at(-1) ?? null,
        insufficientHistory: comparable.length < 3,
    };
}
