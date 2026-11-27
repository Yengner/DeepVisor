import { shiftDay } from '../overview/model';
import type { Insight } from '../../sync/resources/insightModel';

/**
 * Ad-set card signals. Pure: no I/O.
 *
 * Learning is only what Meta reports in `learning_stage_info`. When Meta sends no status there is
 * nothing to show: result counts and the age of an ad set cannot tell whether it finished
 * learning, so no progress, completion or "limited" state is estimated.
 *
 * Health compares the ad set's last-7-day cost per result with a stated benchmark: the business
 * target, else the account's cost per result over the 30 days *before* that week. The windows
 * never overlap, so the week being judged is not part of its own baseline. The baseline window
 * and how many of its days have data are returned so the UI can name them. Health refuses to
 * grade when evidence is thin. It is a cost-efficiency signal, not a prediction or quality score.
 */
/** A status Meta reported that is worth attention. Finished, waived and unreported show nothing. */
export type LearningStatus = {
  label: 'Learning' | 'Learning limited';
  tone: 'learning' | 'limited';
  /** When DeepVisor read it from Meta, already formatted for the account's timezone. */
  checkedAt: string | null;
};
export type HealthLabel = 'Strong' | 'On track' | 'Watch' | 'Needs attention' | 'Not enough data';
export type AdHealth = {
  label: HealthLabel;
  percent: number | null;
  costPerResult: number | null;
  benchmark: number | null;
  benchmarkSource: 'target' | 'account' | null;
  /** The account baseline window (benchmarkSource 'account' only). */
  benchmarkWindow: { since: string; until: string; days: number; observedDays: number } | null;
};
/** The baseline covers the 30 days before the ad set's 7-day window. */
export const HEALTH_WINDOW_DAYS = 7, BASELINE_DAYS = 30;
export type AdSignals = { learning: LearningStatus | null; health: AdHealth };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const totals = (rows: Insight[]) => {
  let spend = 0, results = 0, complete = rows.length > 0;
  for (const r of rows) {
    if (!finite(r.spend) || r.leads === null || r.messages === null || r.calls === null) { complete = false; continue; }
    spend += r.spend;
    results += r.leads + r.messages + r.calls;
  }
  return complete ? { spend, results } : null;
};

/** `label` comes from `learningLabel`, the same for live and saved Meta reads. */
export function reportedLearning(label: string | undefined, checkedAt: string | null): LearningStatus | null {
  if (label === 'Learning') return { label, tone: 'learning', checkedAt };
  if (label === 'Learning limited') return { label, tone: 'limited', checkedAt };
  return null;
}

export function adHealth(rows: Insight[], accountRows: Insight[], today: string, rawTarget: number | string | null): AdHealth {
  // Supabase returns numeric columns as strings.
  const target = rawTarget === null || rawTarget === '' ? null : Number(rawTarget);
  const recentSince = shiftDay(today, -(HEALTH_WINDOW_DAYS - 1));
  const recent = totals(rows.filter(r => r.day >= recentSince && r.day <= today));
  const window = { since: shiftDay(recentSince, -BASELINE_DAYS), until: shiftDay(recentSince, -1) };
  const baselineRows = accountRows.filter(r => r.day >= window.since && r.day <= window.until);
  const account = totals(baselineRows);
  const hasTarget = finite(target) && target > 0;
  const benchmark = hasTarget ? target
    : account && account.results >= 5 && account.spend > 0 ? account.spend / account.results : null;
  const benchmarkSource: AdHealth['benchmarkSource'] = hasTarget ? 'target' : benchmark !== null ? 'account' : null;
  const benchmarkWindow = benchmarkSource === 'account' ? { ...window, days: BASELINE_DAYS, observedDays: new Set(baselineRows.map(r => r.day)).size } : null;
  const costPerResult = recent && recent.results > 0 ? recent.spend / recent.results : null;
  const thin = { label: 'Not enough data' as const, percent: null, costPerResult, benchmark, benchmarkSource, benchmarkWindow };
  if (!recent || benchmark === null || recent.spend <= 0) return thin;
  // Require either a few results or enough spend that a result was clearly expected.
  if (recent.results < 3 && recent.spend < benchmark * 2) return thin;
  const ratio = recent.results === 0 ? Infinity : recent.spend / recent.results / benchmark;
  const label: HealthLabel = ratio <= 0.85 ? 'Strong' : ratio <= 1.15 ? 'On track' : ratio <= 1.4 ? 'Watch' : 'Needs attention';
  // Kept for callers that still want a position; the dashboard shows the comparison as text.
  const percent = Number.isFinite(ratio) ? Math.round(Math.min(1, Math.max(0, (1.6 - ratio) / 1.1)) * 100) : 0;
  return { label, percent, costPerResult, benchmark, benchmarkSource, benchmarkWindow };
}

/** Signals per ad set (external Meta ID), across all publishers: learning and health are ad-set wide. */
export function adSetSignals(
  daily: Insight[] | null,
  ids: string[],
  learning: Record<string, string>,
  learningCheckedAt: string | null,
  today: string,
  target: number | string | null,
): Record<string, AdSignals> {
  const rows = daily ?? [];
  return Object.fromEntries(ids.map(id => {
    const own = rows.filter(r => r.externalId === id);
    return [id, { learning: reportedLearning(learning[id], learningCheckedAt), health: adHealth(own, rows, today, target) }];
  }));
}
