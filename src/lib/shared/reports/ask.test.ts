import { describe, expect, it } from 'vitest';
import { buildReportFixture } from './fixtures';
import { reportAskContext, reportQuestions } from './ask';

describe('report questions', () => {
  it('carries the report scope, dates and values, naming gaps as gaps', () => {
    const payload = buildReportFixture();
    const context = reportAskContext(payload, 'Test account');
    expect(context).toContain('Test account');
    expect(context).toContain('spend $');
    if (payload.meta.coverage?.observedDays != null) expect(context).toContain('gaps, not zero');
  });
  it('names unavailable metrics instead of zero', () => {
    const payload = buildReportFixture();
    payload.meta.currencyCode = null;
    expect(reportAskContext(payload, 'X')).toContain('spend unavailable');
  });
  it('asks about the comparison only when one exists', () => {
    const payload = buildReportFixture();
    payload.query.compareMode = 'none';
    expect(reportQuestions(payload, 'X')[0].id).toBe('trend');
    payload.query.compareMode = 'previous_period';
    payload.comparison.previousTotals = { ...payload.summary, spend: payload.summary.spend, conversion: payload.summary.conversion * 2, costPerResult: payload.summary.costPerResult / 2 };
    const first = reportQuestions(payload, 'X')[0];
    expect(first.id).toBe('change');
    expect(first.label).toMatch(/^Why cost per result rose \d+%$/);
  });
});
