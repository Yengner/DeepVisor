import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asRecord,
  compareCalendarQueuePreviewItems,
  type CalendarQueuePreviewItem,
} from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import { isVisibleCalendarQueueSource } from './calendarMode';
import { listCalendarQueueItems } from './repositories/calendarQueue';
import { listActiveAdAccountSignals } from './repositories/signals';
import type {
  AdAccountSignal,
  AdAccountSignalView,
  CalendarQueueItem,
} from './types';

type IntelligenceClient = SupabaseClient<Database>;

const DEFAULT_QUEUE_TIME_ZONE = 'America/New_York';

export interface MetaAccountIntelligenceReadModel {
  signals: AdAccountSignalView[];
  queueItems: CalendarQueuePreviewItem[];
}

function signalActionLabel(signal: AdAccountSignal): string | null {
  return typeof signal.recommendedAction.label === 'string'
    ? signal.recommendedAction.label
    : null;
}

function signalActionHref(signal: AdAccountSignal): string | null {
  return typeof signal.recommendedAction.href === 'string'
    ? signal.recommendedAction.href
    : null;
}

function mapSignalView(signal: AdAccountSignal): AdAccountSignalView {
  return {
    id: signal.id,
    signalType: signal.signalType,
    severity: signal.severity,
    title: signal.title,
    reason: signal.reason,
    actionLabel: signalActionLabel(signal),
    actionHref: signalActionHref(signal),
  };
}

function previewStatus(
  status: CalendarQueueItem['status']
): CalendarQueuePreviewItem['status'] {
  switch (status) {
    case 'approved':
    case 'scheduled':
      return 'approved';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'ready':
      return 'ready';
    default:
      return 'draft';
  }
}

function previewSource(
  sourceType: CalendarQueueItem['sourceType']
): CalendarQueuePreviewItem['source'] {
  switch (sourceType) {
    case 'manual':
      return 'manual';
    case 'ai':
      return 'agent';
    default:
      return 'automatic';
  }
}

function queueChannel(itemType: CalendarQueueItem['itemType']): string {
  switch (itemType) {
    case 'revive_campaign':
    case 'campaign_review':
      return 'Campaigns';
    case 'refresh_creative':
      return 'Creative';
    case 'investigate_efficiency':
      return 'Reports';
    case 'launch_test':
      return 'Testing';
    case 'fix_tracking':
      return 'Tracking';
    default:
      return 'Reports';
  }
}

function defaultTime(itemType: CalendarQueueItem['itemType']): {
  time: string;
  durationMinutes: number;
} {
  switch (itemType) {
    case 'revive_campaign':
      return { time: '9:00 AM', durationMinutes: 60 };
    case 'campaign_review':
      return { time: '9:00 AM', durationMinutes: 30 };
    case 'refresh_creative':
      return { time: '11:00 AM', durationMinutes: 45 };
    case 'investigate_efficiency':
      return { time: '1:30 PM', durationMinutes: 45 };
    case 'launch_test':
      return { time: '10:15 AM', durationMinutes: 50 };
    case 'fix_tracking':
      return { time: '2:00 PM', durationMinutes: 40 };
    case 'review_report':
    default:
      return { time: '3:00 PM', durationMinutes: 35 };
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isTimeOfDay(value: string | null): value is string {
  return Boolean(value && /^\d{2}:\d{2}(:\d{2})?$/.test(value));
}

function toZonedDateKey(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-CA', { timeZone });
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toClockTime(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return defaultTime('review_report').time;
  }

  return date.toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeOfDay(value: string): string {
  const [hours = '09', minutes = '00'] = value.split(':');
  const hour = Number(hours);
  const minute = Number(minutes);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return defaultTime('review_report').time;
  }

  const date = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));
  return date.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mapQueuePreviewItem(item: CalendarQueueItem): CalendarQueuePreviewItem {
  const defaults = defaultTime(item.itemType);
  const payload = asRecord(item.payload);
  const timeZone = stringValue(payload.timeZone) ?? DEFAULT_QUEUE_TIME_ZONE;
  const templateLocalDate = stringValue(payload.templateLocalDate);
  const templateTimeOfDay = stringValue(payload.templateTimeOfDay);
  const recurringTemplateId =
    typeof payload.templateId === 'string' ? payload.templateId : null;
  const recurringTemplateType =
    typeof payload.templateType === 'string'
      ? (payload.templateType as CalendarQueuePreviewItem['recurringTemplateType'])
      : null;
  const templateOccurrenceKey =
    typeof payload.templateOccurrenceKey === 'string' ? payload.templateOccurrenceKey : null;

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? 'DeepVisor generated this queue item from the latest account signals.',
    day: isDateKey(templateLocalDate)
      ? templateLocalDate
      : item.dueDate ?? (item.scheduledFor ? toZonedDateKey(item.scheduledFor, timeZone) : toZonedDateKey(item.createdAt, timeZone)),
    time: isTimeOfDay(templateTimeOfDay)
      ? formatTimeOfDay(templateTimeOfDay)
      : item.scheduledFor
        ? toClockTime(item.scheduledFor, timeZone)
        : defaults.time,
    durationMinutes:
      typeof item.payload.durationMinutes === 'number'
        ? item.payload.durationMinutes
        : defaults.durationMinutes,
    channel: queueChannel(item.itemType),
    status: previewStatus(item.status),
    source: previewSource(item.sourceType),
    destinationHref: item.destinationHref,
    parentQueueItemId: item.parentQueueItemId ?? null,
    workflowKey: item.workflowKey ?? null,
    materializedFromBlueprintKey: item.materializedFromBlueprintKey ?? null,
    childBlueprints: item.childBlueprints ?? [],
    children: [],
    isParent: item.parentQueueItemId == null,
    isRecurring: Boolean(recurringTemplateId),
    recurringTemplateId,
    recurringTemplateType,
    templateOccurrenceKey,
  };
}

function groupQueuePreviewItems(
  items: CalendarQueueItem[]
): CalendarQueuePreviewItem[] {
  const previewById = new Map(
    items.map((item) => [item.id, mapQueuePreviewItem(item)] satisfies [string, CalendarQueuePreviewItem])
  );
  const topLevel: CalendarQueuePreviewItem[] = [];

  for (const item of items) {
    const preview = previewById.get(item.id);
    if (!preview) {
      continue;
    }

    if (item.parentQueueItemId) {
      const parent = previewById.get(item.parentQueueItemId);
      if (parent) {
        parent.children = [...(parent.children ?? []), preview].sort(compareCalendarQueuePreviewItems);
        continue;
      }
    }

    topLevel.push(preview);
  }

  return topLevel.sort(compareCalendarQueuePreviewItems);
}

/**
 * Loads the selected account's active intelligence findings and queue items in
 * one small read model so pages can render real product data without reaching
 * back into the raw tables.
 */
export async function getMetaAccountIntelligenceReadModel(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
    userId?: string | null;
  }
): Promise<MetaAccountIntelligenceReadModel> {
  const [signals, queueItems] = await Promise.all([
    listActiveAdAccountSignals(supabase, input),
    listCalendarQueueItems(supabase, input),
  ]);

  const visibleQueueItems = groupQueuePreviewItems(
    queueItems.filter(
      (item) => item.status !== 'dismissed' && isVisibleCalendarQueueSource(item.sourceType)
    )
  );

  return {
    signals: signals.map(mapSignalView),
    queueItems: visibleQueueItems,
  };
}
