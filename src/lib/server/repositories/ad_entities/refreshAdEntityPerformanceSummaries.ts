import { chunkArray, type RepositoryClient } from '../utils';
import type { AdEntityLevel, AdEntityRow } from './types';

type SummaryRow = {
  entity_id: string;
  ad_account_id: string;
  entity_level: AdEntityLevel;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  inline_link_clicks: number;
  leads: number;
  messages: number;
  calls: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  cost_per_result: number | null;
  first_day: string | null;
  last_day: string | null;
  best_day: string | null;
  worst_day: string | null;
  summary_source: string;
  history_status: string;
  synced_at: string;
  updated_at: string;
};

type DailyRow = {
  entity_id: string;
  ad_account_id: string;
  entity_level: AdEntityLevel;
  day: string;
  spend: number | string | null;
  impressions: number | string | null;
  reach: number | string | null;
  clicks: number | string | null;
  inline_link_clicks: number | string | null;
  leads: number | string | null;
  messages: number | string | null;
  calls: number | string | null;
};

type MonthlyRow = {
  entity_id: string;
  ad_account_id: string;
  entity_level: AdEntityLevel;
  month_start: string;
  spend: number | string | null;
  impressions: number | string | null;
  reach: number | string | null;
  clicks: number | string | null;
  inline_link_clicks: number | string | null;
  leads: number | string | null;
  messages: number | string | null;
  calls: number | string | null;
};

type ExistingSummaryRow = Pick<
  SummaryRow,
  | 'entity_id'
  | 'first_day'
  | 'last_day'
  | 'best_day'
  | 'worst_day'
  | 'summary_source'
  | 'history_status'
>;

type Totals = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function zeroTotals(): Totals {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    inlineLinkClicks: 0,
    leads: 0,
    messages: 0,
    calls: 0,
  };
}

function addMetrics(
  totals: Totals,
  row: Pick<
    DailyRow,
    | 'spend'
    | 'impressions'
    | 'reach'
    | 'clicks'
    | 'inline_link_clicks'
    | 'leads'
    | 'messages'
    | 'calls'
  >
): void {
  totals.spend += toNumber(row.spend);
  totals.impressions += toNumber(row.impressions);
  totals.reach += toNumber(row.reach);
  totals.clicks += toNumber(row.clicks);
  totals.inlineLinkClicks += toNumber(row.inline_link_clicks);
  totals.leads += toNumber(row.leads);
  totals.messages += toNumber(row.messages);
  totals.calls += toNumber(row.calls);
}

function minDate(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left <= right ? left : right;
}

function maxDate(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left >= right ? left : right;
}

function monthEnd(monthStart: string): string {
  const year = Number(monthStart.slice(0, 4));
  const monthIndex = Number(monthStart.slice(5, 7));

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return monthStart;
  }

  return new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);
}

