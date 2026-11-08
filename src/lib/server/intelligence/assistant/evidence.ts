import { asRecord } from '@/lib/shared/utils/format';
import type { AssistantReply } from '@/lib/shared/assistant/contracts';
import type { AnalyticsBlock } from '@/lib/shared/assistant/analytics';
export type Observation = { id: string; text: string; tone: 'favorable' | 'unfavorable' | 'neutral' };
export type EvidenceSource = { id: string; title: string; facts: Record<string, unknown>; observations: Observation[]; block: AnalyticsBlock; details: string[]; creativeIds: string[] };
const labels = { spend: 'Spend', conversion: 'Results', costPerResult: 'Cost per result', ctr: 'CTR' };
const numeric = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
function format(value: unknown, metric: string, currency: unknown) {
  if (!numeric(value)) return 'Unavailable';
  if (metric === 'ctr') return `${value.toFixed(2)}%`;
  if (['spend', 'costPerResult', 'cpc', 'cpm'].includes(metric)) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency), maximumFractionDigits: 2 }).format(value); } catch { return 'Currency unavailable'; }
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** Describes only already-gated backend comparisons. It never computes new deltas or health thresholds. */
export function makeEvidence(id: string, raw: unknown, period?: string): EvidenceSource {
  const data = asRecord(raw), range = asRecord(data.range), metrics = asRecord(data.metrics), changes = asRecord(data.changes);
  const baseline = asRecord(data.baseline), previous = asRecord(baseline.range), coverage = asRecord(data.coverage);
  const baselineMetrics = asRecord(period === 'today' ? baseline.dailyAverages : baseline.totals);
  const title = data.snapshotCoverage ? `Audience snapshot · ${range.dateFrom}–${range.dateTo}` : period === 'today' ? 'Today so far' : period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'Selected period';
  const observations: Observation[] = [];
  const items = Object.entries(labels).map(([key, label]) => {
    const rawChange = asRecord(changes[key]);
    const direction = rawChange.direction;
    const change = numeric(rawChange.value) && ['favorable', 'unfavorable', 'neutral'].includes(String(direction))
      ? { value: rawChange.value, unit: rawChange.unit === 'pp' ? 'pp' : '%', direction: direction as Observation['tone'] } : null;
    if (change && key !== 'spend') observations.push({ id: `${id}:${key}`, text: `${title}: ${label.toLowerCase()} ${change.value === 0 ? 'is unchanged' : `is ${Math.abs(change.value).toFixed(1)}${change.unit === 'pp' ? ' percentage points' : '%'} ${change.value < 0 ? 'lower' : 'higher'}`} than ${period === 'today' ? 'the previous seven completed days’ daily baseline (preliminary)' : 'the previous comparable period'}.`, tone: change.direction });
    const resultLabel = metrics.messages === metrics.conversion && numeric(metrics.messages) && metrics.messages > 0 && metrics.leads === 0 && metrics.calls === 0 ? 'Messaging conversations' : metrics.leads === metrics.conversion && numeric(metrics.leads) && metrics.leads > 0 && metrics.messages === 0 && metrics.calls === 0 ? 'Leads' : 'Reported results';
    return { key, label: key === 'conversion' ? resultLabel : label, value: format(metrics[key], key, data.currency), change, baseline: format(baselineMetrics[key], key, data.currency) };
  });
  const unavailable = typeof data.unavailable === 'string' ? data.unavailable : null;
  const limitations: string[] = [];
  if (typeof data.coverageNotice === 'string') limitations.push(data.coverageNotice);
  if (unavailable) limitations.push(unavailable);
  if (data.stale === true) limitations.push('The saved numbers are not fresh enough for a reliable performance comparison.');
  if (coverage.complete === false) limitations.push('Some daily observations are missing, so these are recorded totals rather than a complete picture.');
  if (asRecord(data.baselineCoverage).complete === false) limitations.push('There is not enough complete history to establish the usual baseline.');
  limitations.forEach((text, i) => observations.push({ id: `${id}:limitation${i}`, text, tone: 'neutral' }));
  const details = [
    `Period: ${range.dateFrom ?? 'Unknown'}–${range.dateTo ?? 'Unknown'}${range.partial ? ' (includes incomplete today)' : ''}`,
    `Scope: ${data.platform ?? 'combined'} · ${data.currency ?? 'currency unknown'} · ${data.timezone ?? 'timezone unknown'}`,
    `Source: ${data.source ?? 'Stored account data'}`,
    `Last updated: ${data.observedAt ?? 'Unknown'}`,
    `Coverage: ${coverage.observedDays ?? 'Unknown'} of ${coverage.expectedDays ?? 'unknown'} days; ${coverage.complete ? 'complete observed entity-days' : 'completeness not established'}`,
    `Baseline: ${previous.dateFrom ?? 'Unavailable'}–${previous.dateTo ?? 'unavailable'}${period === 'today' ? ', daily average of seven completed days; ratios use aggregate numerators and denominators' : ', preceding non-overlapping period'}`,
    String(data.resultDefinition ?? ''), String(data.limitation ?? ''), ...limitations,
  ].filter(Boolean);
  const daily = Array.isArray(data.daily) ? data.daily.map(row => { const p = asRecord(row); return { day: String(p.day), value: numeric(p.spend) ? p.spend : null, results: numeric(p.conversion) ? p.conversion : null }; }) : [];
  const ranks: Record<string, unknown>[] = Array.isArray(data.rankings) ? data.rankings.map(asRecord) : Array.isArray(data.breakdown) ? data.breakdown.map(row => { const r=asRecord(row); return {...r, id:r.key, name:r.label}; }) : [];
  const block: AnalyticsBlock = { currency: typeof data.currency === 'string' ? data.currency : null, status: limitations.slice(0, 2).join(' ') || (range.partial ? 'Includes today’s incomplete data.' : undefined), title, scope: details[0], note: details.join('\n'), items: ranks.length ? ranks.slice(0, 5).map(row => ({ key: String(row.id), label: String(row.name ?? row.externalId ?? 'Saved ad'), value: format(row.value, String(data.metric), data.currency), change: null })) : items, trend: daily, trendLabel: 'Daily spend', baselineLabel: period === 'today' ? 'Usual daily average' : 'Previous period' };
  return { id, title, observations, block, details, creativeIds: ranks.flatMap(r => typeof r.creativeId === 'string' ? [r.creativeId] : []), facts: { snapshotCoverage: data.snapshotCoverage, requestedRange: data.requestedRange, range, currency: data.currency, platform: data.platform, observedAt: data.observedAt, stale: data.stale, coverage: data.coverage, baselineCoverage: data.baselineCoverage, metrics, changes, baseline, limitations, resultDefinition: data.resultDefinition, rankingMetric: data.metric, rankings: ranks, delivery: data.delivery } };
}
export function resolveEvidence(reply: AssistantReply, sources: EvidenceSource[], compact = false) {
  const source = (id: string) => { const found = sources.find(s => s.id === id); if (!found) throw new Error('Unknown evidence source.'); return found; };
  const observations = sources.flatMap(s => s.observations);
  const insights = reply.insights.map(id => { const found = observations.find(o => o.id === id); if (!found) throw new Error('Unknown evidence observation.'); return found; }).filter(observation => !observation.id.includes(':limitation'));
  const visuals = reply.visuals.map(v => {
    const selected = source(v.sourceId);
    if (v.kind === 'trend' && selected.block.trend.length < 2) throw new Error('Trend evidence unavailable.');
    if (v.kind === 'ranking' && (!Array.isArray(selected.facts.rankings) || !selected.facts.rankings.length)) throw new Error('Ranking evidence unavailable.');
    if (v.kind === 'creative' && !selected.creativeIds.length) throw new Error('Creative evidence unavailable.');
    return { ...selected.block, kind: selected.facts.snapshotCoverage ? 'ranking' as const : v.kind, items: selected.facts.snapshotCoverage || v.kind === 'ranking' || v.kind === 'creative' ? selected.block.items : selected.block.items.filter(item => (v.kind === 'kpis' ? ['conversion', 'spend', 'costPerResult'] : v.metrics).includes(item.key as typeof v.metrics[number])) };
  });
  reply.metadata.forEach(source);
  const performance = visuals.find(v => v.kind === 'kpis' || v.kind === 'trend');
  const summary = compact && performance ? (insights[0]?.text ?? `${performance.title}: here are your recorded results and costs.${performance.trend.length > 1 ? ' Switch the chart to explore daily delivery.' : ''}`) : undefined;
  return { ...(summary ? { summary } : {}), visuals, insights: compact ? insights.filter(i => i.text !== summary).slice(0, 1) : insights, suggestedFollowUps: reply.suggestedFollowUps, metadata: sources.map(s => ({ id: s.id, title: s.title, details: s.details })) };
}
