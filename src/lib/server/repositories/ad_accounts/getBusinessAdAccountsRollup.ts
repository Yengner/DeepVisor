import { createSupabaseClient } from '@/lib/server/supabase/server';
import type { BusinessAdAccountRollup } from '../types';
import { parseAggregatedMetrics, sumAggregatedMetrics } from './normalizers';

function latestIso(current: string | null, candidate: string | null): string | null {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

/**
 * Aggregates ad-account metrics for all ad accounts in a business.
 */
export async function getBusinessAdAccountsRollup(
  businessId: string
): Promise<BusinessAdAccountRollup> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('ad_accounts')
    .select('id, platform_id, external_account_id, name, status, aggregated_metrics, last_synced')
    .eq('business_id', businessId);

  if (error) {
    console.error('Error fetching business ad-account rollup:', error.message);

    return {
      businessId,
      accountCount: 0,
      activeAccountCount: 0,
      syncedAccountCount: 0,
      lastSyncedAt: null,
      totals: sumAggregatedMetrics([]),
      accounts: [],
    };
  }

  let lastSyncedAt: string | null = null;

  const accounts = (data ?? []).map((row) => {
    const metrics = parseAggregatedMetrics(row.aggregated_metrics);
    lastSyncedAt = latestIso(lastSyncedAt, row.last_synced);

    return {
      id: row.id,
      platform_id: row.platform_id,
      external_account_id: row.external_account_id,
      name: row.name,
      status: row.status,
      last_synced: row.last_synced,
      aggregated_metrics: metrics,
      performance_summary: metrics,
    };
  });

  const totals = sumAggregatedMetrics(accounts.map((account) => account.aggregated_metrics));

  return {
    businessId,
    accountCount: accounts.length,
    activeAccountCount: accounts.filter((account) =>
      String(account.status ?? '').toLowerCase().includes('active')
    ).length,
    syncedAccountCount: accounts.filter((account) => Boolean(account.last_synced)).length,
    lastSyncedAt,
    totals,
    accounts,
  };
}
