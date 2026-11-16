/**
 * An ad set's run window, from Meta's saved start/end times. Pure: no I/O.
 *
 * The end is the ad set's own `end_time`, else its campaign's `stop_time`/`end_time`
 * (Meta stops the ad set when the campaign ends). No end means it runs until paused.
 */
export type AdSchedule = {
  start: string | null;
  end: string | null;
  /** Calendar days (YYYY-MM-DD) in the account time zone; a midnight end counts as the day before. */
  startDay: string | null;
  endDay: string | null;
  /** Calendar days from today to the last delivery day; 0 means it ends today. Null without an end. */
  daysLeft: number | null;
  /** Share of the run already elapsed, 0–100. Null without both dates. */
  elapsedPercent: number | null;
  /** Days since start, counting the first day as 1. Null without a start. */
  daysRunning: number | null;
  /** The end time has passed. */
  ended: boolean;
};

const DAY = 86_400_000;

function time(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}

/** YYYY-MM-DD for an instant in a time zone; invalid zones fall back to UTC. */
function localDay(at: number, zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export function adSchedule(adsetRaw: unknown, campaignRaw: unknown, now: string, zone = 'UTC'): AdSchedule {
  const own = record(adsetRaw), campaign = record(campaignRaw);
  const start = time(own.start_time) ?? time(campaign.start_time);
  const end = time(own.end_time) ?? time(own.stop_time) ?? time(campaign.stop_time) ?? time(campaign.end_time);
  const at = Date.parse(now);
  const startAt = start ? Date.parse(start) : null;
  const endAt = end ? Date.parse(end) : null;
  const startDay = startAt === null ? null : localDay(startAt, zone);
  // Meta ends at the boundary instant, so the last delivery day is the one just before it.
  const endDay = endAt === null ? null : localDay(endAt - 1000, zone);
  if (!Number.isFinite(at)) return { start, end, startDay, endDay, daysLeft: null, elapsedPercent: null, daysRunning: null, ended: false };
  const today = dayNumber(localDay(at, zone));
  const daysLeft = endDay === null ? null : Math.max(0, dayNumber(endDay) - today);
  const elapsedPercent = startAt !== null && endAt !== null && endAt > startAt
    ? Math.round(Math.min(1, Math.max(0, (at - startAt) / (endAt - startAt))) * 100)
    : null;
  const daysRunning = startDay === null || startAt === null || at < startAt ? null : today - dayNumber(startDay) + 1;
  return { start, end, startDay, endDay, daysLeft, elapsedPercent, daysRunning, ended: endAt !== null && endAt <= at };
}

/** Within two calendar days of its last delivery day, and not already over. */
export function endingSoon(schedule: AdSchedule | undefined | null): boolean {
  return Boolean(schedule && !schedule.ended && schedule.daysLeft !== null && schedule.daysLeft <= 2);
}

/** "Ends today", "Ends tomorrow", "Ends in 5 days". Null without an end or once ended. */
export function endingLabel(schedule: AdSchedule | undefined | null): string | null {
  if (!schedule || schedule.ended || schedule.daysLeft === null) return null;
  const days = schedule.daysLeft;
  return days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;
}

