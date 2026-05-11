import 'server-only';

import { createAdminClient } from '@/lib/server/supabase/admin';
import { refreshAdEntityPerformanceSummaries } from '@/lib/server/repositories/ad_entities/refreshAdEntityPerformanceSummaries';
import type { AdEntityRow } from '@/lib/server/repositories/ad_entities/types';
import type { BusinessDataPolicy } from '@/lib/server/repositories/business_data_policies/getBusinessDataPolicy';
import { chunkArray } from '@/lib/server/repositories/utils';

type DailyRow = {
  entity_id: string;
  ad_account_id: string;
  entity_level: 'campaign' | 'adset' | 'ad';
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

type MetricTotals = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
};

type MonthlyMetricRow = {
  entity_id?: string;
  ad_account_id: string;
  entity_level?: 'campaign' | 'adset' | 'ad';
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

type RollupResult = {
  businessesProcessed: number;
  entityMonthlyRows: number;
  accountMonthlyRows: number;
  summariesRefreshed: number;
  snapshotsCreated: number;
  dailyRowsDeleted: number;
  hourlyRowsDeleted: number;
  audienceRowsDeleted: number;
  oauthStatesDeleted: number;
  syncJobsDeleted: number;
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

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

function zeroTotals(): MetricTotals {
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

function addRow(total: MetricTotals, row: DailyRow): void {
  total.spend += toNumber(row.spend);
  total.impressions += toNumber(row.impressions);
  total.reach += toNumber(row.reach);
  total.clicks += toNumber(row.clicks);
  total.inlineLinkClicks += toNumber(row.inline_link_clicks);
  total.leads += toNumber(row.leads);
  total.messages += toNumber(row.messages);
  total.calls += toNumber(row.calls);
}

function addMonthlyRow(total: MetricTotals, row: MonthlyMetricRow): void {
  total.spend += toNumber(row.spend);
  total.impressions += toNumber(row.impressions);
  total.reach += toNumber(row.reach);
  total.clicks += toNumber(row.clicks);
  total.inlineLinkClicks += toNumber(row.inline_link_clicks);
  total.leads += toNumber(row.leads);
  total.messages += toNumber(row.messages);
  total.calls += toNumber(row.calls);
}

function metricsFromTotals(total: MetricTotals) {
  const results = total.leads + total.messages + total.calls;

  return {
    spend: total.spend,
    impressions: total.impressions,
    reach: total.reach,
    clicks: total.clicks,
    inline_link_clicks: total.inlineLinkClicks,
    leads: total.leads,
    messages: total.messages,
    calls: total.calls,
    ctr: total.impressions > 0 ? (total.clicks / total.impressions) * 100 : null,
    cpc: total.clicks > 0 ? total.spend / total.clicks : null,
    cpm: total.impressions > 0 ? total.spend / (total.impressions / 1000) : null,
    frequency: total.reach > 0 ? total.impressions / total.reach : null,
    cost_per_result: results > 0 ? total.spend / results : null,
  };
}

async function deleteWithCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const result = await query;
  if (result.error) {
    throw result.error;
  }

  return result.count ?? 0;
}

export async function runAccountIntelligenceRetentionJob(): Promise<RollupResult> {
  const supabase = createAdminClient() as any;
  const now = new Date();
  const result: RollupResult = {
    businessesProcessed: 0,
    entityMonthlyRows: 0,
    accountMonthlyRows: 0,
    summariesRefreshed: 0,
    snapshotsCreated: 0,
    dailyRowsDeleted: 0,
    hourlyRowsDeleted: 0,
    audienceRowsDeleted: 0,
    oauthStatesDeleted: 0,
    syncJobsDeleted: 0,
  };

  result.oauthStatesDeleted = await deleteWithCount(
    supabase.from('oauth_states').delete({ count: 'exact' }).lt('expires_at', now.toISOString())
  );
  result.syncJobsDeleted = await deleteWithCount(
    supabase
      .from('account_sync_jobs')
      .delete({ count: 'exact' })
      .lt('created_at', addUtcDays(now, -90).toISOString())
      .in('status', ['completed', 'failed'])
  );

  const { data: policies, error: policiesError } = await supabase
    .from('business_data_policies')
    .select('*');

  if (policiesError) {
    throw policiesError;
  }

  for (const policy of (policies ?? []) as BusinessDataPolicy[]) {
    const { data: accounts, error: accountsError } = await supabase
      .from('ad_accounts')
      .select('id')
      .eq('business_id', policy.business_id);

    if (accountsError) {
      throw accountsError;
    }

    const adAccountIds = (accounts ?? []).map((account: { id: string }) => account.id);
    if (adAccountIds.length === 0) {
      continue;
    }

    result.businessesProcessed += 1;

    const dailyCutoff = toIsoDate(addUtcDays(now, -Math.max(1, policy.daily_history_days)));
    const hourlyCutoff = toIsoDate(addUtcDays(now, -Math.max(1, policy.hourly_history_days)));

    const { data: oldDailyRows, error: oldDailyError } = await supabase
      .from('ad_entity_performance_daily')
      .select(
        'entity_id, ad_account_id, entity_level, day, spend, impressions, reach, clicks, inline_link_clicks, leads, messages, calls'
      )
      .in('ad_account_id', adAccountIds)
      .lt('day', dailyCutoff);

    if (oldDailyError) {
      throw oldDailyError;
    }

    const entityMonthTotals = new Map<string, { row: DailyRow; totals: MetricTotals }>();
    const accountMonthTotals = new Map<string, { adAccountId: string; month: string; totals: MetricTotals }>();

    for (const row of (oldDailyRows ?? []) as DailyRow[]) {
      const month = monthStart(row.day);
      const entityKey = `${row.entity_id}::${month}`;
      const entityBucket = entityMonthTotals.get(entityKey) ?? {
        row,
        totals: zeroTotals(),
      };
      addRow(entityBucket.totals, row);
      entityMonthTotals.set(entityKey, entityBucket);

      if (row.entity_level === 'campaign') {
        const accountKey = `${row.ad_account_id}::${month}`;
        const accountBucket = accountMonthTotals.get(accountKey) ?? {
          adAccountId: row.ad_account_id,
          month,
          totals: zeroTotals(),
        };
        addRow(accountBucket.totals, row);
        accountMonthTotals.set(accountKey, accountBucket);
      }
    }

    const affectedEntityIds = Array.from(
      new Set(((oldDailyRows ?? []) as DailyRow[]).map((row) => row.entity_id))
    );
    const affectedMonths = Array.from(
      new Set(((oldDailyRows ?? []) as DailyRow[]).map((row) => monthStart(row.day)))
    );

    if (affectedEntityIds.length > 0 && affectedMonths.length > 0) {
      for (const entityIdsChunk of chunkArray(affectedEntityIds, 200)) {
        for (const monthsChunk of chunkArray(affectedMonths, 200)) {
          const { data: existingEntityMonthly, error: existingEntityMonthlyError } = await supabase
            .from('ad_entity_performance_monthly')
            .select(
              'entity_id, ad_account_id, entity_level, month_start, spend, impressions, reach, clicks, inline_link_clicks, leads, messages, calls'
            )
            .in('entity_id', entityIdsChunk)
            .in('month_start', monthsChunk);

          if (existingEntityMonthlyError) {
            throw existingEntityMonthlyError;
          }

          for (const row of (existingEntityMonthly ?? []) as MonthlyMetricRow[]) {
            if (!row.entity_id) {
              continue;
            }

            const bucket = entityMonthTotals.get(`${row.entity_id}::${row.month_start}`);
            if (bucket) {
              addMonthlyRow(bucket.totals, row);
            }
          }
        }
      }

      for (const adAccountIdsChunk of chunkArray(adAccountIds, 200)) {
        for (const monthsChunk of chunkArray(affectedMonths, 200)) {
          const { data: existingAccountMonthly, error: existingAccountMonthlyError } =
            await supabase
              .from('ad_account_performance_monthly')
              .select(
                'ad_account_id, month_start, spend, impressions, reach, clicks, inline_link_clicks, leads, messages, calls'
              )
              .in('ad_account_id', adAccountIdsChunk)
              .in('month_start', monthsChunk);

          if (existingAccountMonthlyError) {
            throw existingAccountMonthlyError;
          }

          for (const row of (existingAccountMonthly ?? []) as MonthlyMetricRow[]) {
            const bucket = accountMonthTotals.get(`${row.ad_account_id}::${row.month_start}`);
            if (bucket) {
              addMonthlyRow(bucket.totals, row);
            }
          }
        }
      }
    }

    const entityMonthlyRows = Array.from(entityMonthTotals.values()).map((bucket) => ({
      entity_id: bucket.row.entity_id,
      ad_account_id: bucket.row.ad_account_id,
      entity_level: bucket.row.entity_level,
      month_start: monthStart(bucket.row.day),
      ...metricsFromTotals(bucket.totals),
    }));
    const accountMonthlyRows = Array.from(accountMonthTotals.values()).map((bucket) => ({
      ad_account_id: bucket.adAccountId,
      month_start: bucket.month,
      ...metricsFromTotals(bucket.totals),
    }));

    if (entityMonthlyRows.length > 0) {
      const { error } = await supabase
        .from('ad_entity_performance_monthly')
        .upsert(entityMonthlyRows, { onConflict: 'entity_id,month_start' });
      if (error) {
        throw error;
      }
      result.entityMonthlyRows += entityMonthlyRows.length;
    }

    if (accountMonthlyRows.length > 0) {
      const { error } = await supabase
        .from('ad_account_performance_monthly')
        .upsert(accountMonthlyRows, { onConflict: 'ad_account_id,month_start' });
      if (error) {
        throw error;
      }
      result.accountMonthlyRows += accountMonthlyRows.length;
    }

    const snapshotRows = accountMonthlyRows.map((row) => ({
      business_id: policy.business_id,
      ad_account_id: row.ad_account_id,
      snapshot_type: 'pre_retention_rollup',
      period_start: row.month_start,
      period_end: toIsoDate(new Date(Date.UTC(Number(row.month_start.slice(0, 4)), Number(row.month_start.slice(5, 7)), 0))),
      summary_text: 'Detailed performance was summarized before retention cleanup.',
      key_metrics_json: row,
    }));

    if (snapshotRows.length > 0) {
      const { error } = await supabase.from('ad_account_intelligence_snapshots').insert(snapshotRows);
      if (error) {
        throw error;
      }
      result.snapshotsCreated += snapshotRows.length;
    }

    result.dailyRowsDeleted += await deleteWithCount(
      supabase
        .from('ad_entity_performance_daily')
        .delete({ count: 'exact' })
        .in('ad_account_id', adAccountIds)
        .lt('day', dailyCutoff)
    );

    if (affectedEntityIds.length > 0) {
      const affectedEntities: AdEntityRow[] = [];

      for (const idsChunk of chunkArray(affectedEntityIds, 200)) {
        const { data, error } = await supabase
          .from('ad_entities')
          .select('*')
          .in('id', idsChunk);

        if (error) {
          throw error;
        }

        affectedEntities.push(...((data ?? []) as AdEntityRow[]));
      }

      const refreshed = await refreshAdEntityPerformanceSummaries(supabase, {
        entities: affectedEntities,
        syncedAt: now.toISOString(),
      });
      result.summariesRefreshed += refreshed.count;
    }

    result.hourlyRowsDeleted += await deleteWithCount(
      supabase
        .from('ad_entity_performance_hourly')
        .delete({ count: 'exact' })
        .in('ad_account_id', adAccountIds)
        .lt('day', hourlyCutoff)
    );
  }

  return result;
}
