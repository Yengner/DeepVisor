import { describe, expect, it } from 'vitest';
import {
  buildRecurringCalendarQueuePreviewItems,
  type CalendarQueueTemplate,
} from '@/lib/shared/utils/calendarQueue';

const template: CalendarQueueTemplate = {
  id: 'weekly-report',
  businessId: 'business-1',
  platformIntegrationId: null,
  adAccountId: null,
  templateType: 'report',
  title: 'Weekly report',
  description: 'Review recent performance',
  destinationHref: null,
  recurrenceType: 'weekly',
  weekdays: [1],
  monthlyDay: null,
  timeOfDay: '09:00:00',
  durationMinutes: 30,
  payloadJson: {},
  startDate: '2026-06-08',
  endDate: '2026-06-15',
  status: 'active',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const range = {
  rangeStart: new Date(2026, 5, 1),
  rangeEnd: new Date(2026, 5, 30),
};

describe('buildRecurringCalendarQueuePreviewItems', () => {
  it('honors weekdays and inclusive start/end boundaries', () => {
    const items = buildRecurringCalendarQueuePreviewItems([template], range);
    expect(items.map((item) => item.day)).toEqual(['2026-06-08', '2026-06-15']);
    expect(items[0]).toMatchObject({
      time: '9:00 AM',
      destinationHref: '/reports?compare=previous_period',
      recurringTemplateId: template.id,
    });
  });

  it('omits paused templates and cancelled occurrences', () => {
    expect(buildRecurringCalendarQueuePreviewItems([{ ...template, status: 'paused' }], range)).toEqual([]);
    const items = buildRecurringCalendarQueuePreviewItems([{
      ...template,
      payloadJson: {
        cancelledOccurrenceKeys: ['calendar-template:weekly-report:2026-06-08:09:00:00'],
      },
    }], range);
    expect(items.map((item) => item.day)).toEqual(['2026-06-15']);
  });

  it('schedules monthly reports on the configured day', () => {
    const items = buildRecurringCalendarQueuePreviewItems([{
      ...template,
      recurrenceType: 'monthly',
      monthlyDay: 10,
    }], range);
    expect(items.map((item) => item.day)).toEqual(['2026-06-10']);
  });

  it('sorts same-day occurrences chronologically across noon', () => {
    const items = buildRecurringCalendarQueuePreviewItems([
      { ...template, id: 'afternoon', timeOfDay: '13:00:00' },
      { ...template, id: 'midnight', timeOfDay: '00:00:00' },
      { ...template, id: 'noon', timeOfDay: '12:00:00' },
    ], { rangeStart: new Date(2026, 5, 8), rangeEnd: new Date(2026, 5, 8) });
    expect(items.map((item) => item.time)).toEqual(['12:00 AM', '12:00 PM', '1:00 PM']);
  });
});
