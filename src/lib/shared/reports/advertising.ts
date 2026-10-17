import type { ReportBreakdownRow, ReportMetricKey, ReportPayload } from '@/lib/server/reports/types';
import { moneyMetrics } from './breakdowns';
import { reportMetricValue } from './metrics';
export function advertisingGroups(payload: ReportPayload) {
  return [
    { key: 'selection', label: payload.breakdown.title, context: 'Selected scope', rows: payload.breakdown.rows },
    { key: 'campaigns', label: 'Campaigns in selected accounts', context: 'Account context', rows: payload.ranking.topAdAccountCampaigns },
    { key: 'sibling-sets', label: 'Ad sets in selected campaign', context: 'Campaign context', rows: payload.ranking.sameCampaignAdsets },
    { key: 'sets', label: 'Ad sets in selected accounts', context: 'Account context', rows: payload.ranking.topAdAccountAdsets },
    { key: 'sibling-ads', label: 'Ads in selected ad set', context: 'Ad-set context', rows: payload.ranking.sameAdsetAds },
    { key: 'ads', label: 'Ads in selected accounts', context: 'Account context', rows: payload.ranking.topAdAccountAds },
  ].filter(group => group.key === 'selection' || group.rows.length > 0);
}
export function advertisingMetricValue(row: ReportBreakdownRow, metric: ReportMetricKey, currency: string | null) {
  return moneyMetrics.has(metric) && (!currency || currency === 'MIXED') ? null : reportMetricValue(row, metric);
}
export function sortAdvertising(rows: ReportBreakdownRow[], metric: ReportMetricKey, ascending: boolean, search: string, currency: string | null) {
  return [...new Map(rows.map(row => [`${row.level}:${row.id}`, row])).values()]
    .filter(row => `${row.name} ${row.primaryContext ?? ''} ${row.secondaryContext ?? ''}`.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => {
      const av = advertisingMetricValue(a, metric, currency), bv = advertisingMetricValue(b, metric, currency);
      if (av == null || bv == null) return av == null ? bv == null ? a.name.localeCompare(b.name) : 1 : -1;
      return (ascending ? av - bv : bv - av) || a.name.localeCompare(b.name);
    });
}
export function reportDrilldownHref(href: string | null | undefined, demo: boolean) {
  if (!href?.startsWith('/') || href.startsWith('//')) return null;
  const url = new URL(href, 'https://deepvisor.invalid');
  if (demo) url.searchParams.set('demo', '1');
  if (url.pathname === '/reports') url.hash = 'advertising';
  return `${url.pathname}${url.search}${url.hash}`;
}
