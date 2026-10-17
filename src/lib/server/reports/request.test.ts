import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../actions/app/selection', () => ({ resolveCurrentSelection: vi.fn() }));
import { resolveCurrentSelection } from '../actions/app/selection';
import { resolveReportRequest } from './request';
import { buildDemoReportPayload } from './demo';
import { parseReportQueryInput } from './query';

describe('report request and demo boundary', () => {
  it('defaults to the current account consistently for page and export callers', async () => {
    vi.mocked(resolveCurrentSelection).mockResolvedValue({ selectedPlatformId: 'platform', selectedAdAccountId: 'account' });
    expect(await resolveReportRequest('business', {})).toMatchObject({ scope: 'ad_account', adAccountIds: ['account'], platformIntegrationId: 'platform', presetDays: 30 });
  });
  it('keeps explicit URL scope for repository authorization', async () => {
    const query = await resolveReportRequest('business', { ad_account_id: 'other', date_from: '2026-01-01', date_to: '2026-01-02' });
    expect(query.adAccountIds).toEqual(['other']);
  });
  it('does not mix live account selection into explicit demo data', async () => {
    vi.mocked(resolveCurrentSelection).mockClear();
    expect((await resolveReportRequest('business', { demo: '1' })).adAccountIds).toEqual([]);
    expect(resolveCurrentSelection).not.toHaveBeenCalled();
  });
  it('produces deterministic demo metrics and account-local dates with a fixed clock', () => {
    const now = new Date('2026-03-09T02:00:00Z');
    const q = parseReportQueryInput('business', { preset: '7', demo: '1' }, now);
    const a = buildDemoReportPayload(q, 'Demo', now), b = buildDemoReportPayload(q, 'Demo', now);
    expect(a.summary).toEqual(b.summary);
    expect(a.query).toMatchObject({ dateFrom: '2026-03-01', dateTo: '2026-03-07' });
    expect(a.meta.timezone).toBe('America/New_York');
    expect(a.summary.costPerResult).toBeCloseTo(a.summary.spend / a.summary.conversion);
  });
});

it('renders the existing PDF pipeline with corrected reporting contracts', async () => {
  const { renderReportPdfBuffer } = await import('./pdf/renderReportPdf');
  const query = parseReportQueryInput('demo', { demo: '1', date_from: '2026-01-01', date_to: '2026-01-07', compare: 'previous_period' });
  const result = await renderReportPdfBuffer({ query, organizationName: 'Demo', demo: true });
  expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
  expect(result.payload.query.dateFrom).toBe('2026-01-01');
  expect(result.payload.comparison.previousDateTo).toBe('2025-12-31');
}, 20_000);
