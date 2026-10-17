import type { TrendFindingView } from '@/lib/server/intelligence/types';
import { isReportDate } from './dates';
export function findingEvidence(finding: TrendFindingView) {
  const snapshot = finding.metricSnapshot;
  const from = snapshot.periodStart, to = snapshot.periodEnd;
  const window = from && to && isReportDate(from) && isReportDate(to) && from <= to ? `${from} – ${to}` : 'Measurement window unknown';
  const definitions = [['spend', 'Spend'], ['results', 'Results'], ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['linkClicks', 'Link clicks'], ['ctr', 'CTR'], ['cpc', 'CPC'], ['cpm', 'CPM'], ['costPerResult', 'Cost per result'], ['occurrenceCount', 'Occurrences']] as const;
  return { window, metrics: definitions.flatMap(([key, label]) => typeof snapshot[key] === 'number' && Number.isFinite(snapshot[key]) ? [{ key, label, value: snapshot[key] as number }] : []) };
}
export function filterFindings(findings: TrendFindingView[], severity: string, status: string) {
  return findings.filter(f => (severity === 'all' || f.severity === severity) && (status === 'all' || f.status === status))
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || a.id.localeCompare(b.id));
}
