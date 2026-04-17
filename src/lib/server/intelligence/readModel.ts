import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compareCalendarQueuePreviewItems,
  type CalendarQueuePreviewItem,
} from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import { listCalendarQueueItems } from './repositories/calendarQueue';
import { listActiveAdAccountSignals } from './repositories/signals';
import type {
  AdAccountSignal,
  AdAccountSignalView,
  CalendarQueueItem,
} from './types';

type IntelligenceClient = SupabaseClient<Database>;

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
    case 'in_progress':
      return 'approved';
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

function toIsoDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function toClockTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mapQueuePreviewItem(item: CalendarQueueItem): CalendarQueuePreviewItem {
  const defaults = defaultTime(item.itemType);

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? 'DeepVisor generated this queue item from the latest account signals.',
    day: item.scheduledFor ? toIsoDay(item.scheduledFor) : toIsoDay(item.createdAt),
    time: item.scheduledFor ? toClockTime(item.scheduledFor) : defaults.time,
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
  }
): Promise<MetaAccountIntelligenceReadModel> {
  const [signals, queueItems] = await Promise.all([
    listActiveAdAccountSignals(supabase, input),
    listCalendarQueueItems(supabase, input),
  ]);

  const visibleQueueItems = groupQueuePreviewItems(
    queueItems.filter((item) => item.status !== 'dismissed' && item.status !== 'completed')
  );

  return {
    signals: signals.map(mapSignalView),
    queueItems: visibleQueueItems,
  };
}
