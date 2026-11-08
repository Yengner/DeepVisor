import { delta } from '../../campaigns/exploration/model';
import { periodRange, shiftDay } from '../overview/model';
import { aggregate, type Insight, type Publisher } from './model';
import type { Period } from '../overview/types';
import type { ControlPerformance } from '../overview/controlModel';

type ComparisonOptions = { timezone?: string; cutoff?: string };
/** Fail closed for invalid configuration or an account-local date rollover. */
export function todayEligible(today: string, now: string, fetchedAt: string, options: ComparisonOptions) {
  const cutoff = options.cutoff ?? '20:00';
  if (!options.timezone || !/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) return false;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: options.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const local = (at: string) => Object.fromEntries(formatter.formatToParts(new Date(at)).map(p => [p.type, p.value]));
    const current = local(now), retrieved = local(fetchedAt);
    const day = (p: Record<string, string>) => `${p.year}-${p.month}-${p.day}`;
    return day(current) === today && day(retrieved) === today && `${current.hour}:${current.minute}` >= cutoff;
  } catch { return false; }
}

/** Daily delivery totals only. Never combine hourly/demographic rows with this source. */
export function comparisons(rows: Insight[], platform: Publisher, period: Period, today: string, currency: string | null, fetchedAt: string, now: string, options: ComparisonOptions = {}): Pick<ControlPerformance, 'deltas' | 'comparison'> {
  const unavailable = (comparison: string) => ({ deltas: {}, comparison });
  const range = periodRange(period, today);
  if (period === 'today' && !todayEligible(today, now, fetchedAt, options)) return unavailable('Today comparison is not yet eligible.');
  const age = Date.parse(now) - Date.parse(fetchedAt);
  if (!Number.isFinite(age) || age < 0 || age > 600000) return unavailable('Comparison unavailable: recent Meta data is required.');
  const days = period === '30d' ? 30 : 7;
  const previous = { since: shiftDay(range.since, -days), until: shiftDay(range.since, -1) };
  const scoped = rows.filter(r => (platform === 'combined' || r.publisher === platform) && r.day >= previous.since && r.day <= today);
  // Ambiguous duplicate observations must not inflate either period.
  const keys = scoped.map(r => `${r.day}:${r.publisher}:${r.entity_id}`);
  if (new Set(keys).size !== keys.length) return unavailable('Comparison unavailable: overlapping daily observations.');
  const window = (since: string, until: string) => scoped.filter(r => r.day >= since && r.day <= until);
  const covered = (since: string, until: string) => {
    for (let day = since; day <= until; day = shiftDay(day, 1)) {
      const observations = window(day, day);
      if (!observations.length || observations.some(r => r.currency_code !== currency)) return false;
    }
    return Boolean(currency);
  };
  if (!covered(range.since, today) || !covered(previous.since, previous.until)) return unavailable('Comparison unavailable: daily coverage is incomplete for this platform or currency. Missing days are not zero.');
  const current = aggregate(window(range.since, today), currency);
  const baseline = aggregate(window(previous.since, previous.until), currency);
  const deltas: ControlPerformance['deltas'] = {};
  for (const key of ['spend', 'results', 'costPerResult', 'ctr'] as const) {
    const previousValue = period === 'today' && (key === 'spend' || key === 'results') && baseline[key] !== null ? baseline[key]! / 7 : baseline[key];
    const change = delta(key, current[key], previousValue);
    if (change) deltas[key] = change;
  }
  if (period === 'today') return { deltas, comparison: `Preliminary · Today (${today}) in ${options.timezone} vs the average daily performance of seven completed calendar days, ${previous.since}–${previous.until}, excluding today. Today's reporting is incomplete. Spend and Results use daily averages; cost per result and CTR use baseline aggregate ratios. CTR change is in percentage points.` };
  return { deltas, comparison: `${range.since}–${today} vs ${previous.since}–${previous.until} (${days} days each). Includes partial today; the previous period contains completed days. CTR change is in percentage points. Unknown metrics and zero percentage baselines are omitted. Spend direction is neutral.` };
}
