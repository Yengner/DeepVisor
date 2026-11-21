'use client';
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReportCoverage, ReportMetricKey, ReportMetricTotals } from '@/lib/server/reports/types';
import { isReportDate } from '@/lib/shared/reports/dates';
import { reportMetricValue } from '@/lib/shared/reports/metrics';
import { segmentLabel } from '@/lib/shared/reports/labels';
import type { PerformanceMetric } from '@/lib/shared/reports/performance';
import type { ComparisonBasis } from '@/lib/shared/reports/comparison';

const MONETARY = new Set(['spend', 'costPerResult', 'cpc', 'cpm', 'cpl']);
const WEEKDAY_BASE = Date.UTC(2024, 0, 1); // a Monday

/**
 * Report labels, numbers, dates and hours in the reader's language. Mirrors the English helpers in
 * lib/shared/reports (labels, metrics, performance, coverage) so the server-side exports keep theirs.
 */
export function useReportFormat() {
  const t = useTranslations('reports');
  const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
  return useMemo(() => {
    const dayFormat = new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const dayNoYear = new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    let regions: Intl.DisplayNames | null = null;
    try { regions = new Intl.DisplayNames([intl], { type: 'region' }); } catch { regions = null; }
    const day = (iso: string | null | undefined, withYear = true) => !iso || !isReportDate(iso) ? t('unknown')
      : (withYear ? dayFormat : dayNoYear).format(new Date(`${iso}T12:00:00Z`));
    const range = (from: string | null | undefined, to: string | null | undefined) => {
      if (!from || !to || !isReportDate(from) || !isReportDate(to)) return t('unknownDates');
      if (from === to) return day(from);
      return `${day(from, from.slice(0, 4) !== to.slice(0, 4))} – ${day(to)}`;
    };
    const number = (value: number, digits = 2) => value.toLocaleString(intl, { maximumFractionDigits: digits });
    const money = (value: number, currency: string) => new Intl.NumberFormat(intl, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
    const metric = (key: ReportMetricKey | PerformanceMetric | 'reach' | 'frequency') => t.has(`metric.${key}` as never) ? t(`metric.${key}` as never) : String(key);
    return {
      t,
      intl,
      day,
      range,
      number,
      metric,
      /** Report totals cell ("$315.96", "5.08%", "—"). */
      value: (totals: ReportMetricTotals, key: ReportMetricKey, currency: string | null) => {
        const value = reportMetricValue(totals, key);
        if (value == null || (MONETARY.has(key) && (!currency || currency === 'MIXED'))) return '—';
        if (MONETARY.has(key)) return money(value, currency!);
        if (key === 'ctr' || key === 'conversionRate') return `${number(value)}%`;
        return number(value);
      },
      /** Chart and table values; "Unavailable" when missing or the currency is unknown. */
      perf: (value: number | null, key: PerformanceMetric, currency: string | null) => {
        if (value == null) return t('unavailable');
        if (MONETARY.has(key)) return !currency || currency === 'MIXED' ? t('unavailable') : money(value, currency);
        return key === 'ctr' ? `${value.toFixed(2)}%` : number(value);
      },
      snapshot: (window: string) => {
        const [from, to] = window.split(' / ');
        return from && to && isReportDate(from) && isReportDate(to) ? range(from, to) : t('datesUnknown');
      },
      zone: (timezone: string | null | undefined) => {
        const city = timezone?.split('/').at(-1)?.replaceAll('_', ' ');
        return city ? t('zone', { city }) : t('zoneUnknown');
      },
      hour: (h: number) => new Intl.DateTimeFormat(intl, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, ((h % 24) + 24) % 24))),
      /** 0 = Monday … 6 = Sunday, matching lib/shared/reports/timeAnalysis WEEKDAYS. */
      weekday: (index: number, style: 'long' | 'short' = 'long') => new Intl.DateTimeFormat(intl, { weekday: style, timeZone: 'UTC' }).format(new Date(WEEKDAY_BASE + index * 86_400_000)),
      /** Breakdown segment ("45-54 · female", "US") in the reader's language. */
      segment: (dimension: string, label: string) => label.split(' · ').map(part => {
        const lower = part.trim().toLowerCase();
        if (!lower || lower === 'unknown') return t('unknownValue');
        if (dimension === 'country' && /^[a-z]{2}$/.test(lower)) { try { return regions?.of(part.trim().toUpperCase()) ?? part; } catch { return part; } }
        if (lower === 'female' || lower === 'male') return t(`gender.${lower}`);
        if (dimension === 'impression_device' && t.has(`device.${lower}` as never)) return t(`device.${lower}` as never);
        if (dimension === 'platform_position' && t.has(`position.${lower}` as never)) return t(`position.${lower}` as never);
        return segmentLabel(dimension, part);
      }).join(' · '),
      coverageLabel: (coverage?: ReportCoverage) => {
        if (!coverage || coverage.state === 'unknown') return t('coverage.unknownLabel');
        if (coverage.state === 'error') return t('coverage.errorLabel');
        if (coverage.state === 'empty') return t('coverage.emptyLabel');
        if (coverage.state === 'mixed') return t('coverage.mixedLabel');
        const span = `${coverage.dateFrom}–${coverage.dateTo}`;
        return coverage.state === 'partial' ? t('coverage.partialLabel', { span }) : span;
      },
      coverageSentence: (coverage?: ReportCoverage) => {
        if (!coverage || coverage.state === 'available') return null;
        if (coverage.state === 'error') return t('coverage.error');
        if (coverage.state === 'empty') return t('coverage.empty');
        if (coverage.state === 'unknown') return t('coverage.unknown');
        if (coverage.state === 'mixed') return t('coverage.mixed');
        const dates = range(coverage.dateFrom, coverage.dateTo);
        return coverage.observedDays != null && coverage.expectedDays != null
          ? t('coverage.partial', { observed: coverage.observedDays, expected: coverage.expectedDays, dates })
          : t('coverage.partialSome', { dates });
      },
      comparison: (comparison: { basis?: ComparisonBasis | null; matchedDays?: number | null }) =>
        comparison.basis === 'matched_days' && comparison.matchedDays ? t('matchedDays', { count: comparison.matchedDays }) : t('vsPrevious'),
      synced: (at: string | null | undefined) => {
        if (!at || !Number.isFinite(Date.parse(at))) return t('notSynced');
        const date = new Date(at), time = date.toLocaleTimeString(intl, { hour: 'numeric', minute: '2-digit' });
        return date.toDateString() === new Date().toDateString() ? t('syncedToday', { time }) : t('syncedDay', { day: date.toLocaleDateString(intl, { month: 'short', day: 'numeric' }), time });
      },
    };
  }, [t, intl]);
}
export type ReportFormat = ReturnType<typeof useReportFormat>;
