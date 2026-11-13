import { shiftDay } from '../overview/model';
import type { Insight } from '../../sync/resources/insightModel';
import { LEARNING_EVENTS, LEARNING_DAYS } from '../../../shared/performance/learning';

/**
 * Ad-set card signals derived from already-loaded daily insights. Pure: no I/O.
 *
 * Learning follows Meta's published guideline: an ad set generally exits the learning
 * phase after ~50 optimization events within 7 days of its last significant edit. When
 * Meta returns `learning_stage_info`, its status and event count are used as-is; otherwise
 * progress is an explicitly labeled estimate from reported results in the last 7 days.
 *
 * Health compares the ad set's last-7-day cost per result with a stated benchmark (the
 * business target, else the account's 30-day cost per result) and refuses to grade when
 * evidence is thin. It is a cost-efficiency signal, not a prediction or quality score.
 */
export { LEARNING_EVENTS, LEARNING_DAYS };

export type LearningSnapshot = { status: string | null; conversions: number | null; lastEditAt: string | null };
export type LearningProgress = {
  label: string;
  tone: 'complete' | 'learning' | 'limited' | 'unknown';
  percent: number | null;
  events: number | null;
  day: number | null;
  estimated: boolean;
};
export type HealthLabel = 'Strong' | 'On track' | 'Watch' | 'Needs attention' | 'Not enough data';
export type AdHealth = {
  label: HealthLabel;
  percent: number | null;
  costPerResult: number | null;
  benchmark: number | null;
  benchmarkSource: 'target' | 'account' | null;
};
export type AdSignals = { learning: LearningProgress; health: AdHealth };

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

/** Parse Meta's `learning_stage_info` defensively; anything unexpected becomes unknown. */
export function learningSnapshot(value: unknown): LearningSnapshot {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const status = typeof v.status === 'string' ? v.status.toUpperCase() : null;
  const conversions = finite(v.conversions) && v.conversions >= 0 ? v.conversions
    : typeof v.conversions === 'string' && /^\d+$/.test(v.conversions) ? Number(v.conversions) : null;
  const ts = finite(v.last_sig_edit_ts) ? v.last_sig_edit_ts : typeof v.last_sig_edit_ts === 'string' && /^\d+$/.test(v.last_sig_edit_ts) ? Number(v.last_sig_edit_ts) : null;
  return { status, conversions, lastEditAt: ts ? new Date(ts * 1000).toISOString() : null };
}

export function learningProgress(snapshot: LearningSnapshot | undefined, rows: Insight[], today: string, now: string): LearningProgress {
  const pct = (events: number) => Math.min(100, Math.round(events / LEARNING_EVENTS * 100));
  const status = snapshot?.status ?? null;
  if (status === 'SUCCESS') return { label: 'Learning complete', tone: 'complete', percent: 100, events: snapshot?.conversions ?? null, day: null, estimated: false };
  if (status === 'WAIVING') return { label: 'Learning not required', tone: 'complete', percent: 100, events: null, day: null, estimated: false };
  const day = snapshot?.lastEditAt
    ? Math.min(LEARNING_DAYS, Math.max(1, Math.floor((Date.parse(now) - Date.parse(snapshot.lastEditAt)) / 86400000) + 1))
    : null;
  if ((status === 'LEARNING' || status === 'FAIL') && snapshot?.conversions != null) {
    return { label: status === 'FAIL' ? 'Learning limited' : 'Learning', tone: status === 'FAIL' ? 'limited' : 'learning',
      percent: pct(snapshot.conversions), events: snapshot.conversions, day, estimated: false };
  }
  // Meta omitted learning info: estimate from reported results in the rolling 7-day window.
  const recent = totals(rows.filter(r => r.day >= shiftDay(today, -(LEARNING_DAYS - 1)) && r.day <= today));
  if (!recent) return { label: status === 'FAIL' ? 'Learning limited' : status === 'LEARNING' ? 'Learning' : 'Learning unavailable', tone: status === 'FAIL' ? 'limited' : status === 'LEARNING' ? 'learning' : 'unknown', percent: null, events: null, day, estimated: false };
  return {
    label: status === 'FAIL' ? 'Learning limited' : status === 'LEARNING' ? 'Learning'
      : recent.results >= LEARNING_EVENTS ? 'Likely out of learning' : 'Learning progress',
    tone: status === 'FAIL' ? 'limited' : recent.results >= LEARNING_EVENTS ? 'complete' : 'learning',
    percent: pct(recent.results), events: recent.results, day, estimated: true,
  };
}

export function adHealth(rows: Insight[], accountRows: Insight[], today: string, rawTarget: number | string | null): AdHealth {
  // Supabase returns numeric columns as strings.
  const target = rawTarget === null || rawTarget === '' ? null : Number(rawTarget);
  const recent = totals(rows.filter(r => r.day >= shiftDay(today, -6) && r.day <= today));
  const account = totals(accountRows.filter(r => r.day >= shiftDay(today, -29) && r.day <= today));
  const benchmark = finite(target) && target > 0 ? target
    : account && account.results >= 5 && account.spend > 0 ? account.spend / account.results : null;
  const benchmarkSource: AdHealth['benchmarkSource'] = finite(target) && target > 0 ? 'target' : benchmark !== null ? 'account' : null;
  const costPerResult = recent && recent.results > 0 ? recent.spend / recent.results : null;
  const thin = { label: 'Not enough data' as const, percent: null, costPerResult, benchmark, benchmarkSource };
  if (!recent || benchmark === null || recent.spend <= 0) return thin;
  // Require either a few results or enough spend that a result was clearly expected.
  if (recent.results < 3 && recent.spend < benchmark * 2) return thin;
  const ratio = recent.results === 0 ? Infinity : recent.spend / recent.results / benchmark;
  const label: HealthLabel = ratio <= 0.85 ? 'Strong' : ratio <= 1.15 ? 'On track' : ratio <= 1.4 ? 'Watch' : 'Needs attention';
  // Bar position: 0.5× benchmark (or better) fills the bar; 1.6× or worse empties it.
  const percent = Number.isFinite(ratio) ? Math.round(Math.min(1, Math.max(0, (1.6 - ratio) / 1.1)) * 100) : 0;
  return { label, percent, costPerResult, benchmark, benchmarkSource };
}

/** Signals per ad set (external Meta ID), across all publishers: learning and health are ad-set wide. */
export function adSetSignals(
  daily: Insight[] | null,
  ids: string[],
  learning: Record<string, LearningSnapshot>,
  today: string,
  now: string,
  target: number | string | null,
): Record<string, AdSignals> {
  const rows = daily ?? [];
  return Object.fromEntries(ids.map(id => {
    const own = rows.filter(r => r.externalId === id);
    return [id, { learning: learningProgress(learning[id], own, today, now), health: adHealth(own, rows, today, target) }];
  }));
}
