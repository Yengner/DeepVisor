/**
 * The audience segment worth naming under the "who" chart, from the same rows Reports charts.
 * Pure: no I/O. Missing values are skipped, never counted as zero.
 */
import { normalizeGender, type AudienceObservation } from '@/lib/shared/reports/audience';

export type AudienceTakeaway =
  | { basis: 'cost'; segment: string; costPerResult: number; results: number }
  | { basis: 'spend'; segment: string; spend: number; share: number };


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
