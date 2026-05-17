import type { CalendarQueueItem } from './types';

// Calendar is manual-only for now. Leave automation paths in place, but keep
// them disabled until the manual workflow is stable.
const CALENDAR_MANUAL_MODE = true;

const MANUAL_VISIBLE_QUEUE_SOURCES = new Set<CalendarQueueItem['sourceType']>([
  'manual',
  'ai',
]);

export function isCalendarManualMode(): boolean {
  return CALENDAR_MANUAL_MODE;
}

export function isVisibleCalendarQueueSource(
  sourceType: CalendarQueueItem['sourceType']
): boolean {
  return isCalendarManualMode()
    ? MANUAL_VISIBLE_QUEUE_SOURCES.has(sourceType)
    : true;
}
