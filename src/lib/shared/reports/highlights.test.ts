import { describe, expect, it } from 'vitest';
import { buildReportFixture } from './fixtures';
import { busiestHour, MIN_HOUR_OBSERVATIONS, snapshotShares, topAdvertising } from './highlights';
import { buildSnapshotBreakdown, snapshotWindows } from './breakdowns';
import { coverageSentence, formatHour, formatReportRange, formatSnapshotWindow, formatTimezone, humanizeObjective, segmentLabel } from './labels';

describe('report labels', () => {
  it('humanizes Meta enums and breakdown values without inventing data', () => {
    expect(humanizeObjective('OUTCOME_LEADS')).toBe('Leads');
    expect(humanizeObjective('UNKNOWN')).toBe('—');
    expect(segmentLabel('age_gender', '45-54 · female')).toBe('45–54 · Female');
    expect(segmentLabel('country', 'US')).toBe('United States');
    expect(segmentLabel('publisher_platform', 'audience_network')).toBe('Audience Network');
    expect(segmentLabel('publisher_platform', 'unknown')).toBe('Unknown');
    expect(segmentLabel('impression_device', 'android_smartphone')).toBe('Android phone');
  });

  it('formats dates, hours and timezones', () => {
    expect(formatReportRange('2026-10-14', '2026-11-12')).toBe('Oct 14 – Nov 12, 2026');
    expect(formatReportRange('2025-12-20', '2026-01-02')).toBe('Dec 20, 2025 – Jan 2, 2026');
    expect(formatSnapshotWindow('2023-10-18 / 2026-11-13')).toBe('Oct 18, 2023 – Nov 13, 2026');
    expect(formatSnapshotWindow('Coverage unknown')).toBe('Dates unknown');
    expect([0, 9, 12, 15].map(formatHour)).toEqual(['12 AM', '9 AM', '12 PM', '3 PM']);
    expect(formatTimezone('America/New_York')).toBe('New York time');
  });

  it('describes partial coverage as gaps, not zeros', () => {
    expect(coverageSentence({ state: 'available', basis: 'period', dateFrom: '2026-10-01', dateTo: '2026-10-30' })).toBeNull();
    expect(coverageSentence({ state: 'partial', basis: 'period', dateFrom: '2026-10-28', dateTo: '2026-11-12', observedDays: 13, expectedDays: 30 }))
      .toBe('13 of 30 days have saved records (Oct 28 – Nov 12, 2026). Days without records are gaps, not zero.');
  });
});

describe('overview highlights', () => {
  it('selects from the section model so highlights match their sections', () => {
    const payload = buildReportFixture();
    const audience = snapshotShares(payload, 'age_gender')!;
    const window = snapshotWindows(payload.surface, 'age_gender')[0];
    const model = buildSnapshotBreakdown(payload.surface, 'age_gender', 'spend', window);
    expect(audience.window).toBe(window);
    expect(audience.segments[0]).toEqual({ label: '25–34 · Female', value: model.items[0].value, share: 800 / 1120 });
    expect(snapshotShares(payload, 'country')!.segments.map(s => s.label)).toEqual(['United States', 'Canada']);
  });

  it('returns no audience highlight for non-Meta or unknown windows', () => {
    const payload = buildReportFixture();
    payload.surface.isMeta = false;
    expect(snapshotShares(payload, 'age_gender')).toBeNull();
  });

  it('ranks advertising by results and falls back to spend when none were recorded', () => {
    const payload = buildReportFixture();
    const top = topAdvertising(payload);
    expect(top.rows.length).toBeLessThanOrEqual(3);
    payload.breakdown.rows = payload.breakdown.rows.map(row => ({ ...row, conversion: 0 }));
    expect(topAdvertising(payload).metric).toBe('spend');
  });

  it('withholds the busiest hour without a timezone or enough observations', () => {
    const payload = buildReportFixture();
    payload.meta.timezone = null;
    expect(busiestHour(payload)).toBeNull();
    // A single observed date is not enough evidence to call a slot the busiest.
    expect(busiestHour(buildReportFixture())).toBeNull();
  });

  it('picks the highest average-clicks slot once it has enough observed dates', () => {
    const payload = buildReportFixture();
    const obs = (dayKey: string, hourOfDay: number, clicks: number) =>
      ({ dayKey, hourOfDay, clicks, spend: 1, impressions: 100, results: 0, inlineLinkClicks: 0 });
    // 2026-10-02 and 2026-10-09 are Fridays (day index 4).
    payload.surface.hourlyTrendExpanded = [
      obs('2026-10-02', 15, 10), obs('2026-10-09', 15, 14),
      obs('2026-10-02', 9, 30), // higher, but only one observed date
      obs('2026-10-05', 9, 4), obs('2026-10-12', 9, 6),
    ] as typeof payload.surface.hourlyTrendExpanded;
    expect(busiestHour(payload)).toEqual({ day: 4, hour: 15, value: 12, observations: MIN_HOUR_OBSERVATIONS });
  });
});