export async function refreshAdEntityPerformanceSummaries(
  supabase: RepositoryClient,
  input: {
    entities: AdEntityRow[];
    syncedAt: string;
  }
): Promise<{ count: number }> {
  const entityIds = Array.from(new Set(input.entities.map((entity) => entity.id).filter(Boolean)));

  if (entityIds.length === 0) {
    return { count: 0 };
  }

  const client = supabase as any;
  const dailyRows: DailyRow[] = [];
  const monthlyRows: MonthlyRow[] = [];
  const existingSummaryRows: ExistingSummaryRow[] = [];

  for (const idsChunk of chunkArray(entityIds, 200)) {
    const [dailyResult, monthlyResult, existingSummaryResult] = await Promise.all([
      client
        .from('ad_entity_performance_daily')
        .select(
          'entity_id, ad_account_id, entity_level, day, spend, impressions, reach, clicks, inline_link_clicks, leads, messages, calls'
        )
        .in('entity_id', idsChunk),
      client
        .from('ad_entity_performance_monthly')
        .select(
          'entity_id, ad_account_id, entity_level, month_start, spend, impressions, reach, clicks, inline_link_clicks, leads, messages, calls'
        )
        .in('entity_id', idsChunk),
      client
        .from('ad_entity_performance_summary')
        .select('entity_id, first_day, last_day, best_day, worst_day, summary_source, history_status')
        .in('entity_id', idsChunk),
    ]);

    if (dailyResult.error) {
      throw dailyResult.error;
    }

    if (monthlyResult.error) {
      throw monthlyResult.error;
    }

    if (existingSummaryResult.error) {
      throw existingSummaryResult.error;
    }

    dailyRows.push(...((dailyResult.data ?? []) as DailyRow[]));
    monthlyRows.push(...((monthlyResult.data ?? []) as MonthlyRow[]));
    existingSummaryRows.push(...((existingSummaryResult.data ?? []) as ExistingSummaryRow[]));
  }

  const dailyGrouped = new Map<string, DailyRow[]>();
  const monthlyGrouped = new Map<string, MonthlyRow[]>();
  const existingSummaryByEntityId = new Map(
    existingSummaryRows.map((row) => [row.entity_id, row])
  );

  for (const row of dailyRows) {
    dailyGrouped.set(row.entity_id, [...(dailyGrouped.get(row.entity_id) ?? []), row]);
  }

  for (const row of monthlyRows) {
    monthlyGrouped.set(row.entity_id, [...(monthlyGrouped.get(row.entity_id) ?? []), row]);
  }

  const summaries: SummaryRow[] = [];

  for (const entityId of entityIds) {
    const rows = [...(dailyGrouped.get(entityId) ?? [])].sort((left, right) =>
      left.day.localeCompare(right.day)
    );
    const monthly = [...(monthlyGrouped.get(entityId) ?? [])].sort((left, right) =>
      left.month_start.localeCompare(right.month_start)
    );
    const existingSummary = existingSummaryByEntityId.get(entityId) ?? null;
    const entity = input.entities.find((candidate) => candidate.id === entityId);

    if (!entity) {
      continue;
    }

    if (existingSummary?.summary_source === 'meta_max_range') {
      continue;
    }

    const totals = zeroTotals();
    let bestDay: string | null = null;
    let worstDay: string | null = null;
    let bestResults = -1;
    let worstSpendPerResult = -1;
    let firstDay: string | null = existingSummary?.first_day ?? null;
    let lastDay: string | null = existingSummary?.last_day ?? null;

    for (const row of monthly) {
      addMetrics(totals, row);
      firstDay = minDate(firstDay, row.month_start);
      lastDay = maxDate(lastDay, monthEnd(row.month_start));
    }

    for (const row of rows) {
      const rowSpend = toNumber(row.spend);
      const rowLeads = toNumber(row.leads);
      const rowMessages = toNumber(row.messages);
      const rowCalls = toNumber(row.calls);
      const rowResults = rowLeads + rowMessages + rowCalls;
      const rowCostPerResult = rowResults > 0 ? rowSpend / rowResults : rowSpend;

      addMetrics(totals, row);
      firstDay = minDate(firstDay, row.day);
      lastDay = maxDate(lastDay, row.day);

      if (rowResults > bestResults) {
        bestResults = rowResults;
        bestDay = row.day;
      }

      if (rowCostPerResult > worstSpendPerResult) {
        worstSpendPerResult = rowCostPerResult;
        worstDay = row.day;
      }
    }

    const results = totals.leads + totals.messages + totals.calls;
    const hasHistory = monthly.length > 0 || rows.length > 0;

    summaries.push({
      entity_id: entity.id,
      ad_account_id: entity.ad_account_id,
      entity_level: entity.entity_level,
      spend: totals.spend,
      impressions: totals.impressions,
      reach: totals.reach,
      clicks: totals.clicks,
      inline_link_clicks: totals.inlineLinkClicks,
      leads: totals.leads,
      messages: totals.messages,
      calls: totals.calls,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
      cpm: totals.impressions > 0 ? totals.spend / (totals.impressions / 1000) : null,
      frequency: totals.reach > 0 ? totals.impressions / totals.reach : null,
      cost_per_result: results > 0 ? totals.spend / results : null,
      first_day: firstDay,
      last_day: lastDay,
      best_day: existingSummary?.best_day ?? bestDay,
      worst_day: existingSummary?.worst_day ?? worstDay,
      summary_source: monthly.length > 0 ? 'monthly_plus_daily' : 'aggregated_daily',
      history_status:
        hasHistory || existingSummary?.history_status === 'synced' ? 'synced' : 'not_started',
      synced_at: input.syncedAt,
      updated_at: input.syncedAt,
    });
  }

  for (const chunk of chunkArray(summaries, 500)) {
    const { error } = await client
      .from('ad_entity_performance_summary')
      .upsert(chunk, { onConflict: 'entity_id' });

    if (error) {
      throw error;
    }
  }

  return { count: summaries.length };
}
