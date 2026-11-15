import type { ReportPayload } from '@/lib/server/reports/types';
import { formatReportMetric, reportMetricDelta } from './metrics';
import { comparisonBaseTotals } from './comparison';
import { formatReportRange, formatTimezone } from './labels';

export interface ReportQuestion { id: string; label: string; question: string }

/**
 * The facts a question carries so the assistant starts from what this report shows. Only values
 * the report actually has are included; unavailable metrics are named as unavailable, never zero.
 */
export function reportAskContext(payload: ReportPayload, scopeName: string): string {
  const { query, meta, summary } = payload;
  const currency = meta.currencyCode;
  const metric = (key: 'spend' | 'conversion' | 'costPerResult' | 'ctr', label: string) => {
    const value = formatReportMetric(summary, key, currency);
    return `${label} ${value === '—' ? 'unavailable' : value}`;
  };
  const coverage = meta.coverage?.observedDays != null && meta.coverage.expectedDays
    ? ` Saved records cover ${meta.coverage.observedDays} of ${meta.coverage.expectedDays} days; days without records are gaps, not zero.` : '';
  const range = query.rangeMode === 'max' ? 'all saved history' : formatReportRange(query.dateFrom, query.dateTo);
  return `About my Reports view — ${scopeName}, ${range} (${formatTimezone(meta.timezone)}): `
    + [metric('spend', 'spend'), metric('conversion', 'results'), metric('costPerResult', 'cost per result'), metric('ctr', 'CTR')].join(', ')
    + `.${coverage}`;
}

/** Suggested questions, chosen from what this report can actually support. */
export function reportQuestions(payload: ReportPayload, scopeName: string): ReportQuestion[] {
  const context = reportAskContext(payload, scopeName);
  const questions: ReportQuestion[] = [];
  const comparing = payload.query.compareMode === 'previous_period' && payload.comparison.previousTotals;
  const cprChange = comparing ? reportMetricDelta(comparisonBaseTotals(payload), payload.comparison.previousTotals, 'costPerResult') : null;
  if (cprChange != null && Math.abs(cprChange) >= 1) {
    const direction = cprChange > 0 ? 'rose' : 'fell';
    const basis = payload.comparison.basis === 'matched_days' ? ` (on the ${payload.comparison.matchedDays} days with records in both periods)` : '';
    questions.push({ id: 'change', label: `Why cost per result ${direction} ${Math.abs(cprChange).toFixed(0)}%`,
      question: `${context} Cost per result ${direction} ${Math.abs(cprChange).toFixed(1)}% versus the previous period${basis}. What drove that change?` });
  } else {
    questions.push({ id: 'trend', label: 'Summarize these dates',
      question: `${context} Summarize how performance went over these dates and what stands out.` });
  }
  if (payload.summary.spend > 0) {
    questions.push({ id: 'focus', label: 'What should I look at first?',
      question: `${context} Which campaigns, ad sets or ads should I look at first in this period, and why?` });
  }
  if (payload.surface.isMeta) {
    questions.push({ id: 'audience', label: 'Who and where is my spend going?',
      question: `${context} Which audiences and placements are getting my spend, and do any look worth checking?` });
  }
  if (payload.meta.timezone && payload.surface.hourlyTrendExpanded.length) {
    questions.push({ id: 'timing', label: 'When do my ads do best?',
      question: `${context} When during the week do my ads perform best, and is there enough data to say?` });
  }
  return questions;
}
