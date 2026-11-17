/**
 * Weekly booking check-in. Pure: no I/O.
 *
 * Meta reports conversations; only the owner knows how many became appointments. Each week
 * (account-local Monday–Sunday) the owner may report a count or say "not sure" (skipped).
 * Rules:
 * - Ask only about the last completed week, only if the ads spent money that week, only once.
 * - A week without an answer, or skipped, is unknown: it is left out of both spend and bookings,
 *   never counted as zero bookings.
 * - Cost per booking uses answered weeks only and always states its coverage.
 */
import { resultDefinitionFor, type ResultDefinition } from '@/lib/shared/performance/resultChannel';

export type CheckinAnswer = { weekStart: string; bookings: number | null; skipped: boolean };
export type WeekRow = { day: string; spend: number | null; leads: number | null; messages: number | null; calls: number | null; destinationType: string | null | undefined };
export type WeekTotals = { weekStart: string; weekEnd: string; spend: number | null; results: number | null; result: ResultDefinition };

const DAY = 86_400_000;
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const isoDow = (day: string) => ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** Sunday of the week starting `weekStart`. */
export const weekEnd = (weekStart: string) => shift(weekStart, 6);
/** Monday of the week containing `day`. */
export const weekStartOf = (day: string) => shift(day, 1 - isoDow(day));
/** The most recent fully completed Monday–Sunday week before `today` (account-local). */
export const lastCompletedWeek = (today: string) => shift(weekStartOf(today), -7);
/** The last `count` completed weeks, newest first. */
export const completedWeeks = (today: string, count: number) => Array.from({ length: count }, (_, i) => shift(lastCompletedWeek(today), -7 * i));

export function isAnswerableWeek(weekStart: string, today: string, maxWeeksBack = 8): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || isoDow(weekStart) !== 1) return false;
  const last = lastCompletedWeek(today);
  return weekStart <= last && weekStart >= shift(last, -7 * (maxWeeksBack - 1));
}

const sum = (values: Array<number | null>) => (values.every(v => typeof v === 'number' && Number.isFinite(v)) ? values.reduce<number>((a, b) => a + b!, 0) : null);

/** Spend and results for one week from ad-set daily rows. Missing values make totals unknown. */
export function weekTotals(rows: WeekRow[], weekStart: string): WeekTotals {
  const end = weekEnd(weekStart);
  const week = rows.filter(r => r.day >= weekStart && r.day <= end);
  return {
    weekStart, weekEnd: end,
    spend: week.length ? sum(week.map(r => r.spend)) : 0,
    results: week.length ? sum(week.map(r => (r.leads === null || r.messages === null || r.calls === null ? null : r.leads + r.messages + r.calls))) : 0,
    result: resultDefinitionFor(week, r => r.destinationType),
  };
}

/** The week to ask about now, or null when there is nothing to ask. */
export function checkinToAsk(input: { today: string; answers: CheckinAnswer[]; totals: WeekTotals }): WeekTotals | null {
  const week = lastCompletedWeek(input.today);
  if (input.totals.weekStart !== week) return null;
  if (input.answers.some(a => a.weekStart === week)) return null;
  return input.totals.spend !== null && input.totals.spend > 0 ? input.totals : null;
}

export type BookingSummary = {
  /** Completed weeks in the window where ads spent money. */
  weeksWithSpend: number;
  /** Of those, weeks with a reported count (not skipped). */
  weeksAnswered: number;
  bookings: number | null;
  /** Spend over answered weeks divided by their bookings; null when unknown or zero bookings. */
  costPerBooking: number | null;
};

export function bookingSummary(weeks: WeekTotals[], answers: CheckinAnswer[]): BookingSummary {
  const spent = weeks.filter(w => w.spend !== null && w.spend > 0);
  const answered = spent.flatMap(w => {
    const answer = answers.find(a => a.weekStart === w.weekStart && !a.skipped && a.bookings !== null);
    return answer ? [{ spend: w.spend!, bookings: answer.bookings! }] : [];
  });
  const bookings = answered.length ? answered.reduce((n, a) => n + a.bookings, 0) : null;
  const spend = answered.reduce((n, a) => n + a.spend, 0);
  return { weeksWithSpend: spent.length, weeksAnswered: answered.length, bookings, costPerBooking: bookings ? spend / bookings : null };
}
