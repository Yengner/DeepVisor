import type { AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import { aggregate, type Insight } from './model';

/** Keep source dates and dimensions intact until the selected chart aggregates them. */
export function audienceObservations(rows: Insight[]): AudienceObservation[] {
  return rows.map(row => {
    const metrics = aggregate([row], row.currency_code);
    const [age = '', gender = ''] = row.label.split(' · ');
    return { date: row.day, age, gender, currencyCode: row.currency_code,
      values: { spend: metrics.spend, impressions: metrics.impressions, clicks: metrics.clicks, conversion: metrics.results } };
  });
}
export function hourlyObservations(rows: Insight[]): HourlyObservation[] {
  return rows.flatMap(row => {
    const match = row.label.match(/^(\d{2}):00:00\s*-\s*(\d{2}):59:59$/);
    if (!match || match[1] !== match[2] || Number(match[1]) > 23) return [];
    return [{ dayKey: row.day, hourOfDay: Number(match[1]), spend: row.spend, impressions: row.impressions,
      clicks: row.clicks, results: null, inlineLinkClicks: null }];
  });
}
