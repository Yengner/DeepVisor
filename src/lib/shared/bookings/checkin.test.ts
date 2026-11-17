import { describe, expect, it } from 'vitest';
import { bookingSummary, checkinToAsk, completedWeeks, isAnswerableWeek, lastCompletedWeek, weekStartOf, weekTotals, type WeekRow } from './checkin';

// 2026-11-16 is a Monday.
const row = (day: string, spend: number | null, messages: number | null = 2): WeekRow => ({ day, spend, leads: 0, messages, calls: 0, destinationType: 'WHATSAPP' });

describe('weeks', () => {
  it('uses account-local Monday–Sunday weeks', () => {
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
    expect(weekStartOf('2026-11-22')).toBe('2026-11-16');
    expect(lastCompletedWeek('2026-11-16')).toBe('2026-11-09');
    expect(lastCompletedWeek('2026-11-22')).toBe('2026-11-09');
    expect(completedWeeks('2026-11-18', 3)).toEqual(['2026-11-09', '2026-11-02', '2026-10-26']);
  });

  it('accepts only recent completed Mondays', () => {
    expect(isAnswerableWeek('2026-11-09', '2026-11-18')).toBe(true);
    expect(isAnswerableWeek('2026-11-16', '2026-11-18')).toBe(false); // not finished
    expect(isAnswerableWeek('2026-11-10', '2026-11-18')).toBe(false); // not a Monday
    expect(isAnswerableWeek('2026-09-14', '2026-11-18')).toBe(false); // too old
    expect(isAnswerableWeek('nope', '2026-11-18')).toBe(false);
  });
});

describe('weekTotals', () => {
  it('sums the week and names its results', () => {
    const totals = weekTotals([row('2026-11-08', 99), row('2026-11-09', 10), row('2026-11-15', 15, 3), row('2026-11-16', 99)], '2026-11-09');
    expect(totals).toMatchObject({ weekStart: '2026-11-09', weekEnd: '2026-11-15', spend: 25, results: 5, result: { kind: 'whatsapp_conversations' } });
  });

  it('keeps unknown values unknown and an idle week at zero', () => {
    expect(weekTotals([row('2026-11-10', null)], '2026-11-09').spend).toBeNull();
    expect(weekTotals([row('2026-11-10', 5, null)], '2026-11-09').results).toBeNull();
    expect(weekTotals([], '2026-11-09')).toMatchObject({ spend: 0, results: 0 });
  });
});

describe('checkinToAsk', () => {
  const totals = weekTotals([row('2026-11-10', 20)], '2026-11-09');
  it('asks once about last week when the ads spent money', () => {
    expect(checkinToAsk({ today: '2026-11-17', answers: [], totals })?.weekStart).toBe('2026-11-09');
    expect(checkinToAsk({ today: '2026-11-17', answers: [{ weekStart: '2026-11-09', bookings: null, skipped: true }], totals })).toBeNull();
    expect(checkinToAsk({ today: '2026-11-17', answers: [{ weekStart: '2026-11-09', bookings: 4, skipped: false }], totals })).toBeNull();
  });
  it('does not ask about idle, unknown or other weeks', () => {
    expect(checkinToAsk({ today: '2026-11-17', answers: [], totals: weekTotals([], '2026-11-09') })).toBeNull();
    expect(checkinToAsk({ today: '2026-11-17', answers: [], totals: weekTotals([row('2026-11-10', null)], '2026-11-09') })).toBeNull();
    expect(checkinToAsk({ today: '2026-11-24', answers: [], totals })).toBeNull();
  });
});

describe('bookingSummary', () => {
  const weeks = [
    weekTotals([row('2026-11-10', 40)], '2026-11-09'),
    weekTotals([row('2026-11-03', 30)], '2026-11-02'),
    weekTotals([row('2026-10-27', 20)], '2026-10-26'),
    weekTotals([], '2026-10-19'),
  ];
  it('uses answered weeks only for spend and bookings', () => {
    const summary = bookingSummary(weeks, [
      { weekStart: '2026-11-09', bookings: 4, skipped: false },
      { weekStart: '2026-11-02', bookings: null, skipped: true },
      { weekStart: '2026-10-19', bookings: 2, skipped: false }, // no spend that week: ignored
    ]);
    expect(summary).toEqual({ weeksWithSpend: 3, weeksAnswered: 1, bookings: 4, costPerBooking: 10 });
  });

  it('never invents zero bookings or a cost', () => {
    expect(bookingSummary(weeks, [])).toEqual({ weeksWithSpend: 3, weeksAnswered: 0, bookings: null, costPerBooking: null });
    expect(bookingSummary(weeks, [{ weekStart: '2026-11-09', bookings: 0, skipped: false }])).toMatchObject({ bookings: 0, costPerBooking: null });
  });
});
