import { expect, it } from 'vitest';
import { audienceObservations, hourlyObservations } from './charts';
import { normalize, selectRows } from './model';
const raw = { date_start: '2026-11-04', date_stop: '2026-11-04', spend: '12', impressions: '100', clicks: '5', age: '25-34', gender: 'female', hourly_stats_aggregated_by_advertiser_time_zone: '09:00:00 - 09:59:59' };
it('retains source dates and dimensions through period and platform selection', () => {
  const rows = normalize([{ ...raw, publisher_platform: 'facebook' }, { ...raw, publisher_platform: 'instagram', spend: '5' }, { ...raw, publisher_platform: 'facebook', date_start: '2026-10-01', date_stop: '2026-10-01' }], 'USD');
  const selected = selectRows(rows, 'facebook', 'today', '2026-11-04');
  expect(audienceObservations(selected)).toEqual([{ date: '2026-11-04', age: '25-34', gender: 'female', currencyCode: 'USD', values: { spend: 12, impressions: 100, clicks: 5, conversion: 0 } }]);
});
it('rejects period totals masquerading as daily observations', () => {
  expect(() => normalize([{ ...raw, publisher_platform: 'facebook', date_stop: '2026-11-05' }], 'USD')).toThrow();
});
it('preserves advertiser date/hour and does not infer hourly actions', () => {
  // Hourly fallback when Meta rejected the actions field: results stay unknown.
  const rows = normalize([{ ...raw, publisher_platform: 'facebook' }], 'USD', true, false);
  expect(hourlyObservations(rows)[0]).toMatchObject({ dayKey: '2026-11-04', hourOfDay: 9, spend: 12, results: null });
  expect(hourlyObservations([{ ...rows[0], label: 'Unknown hour' }])).toEqual([]);
});

it('preserves reported hourly results and distinguishes omitted actions from unrequested actions', () => {
  const rows = normalize([
    { ...raw, publisher_platform: 'facebook', actions: [{ action_type: 'lead', value: '2' }] },
    { ...raw, publisher_platform: 'facebook', actions: [] },
    // Requested but omitted: Meta leaves out actions for rows with no conversions.
    { ...raw, publisher_platform: 'facebook' },
  ], 'USD', true);
  expect(hourlyObservations(rows).map(row => row.results)).toEqual([2, 0, 0]);
  const unrequested = normalize([{ ...raw, publisher_platform: 'facebook' }], 'USD', true, false);
  expect(hourlyObservations(unrequested).map(row => row.results)).toEqual([null]);
});
