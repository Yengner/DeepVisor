import type {Presentation,Recap,SavedPresentation} from './model';
import {shiftReportDay} from '@/lib/shared/reports/dates';

/** Meta's numbers for a day mostly settle within a week; older recaps are not re-checked. */
export const REVISION_WINDOW_DAYS = 7;
/** Spend must move by both of these to count as a correction worth showing. */
export const SPEND_MIN_CHANGE = 1, SPEND_MIN_RATIO = 0.05;

export type RecapChange = { material: boolean; results: boolean };

/**
 * Whether a recalculated recap differs from the one the owner last saw by an amount a person
 * would care about: any change in reported results, or spend moving by at least 5% and $1.
 * Cent-level attribution drift, extra hourly buckets and re-rounded ratios are ignored.
 */
export function recapChange(shown: Recap, next: Recap): RecapChange {
 const results = shown.results !== next.results && (shown.results !== null || next.results !== null);
 let spend = false;
 if (shown.spend === null || next.spend === null) spend = shown.spend !== next.spend;
 else {
  const diff = Math.abs(next.spend - shown.spend);
  spend = diff >= SPEND_MIN_CHANGE && diff >= Math.abs(shown.spend) * SPEND_MIN_RATIO;
 }
 return { material: results || spend, results };
}

/** Recaps whose last day is more than REVISION_WINDOW_DAYS before today are settled. */
export const revisable = (recap: Recap, today: string | null): boolean =>
 Boolean(today && recap.until && recap.until >= shiftReportDay(today, -REVISION_WINDOW_DAYS));

/**
 * The correction for an original report. `shown` is what the owner last saw (the original, or its
 * single existing revision). The original is never changed; there is at most one revision, which
 * a later correction updates instead of stacking another report.
 */
export function recapRevision(original: SavedPresentation, shown: SavedPresentation, recap: Recap, syncedAt: string | null, now: string): Presentation | null {
 if (!shown.payload.recap || !recapChange(shown.payload.recap, recap).material) return null;
 return { ...original.payload, revisionOf: original.id, preparedAt: now, syncedAt, recap,
  limitations: [...original.payload.limitations.filter(t => !t.startsWith('Revised from saved update')), `Revised from saved update ${original.id}. The original remains in history.`] };
}
