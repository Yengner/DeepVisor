/**
 * One-line takeaways for Overview, from the same audience and hourly rows Reports charts.
 * Pure: no I/O. Missing values are skipped, never counted as zero.
 */
import { normalizeGender, type AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';

export type AudienceTakeaway =
  | { basis: 'cost'; segment: string; costPerResult: number; results: number }
  | { basis: 'spend'; segment: string; spend: number; share: number };

export type HourTakeaway = { basis: 'results' | 'spend'; hour: number; share: number };

/** Segments need at least this many results before a cost per result is worth naming. */
const MIN_RESULTS = 2;

function segmentName(gender: string, age: string) {
  const g = normalizeGender(gender);
  const who = g === 'Female' ? 'Women' : g === 'Male' ? 'Men' : 'People';
  return `${who} ${age.trim().replace('-', '–')}`;
}

/** Lowest cost per result among segments with enough results; otherwise the biggest spender. */
export function audienceTakeaway(rows: readonly AudienceObservation[] | null): AudienceTakeaway | null {
  if (!rows?.length) return null;
  const segments = new Map<string, { spend: number; results: number | null }>();
  for (const row of rows) {
    const key = segmentName(row.gender, row.age);
    const seg = segments.get(key) ?? { spend: 0, results: 0 };
    seg.spend += row.values.spend ?? 0;
    seg.results = seg.results === null || row.values.conversion == null ? null : seg.results + row.values.conversion;
    segments.set(key, seg);
  }
  const spending = [...segments].filter(([, v]) => v.spend > 0);
  const total = spending.reduce((sum, [, v]) => sum + v.spend, 0);
  if (!total) return null;
  const efficient = spending
    .filter(([, v]) => (v.results ?? 0) >= MIN_RESULTS)
    .sort((a, b) => a[1].spend / a[1].results! - b[1].spend / b[1].results!)[0];
  if (efficient) return { basis: 'cost', segment: efficient[0], costPerResult: efficient[1].spend / efficient[1].results!, results: efficient[1].results! };
  const [segment, top] = spending.sort((a, b) => b[1].spend - a[1].spend)[0];
  return { basis: 'spend', segment, spend: top.spend, share: top.spend / total };
}

/** The hour of day with the most results (or, without enough results, the most spend). */
export function hourTakeaway(rows: readonly HourlyObservation[] | null): HourTakeaway | null {
  if (!rows?.length) return null;
  const pick = (key: 'results' | 'spend') => {
    const byHour = new Map<number, number>();
    let total = 0;
    for (const row of rows) {
      const value = row[key];
      if (row.hourOfDay === null || value === null || !Number.isFinite(value)) continue;
      byHour.set(row.hourOfDay, (byHour.get(row.hourOfDay) ?? 0) + value);
      total += value;
    }
    const best = [...byHour].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    return best && total > 0 ? { hour: best[0], share: best[1] / total, total } : null;
  };
  const results = pick('results');
  if (results && results.total >= MIN_RESULTS) return { basis: 'results', hour: results.hour, share: results.share };
  const spend = pick('spend');
  return spend ? { basis: 'spend', hour: spend.hour, share: spend.share } : null;
}
