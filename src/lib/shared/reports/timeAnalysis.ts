import type { ReportSurfaceContext } from '@/lib/server/reports/types';
import type { PerformanceMetric } from './performance';
import { moneyMetrics } from './breakdowns';
import { isReportDate } from './dates';
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function buildTimeAnalysis(surface: ReportSurfaceContext, metric: PerformanceMetric, mode: 'total' | 'average', currency: string | null) {
  return Array.from({ length: 168 }, (_, index) => {
    const day = Math.floor(index / 24), hour = index % 24;
    const points = surface.hourlyTrendExpanded.filter(p => p.dayKey && isReportDate(p.dayKey) && p.hourOfDay === hour &&
      (new Date(`${p.dayKey}T12:00:00Z`).getUTCDay() + 6) % 7 === day);
    const dates = [...new Set(points.map(p => p.dayKey!))].sort();
    const sum = (key: 'spend' | 'impressions' | 'clicks' | 'inlineLinkClicks' | 'results') => points.every(p => Number.isFinite(p[key])) ? points.reduce((s, p) => s + p[key], 0) : null;
    const spend = sum('spend'), impressions = sum('impressions'), clicks = sum('clicks'), results = sum('results'), links = sum('inlineLinkClicks');
    const ratio = (a: number | null, b: number | null, multiplier = 1) => a != null && b != null && b > 0 ? a / b * multiplier : null;
    let value = metric === 'ctr' ? ratio(clicks, impressions, 100) : metric === 'cpc' ? ratio(spend, clicks) : metric === 'cpm' ? ratio(spend, impressions, 1000) : metric === 'costPerResult' ? ratio(spend, results)
      : metric === 'conversion' ? results : metric === 'linkClicks' ? links : metric === 'spend' ? spend : metric === 'impressions' ? impressions : clicks;
    if (!points.length || surface.unavailableMetrics?.hourly?.[metric] || (moneyMetrics.has(metric) && (!currency || currency === 'MIXED'))) value = null;
    const isRatio = ['ctr', 'cpc', 'cpm', 'costPerResult'].includes(metric);
    if (value != null && mode === 'average' && !isRatio) value /= dates.length;
    return { key: `${day}:${hour}`, day, hour, dates, observations: dates.length, value, isRatio };
  });
}
