import { describe, expect, it } from 'vitest';
import { adSchedule, endingLabel, endingSoon } from './schedule';

const now = '2026-11-15T12:00:00Z';

describe('adSchedule', () => {
  it('counts days left and elapsed share from the ad set window', () => {
    const s = adSchedule({ start_time: '2026-11-05T12:00:00Z', end_time: '2026-11-25T12:00:00Z' }, null, now);
    expect(s).toMatchObject({ daysLeft: 10, elapsedPercent: 50, daysRunning: 11 });
  });

  it('falls back to the campaign stop time when the ad set has no end', () => {
    const s = adSchedule({ start_time: '2026-11-10T00:00:00Z' }, { stop_time: '2026-11-17T18:00:00Z' }, now);
    expect(s.end).toBe('2026-11-17T18:00:00.000Z');
    expect(s.daysLeft).toBe(2);
  });

  it('counts calendar days in the account time zone, not hours', () => {
    // 9 PM in New York on Nov 15; the ad ends 1 AM New York time on Nov 16 → 1 day left.
    const s = adSchedule({ start_time: '2026-11-01T04:00:00Z', end_time: '2026-11-16T06:00:00Z' }, null, '2026-11-16T02:00:00Z', 'America/New_York');
    expect(s).toMatchObject({ endDay: '2026-11-16', daysLeft: 1 });
  });

  it('treats a midnight end as ending the day before, and 0 as ending today', () => {
    const s = adSchedule({ start_time: '2026-11-01T05:00:00Z', end_time: '2026-11-16T05:00:00Z' }, null, '2026-11-15T15:00:00Z', 'America/New_York');
    expect(s).toMatchObject({ endDay: '2026-11-15', daysLeft: 0 });
  });

  it('has no countdown or progress without an end date', () => {
    expect(adSchedule({ start_time: '2026-11-13T12:00:00Z' }, {}, now)).toMatchObject({ end: null, daysLeft: null, elapsedPercent: null, daysRunning: 3 });
  });

  it('treats malformed or missing times as unknown, not zero', () => {
    expect(adSchedule({ start_time: 'soon', end_time: 42 }, null, now)).toEqual({ start: null, end: null, startDay: null, endDay: null, daysLeft: null, elapsedPercent: null, daysRunning: null, ended: false });
  });
});

describe('ending soon', () => {
  const at = (end: string) => adSchedule({ start_time: '2026-11-01T12:00:00Z', end_time: end }, null, now);
  it('flags runs with two or fewer calendar days left', () => {
    expect(endingSoon(at('2026-11-17T18:00:00Z'))).toBe(true);
    expect(endingSoon(at('2026-11-18T18:00:00Z'))).toBe(false);
    expect(endingLabel(at('2026-11-15T18:00:00Z'))).toBe('Ends today');
    expect(endingLabel(at('2026-11-16T18:00:00Z'))).toBe('Ends tomorrow');
    expect(endingLabel(at('2026-11-20T18:00:00Z'))).toBe('Ends in 5 days');
  });
  it('never flags a run that already ended or has no end', () => {
    const over = at('2026-11-15T06:00:00Z');
    expect(over).toMatchObject({ ended: true, daysLeft: 0 });
    expect(endingSoon(over)).toBe(false);
    expect(endingLabel(over)).toBeNull();
    expect(endingSoon(adSchedule({ start_time: '2026-11-01T12:00:00Z' }, null, now))).toBe(false);
  });
});

