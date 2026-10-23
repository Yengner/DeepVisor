import { describe, expect, it } from 'vitest';
import { buildReportFixture } from './fixtures';
import { buildReportExportRecords } from './exportRecords';
import { reportExportUrl } from './exportLinks';
import { escapeReportCsv, REPORT_CSV_HEADERS, renderReportCsv, reportWorkspaceCsvRows } from '@/lib/server/reports/csv';
import { exportValueLabel } from '@/lib/server/reports/pdf/ReportPdfSections';
describe('complete workspace exports', () => {
  it('uses resolved query scope without carrying stale URL filters or presets', () => {
    const q = { ...buildReportFixture().query, platformIntegrationId: 'platform', campaignIds: ['campaign'], adsetIds: ['set'], adIds: ['ad'], scope: 'ad' as const };
    const links = reportExportUrl(q, true), params = new URL(links.pdf, 'https://example.test').searchParams;
    expect(params.get('date_from')).toBe('2026-10-08'); expect(params.get('ad_id')).toBe('ad');
    expect(params.get('adset_id')).toBe('set'); expect(params.get('campaign_id')).toBe('campaign');
    expect(params.get('ad_account_id')).toBe(q.adAccountIds[0]); expect(params.get('platform_integration_id')).toBe('platform');
    expect(params.get('preset')).toBeNull(); expect(params.get('demo')).toBe('1');
    expect(reportExportUrl({ ...q, rangeMode: 'max' }, false).csv).toContain('range=max');
    expect(reportExportUrl(q, false).pdf).not.toContain('demo=');
  });
  it('shares exact summary, weighted ratios, comparisons and all analytical sections', () => {
    const p = buildReportFixture(), records = buildReportExportRecords(p);
    const totals = records.find(r => r.kind === 'summary')!;
    expect(totals.values).toMatchObject({ spend: 1120, conversion: 112, impressions: 9100, clicks: 245, costPerResult: 10, calls: 0, reach: null });
    expect(totals.values.ctr).toBeCloseTo(245 / 9100 * 100);
    expect(exportValueLabel(totals, 'spend')).toBe('$1,120.00');
    const change = records.find(r => r.kind === 'change')!;
    expect(exportValueLabel(change, 'spend')).toBe('+60.00%');
    expect(exportValueLabel(change, 'ctr')).toBe('0.00 pp');
    expect(new Set(records.map(r => r.kind))).toEqual(new Set(['summary','period','previous_summary','previous_period','change','advertising','snapshot','hourly','finding','coverage']));
    const snapshot = records.find(r => r.kind === 'snapshot' && r.context === 'age_gender')!;
    expect(snapshot.from).toBe('2026-10-01'); expect(snapshot.to).toBe('2026-10-07');
    expect(snapshot.values).toMatchObject({ spend: 800, conversion: 80, ctr: 3 });
    const placement = records.find(r => r.kind === 'snapshot' && r.context === 'platform_position')!;
    expect(placement.values.conversion).toBeNull(); expect(placement.values.costPerResult).toBeNull();
    expect(records.find(r => r.kind === 'hourly' && r.id === '3:9')?.values).toMatchObject({ spend: 20, clicks: 10, ctr: 2, costPerResult: 10 });
    expect(records.find(r => r.kind === 'finding')?.values).toMatchObject({ spend: 700, conversion: 70 });
  });
  it('retains observed zeros and every period/entity beyond legacy truncation limits', () => {
    const p = buildReportFixture();
    p.series[0].spend = 0;
    p.breakdown.rows = Array.from({ length: 40 }, (_, i) => ({ ...p.breakdown.rows[0], id: `entity-${i}`, name: `Entity ${i}` }));
    const records = buildReportExportRecords(p);
    expect(records.filter(r => r.kind === 'advertising' && r.context.startsWith('Selected scope:'))).toHaveLength(40);
    expect(records.find(r => r.kind === 'period')?.values.spend).toBe(0);
    const rows = reportWorkspaceCsvRows(p);
    expect(rows.every(row => row.business_name === p.meta.businessName)).toBe(true);
    expect(rows.find(r => r.id === 'entity-39')?.name).toBe('Entity 39');
    expect(rows.find(r => r.row_type === 'period')?.spend).toBe(0);
  });
  it('keeps missing values blank and missing dates explicit instead of exporting zeros', () => {
    const p = buildReportFixture('sparse'), rows = reportWorkspaceCsvRows(p);
    expect(rows.find(r => r.row_type === 'period' && r.start_date === '2026-10-10')?.spend).toBe('');
    expect(rows.some(r => r.row_type === 'change')).toBe(false);
    const empty = renderReportCsv(buildReportFixture('empty'));
    expect(empty.split('\r\n')[0]).toBe(REPORT_CSV_HEADERS.join(','));
    expect(empty).toContain('summary'); expect(empty).toContain('No records available');
    expect(renderReportCsv(buildReportFixture('failed'))).toContain('Data could not be loaded');
  });
  it('preserves source limitations and distinct windows in CSV and PDF records', () => {
    const p = buildReportFixture('mixed'); p.meta.timezone = null;
    p.surface.measurements![0].dateFrom = null;
    const records = buildReportExportRecords(p), rows = reportWorkspaceCsvRows(p, true);
    expect(records.find(r => r.kind === 'summary')?.values.spend).toBeNull();
    expect(records.filter(r => r.kind === 'hourly')).toEqual([]);
    expect(records.find(r => r.kind === 'snapshot' && r.coverage === 'Coverage unknown')?.from).toBeNull();
    expect(rows[0]).toMatchObject({ spend: '', currency: 'MIXED', account_timezone: 'unknown', data_source: 'demo' });
    expect(exportValueLabel(records[0], 'spend')).toBe('Unavailable');
  });
  it('escapes quotes, multiline text, carriage returns and spreadsheet formulas without changing numbers', () => {
    expect(escapeReportCsv('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(escapeReportCsv('a\rb')).toBe('"a\rb"');
    expect(escapeReportCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeReportCsv('  +SUM(A1)')).toBe("'  +SUM(A1)");
    expect(escapeReportCsv(-25)).toBe('-25');
    expect(escapeReportCsv(0)).toBe('0'); expect(escapeReportCsv(null)).toBe('');
  });
});
