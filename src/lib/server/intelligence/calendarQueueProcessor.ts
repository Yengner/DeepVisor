import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, type CalendarQueueTemplate, type CalendarQueueTemplateType } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import {
  claimCalendarQueueItemForProcessing,
  completeCalendarQueueItem,
  createCalendarQueueItemWithStatus,
  listDueCalendarQueueItems,
  releaseCalendarQueueItemAfterFailure,
} from './repositories/calendarQueue';
import { listActiveCalendarQueueTemplatesForProcessing } from './repositories/calendarQueueTemplates';
import {
  createOrUpdateDeliveryLog,
  upsertNotification,
} from './repositories/notifications';
import type {
  CalendarQueueItem,
  CalendarQueueItemDraft,
  CalendarQueueItemType,
  CalendarQueuePriority,
} from './types';

type IntelligenceClient = SupabaseClient<Database>;

type CalendarQueueProcessingResult = {
  success: boolean;
  processedAt: string;
  materializedCount: number;
  processedCount: number;
  notificationCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
};

type ProcessorInput = {
  now?: Date;
  limit?: number;
  lookbackDays?: number;
  businessId?: string | null;
  adAccountId?: string | null;
};

type AccountContext = {
  id: string;
  business_id: string;
  name: string | null;
  platform_id: string;
  timezone: string | null;
};

type BusinessContext = {
  id: string;
  business_name: string;
  organization_id: string | null;
};

const DEFAULT_TIME_ZONE = 'America/New_York';
const DEFAULT_LIMIT = 25;
const DEFAULT_LOOKBACK_DAYS = 14;

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysToDateKey(value: string, days: number): string {
  const next = parseDateKey(value);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateKey(next);
}

function maxDateKey(left: string, right: string): string {
  return left > right ? left : right;
}

function minDateKey(left: string, right: string): string {
  return left < right ? left : right;
}

function normalizeTimeOfDay(value: string): string {
  const [hours = '09', minutes = '00', seconds = '00'] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const rawHour = value('hour');

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: value('minute'),
    second: value('second'),
  };
}

function toZonedDateKey(date: Date, timeZone: string): string {
  try {
    const parts = getZonedParts(date, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  } catch {
    return toDateKey(date);
  }
}

function zonedDateTimeToUtc(dateKey: string, timeOfDay: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second] = normalizeTimeOfDay(timeOfDay).split(':').map(Number);
  const desiredLocalMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMs = desiredLocalMs;

  for (let index = 0; index < 3; index += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const renderedLocalMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const delta = desiredLocalMs - renderedLocalMs;
    if (delta === 0) {
      break;
    }
    utcMs += delta;
  }

  return new Date(utcMs);
}

function dayOfWeek(dateKey: string): number {
  return parseDateKey(dateKey).getUTCDay();
}

function dayOfMonth(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

function templateRunsOnDate(template: CalendarQueueTemplate, dateKey: string): boolean {
  if (dateKey < template.startDate) {
    return false;
  }

  if (template.endDate && dateKey > template.endDate) {
    return false;
  }

  if (template.recurrenceType === 'monthly') {
    return dayOfMonth(dateKey) === (template.monthlyDay ?? 1);
  }

  return template.weekdays.includes(dayOfWeek(dateKey));
}

function itemTypeForTemplate(templateType: CalendarQueueTemplateType): CalendarQueueItemType {
  switch (templateType) {
    case 'creative_refresh':
      return 'refresh_creative';
    case 'campaign_review':
    case 'budget_review':
      return 'investigate_efficiency';
    case 'report':
    case 'custom':
    default:
      return 'review_report';
  }
}

function priorityForTemplate(templateType: CalendarQueueTemplateType): CalendarQueuePriority {
  return templateType === 'report' ? 'medium' : 'high';
}

function defaultDestinationForTemplate(templateType: CalendarQueueTemplateType): string {
  switch (templateType) {
    case 'report':
      return '/reports?compare=previous_period';
    case 'creative_refresh':
      return '/campaigns/intelligence/create';
    case 'campaign_review':
    case 'budget_review':
      return '/dashboard';
    default:
      return '/calendar';
  }
}

function severityForPriority(priority: CalendarQueuePriority): 'info' | 'warning' | 'critical' {
  switch (priority) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'warning';
    default:
      return 'info';
  }
}

function notificationTypeForItem(item: CalendarQueueItem): string {
  if (item.itemType === 'review_report') {
    return 'report';
  }

  if (item.sourceType === 'system' || item.parentQueueItemId) {
    return 'calendar';
  }

  return 'workflow';
}

function formatScheduledAt(value: string | null, timeZone: string): string {
  if (!value) {
    return 'the scheduled time';
  }

  return new Date(value).toLocaleString('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildReportHref(item: CalendarQueueItem, scheduledAt: Date): string {
  const baseHref = item.destinationHref || '/reports';
  const url = new URL(baseHref, 'https://deepvisor.local');
  const payload = asRecord(item.payload);
  const timeZone =
    typeof payload.timeZone === 'string' && payload.timeZone.length > 0
      ? payload.timeZone
      : DEFAULT_TIME_ZONE;
  const dateTo = toZonedDateKey(scheduledAt, timeZone);
  const recurrenceType =
    typeof payload.recurrenceType === 'string' ? payload.recurrenceType : 'weekly';
  const lookbackDays = recurrenceType === 'monthly' ? 30 : 7;

  url.searchParams.set('ad_account_id', item.adAccountId);
  url.searchParams.set('platform_integration_id', item.platformIntegrationId);
  url.searchParams.set('date_to', dateTo);
  url.searchParams.set('date_from', addDaysToDateKey(dateTo, -(lookbackDays - 1)));
  url.searchParams.set('group_by', 'day');

  return `${url.pathname}${url.search}`;
}

function buildActionHref(item: CalendarQueueItem): string | null {
  if (item.itemType === 'review_report') {
    return buildReportHref(item, item.scheduledFor ? new Date(item.scheduledFor) : new Date());
  }

  return item.destinationHref ?? '/calendar';
}

function buildNotificationCopy(input: {
  item: CalendarQueueItem;
  accountName: string | null;
  timeZone: string;
}) {
  const scheduledLabel = formatScheduledAt(input.item.scheduledFor ?? null, input.timeZone);
  const accountCopy = input.accountName ? ` for ${input.accountName}` : '';

  if (input.item.itemType === 'review_report') {
    return {
      title: `Report ready: ${input.item.title}`,
      message: `${input.item.title}${accountCopy} ran at ${scheduledLabel}. Open the report window to review the generated performance view.`,
    };
  }

  return {
    title: `Scheduled queue ran: ${input.item.title}`,
    message: `${input.item.title}${accountCopy} reached its scheduled time at ${scheduledLabel}. Open the linked workspace action to continue.`,
  };
}

function buildOccurrenceKey(template: CalendarQueueTemplate, dateKey: string): string {
  return `calendar-template:${template.id}:${dateKey}:${normalizeTimeOfDay(template.timeOfDay)}`;
}

async function getAccountContext(
  supabase: IntelligenceClient,
  cache: Map<string, AccountContext | null>,
  adAccountId: string
): Promise<AccountContext | null> {
  if (cache.has(adAccountId)) {
    return cache.get(adAccountId) ?? null;
  }

  const { data, error } = await supabase
    .from('ad_accounts')
    .select('id, business_id, name, platform_id, timezone')
    .eq('id', adAccountId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const account = data as AccountContext | null;
  cache.set(adAccountId, account);
  return account;
}

async function resolvePlatformIntegrationId(
  supabase: IntelligenceClient,
  cache: Map<string, string | null>,
  input: {
    businessId: string;
    platformId: string;
    platformIntegrationId: string | null;
  }
): Promise<string | null> {
  if (input.platformIntegrationId) {
    return input.platformIntegrationId;
  }

  const cacheKey = `${input.businessId}:${input.platformId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const { data, error } = await supabase
    .from('platform_integrations')
    .select('id')
    .eq('business_id', input.businessId)
    .eq('platform_id', input.platformId)
    .neq('status', 'disconnected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const integrationId = data?.id ?? null;
  cache.set(cacheKey, integrationId);
  return integrationId;
}

async function getBusinessContext(
  supabase: IntelligenceClient,
  cache: Map<string, BusinessContext | null>,
  businessId: string
): Promise<BusinessContext | null> {
  if (cache.has(businessId)) {
    return cache.get(businessId) ?? null;
  }

  const { data, error } = await supabase
    .from('business_profiles')
    .select('id, business_name, organization_id')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const business = data as BusinessContext | null;
  cache.set(businessId, business);
  return business;
}

async function getNotificationUserIds(
  supabase: IntelligenceClient,
  cache: Map<string, string[]>,
  input: {
    business: BusinessContext | null;
    platformIntegrationId: string | null;
  }
): Promise<string[]> {
  const businessId = input.business?.id ?? null;
  if (businessId && cache.has(businessId)) {
    return cache.get(businessId) ?? [];
  }

  let userIds: string[] = [];

  if (input.business?.organization_id) {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('organization_id', input.business.organization_id);

    if (error) {
      throw error;
    }

    userIds = Array.from(new Set((data ?? []).map((row) => row.user_id).filter(Boolean)));
  }

  if (userIds.length === 0 && input.platformIntegrationId) {
    const { data, error } = await supabase
      .from('platform_integrations')
      .select('connected_by_user_id')
      .eq('id', input.platformIntegrationId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.connected_by_user_id) {
      userIds = [data.connected_by_user_id];
    }
  }

  if (businessId) {
    cache.set(businessId, userIds);
  }

  return userIds;
}

async function listExistingOccurrenceKeys(
  supabase: IntelligenceClient,
  input: {
    windowStartIso: string;
    nowIso: string;
    businessId?: string | null;
    adAccountId?: string | null;
  }
): Promise<Set<string>> {
  let query = supabase
    .from('calendar_queue_items')
    .select('payload_json')
    .eq('source_type', 'system')
    .not('scheduled_for', 'is', null)
    .gte('scheduled_for', input.windowStartIso)
    .lte('scheduled_for', input.nowIso);

  if (input.businessId) {
    query = query.eq('business_id', input.businessId);
  }

  if (input.adAccountId) {
    query = query.eq('ad_account_id', input.adAccountId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    const payload = asRecord(row.payload_json);
    if (typeof payload.templateOccurrenceKey === 'string') {
      keys.add(payload.templateOccurrenceKey);
    }
  }

  return keys;
}

async function materializeDueTemplateOccurrences(
  supabase: IntelligenceClient,
  input: ProcessorInput & {
    now: Date;
    limit: number;
    lookbackDays: number;
  },
  caches: {
    accounts: Map<string, AccountContext | null>;
    platformIntegrations: Map<string, string | null>;
  }
): Promise<{
  materialized: number;
  skipped: number;
  errors: string[];
}> {
  const nowIso = input.now.toISOString();
  const windowStartUtc = new Date(input.now);
  windowStartUtc.setUTCDate(windowStartUtc.getUTCDate() - (input.lookbackDays + 1));
  windowStartUtc.setUTCHours(0, 0, 0, 0);
  const windowStartDay = toDateKey(windowStartUtc);
  const currentDay = toDateKey(input.now);
  const templates = await listActiveCalendarQueueTemplatesForProcessing(supabase, {
    currentDay,
    windowStartDay,
    businessId: input.businessId,
    adAccountId: input.adAccountId,
  });
  const existingOccurrenceKeys = await listExistingOccurrenceKeys(supabase, {
    windowStartIso: windowStartUtc.toISOString(),
    nowIso,
    businessId: input.businessId,
    adAccountId: input.adAccountId,
  });
  const errors: string[] = [];
  let materialized = 0;
  let skipped = 0;

  for (const template of templates) {
    if (materialized >= input.limit) {
      break;
    }

    if (!template.adAccountId) {
      skipped += 1;
      continue;
    }

    try {
      const account = await getAccountContext(supabase, caches.accounts, template.adAccountId);
      if (!account) {
        skipped += 1;
        continue;
      }

      const timeZone = account.timezone || DEFAULT_TIME_ZONE;
      const localCurrentDay = toZonedDateKey(input.now, timeZone);
      const localWindowStartDay = addDaysToDateKey(localCurrentDay, -input.lookbackDays);
      const rangeStart = maxDateKey(template.startDate, localWindowStartDay);
      const rangeEnd = minDateKey(template.endDate ?? localCurrentDay, localCurrentDay);
      const platformIntegrationId = await resolvePlatformIntegrationId(
        supabase,
        caches.platformIntegrations,
        {
          businessId: template.businessId,
          platformId: account.platform_id,
          platformIntegrationId: template.platformIntegrationId,
        }
      );

      if (!platformIntegrationId) {
        skipped += 1;
        continue;
      }

      for (
        let dateKey = rangeStart;
        dateKey <= rangeEnd && materialized < input.limit;
        dateKey = addDaysToDateKey(dateKey, 1)
      ) {
        if (!templateRunsOnDate(template, dateKey)) {
          continue;
        }

        const scheduledFor = zonedDateTimeToUtc(dateKey, template.timeOfDay, timeZone);
        if (scheduledFor.getTime() > input.now.getTime()) {
          continue;
        }

        const occurrenceKey = buildOccurrenceKey(template, dateKey);
        if (existingOccurrenceKeys.has(occurrenceKey)) {
          continue;
        }

        const draft: CalendarQueueItemDraft = {
          businessId: template.businessId,
          platformIntegrationId,
          adAccountId: template.adAccountId,
          sourceSignalId: null,
          sourceType: 'system',
          itemType: itemTypeForTemplate(template.templateType),
          priority: priorityForTemplate(template.templateType),
          title: template.title,
          description: template.description,
          destinationHref: template.destinationHref ?? defaultDestinationForTemplate(template.templateType),
          scheduledFor: scheduledFor.toISOString(),
          dueDate: dateKey,
          parentQueueItemId: null,
          workflowKey: null,
          materializedFromBlueprintKey: null,
          childBlueprints: [],
          payload: {
            templateId: template.id,
            templateType: template.templateType,
            templateOccurrenceKey: occurrenceKey,
            recurrenceType: template.recurrenceType,
            timeZone,
            durationMinutes: template.durationMinutes,
          },
        };

        await createCalendarQueueItemWithStatus(supabase, draft, 'scheduled');
        existingOccurrenceKeys.add(occurrenceKey);
        materialized += 1;
      }
    } catch (error) {
      errors.push(
        `Template ${template.id}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  return {
    materialized,
    skipped,
    errors,
  };
}

async function processOneQueueItem(
  supabase: IntelligenceClient,
  item: CalendarQueueItem,
  input: {
    timestamp: string;
    caches: {
      accounts: Map<string, AccountContext | null>;
      businesses: Map<string, BusinessContext | null>;
      users: Map<string, string[]>;
    };
  }
): Promise<{
  processed: boolean;
  notifications: number;
}> {
  const claimed = await claimCalendarQueueItemForProcessing(supabase, {
    queueItemId: item.id,
    timestamp: input.timestamp,
  });

  if (!claimed) {
    return { processed: false, notifications: 0 };
  }

  try {
    const [account, business] = await Promise.all([
      getAccountContext(supabase, input.caches.accounts, claimed.adAccountId),
      getBusinessContext(supabase, input.caches.businesses, claimed.businessId),
    ]);
    const timeZone = account?.timezone || DEFAULT_TIME_ZONE;
    const userIds = await getNotificationUserIds(supabase, input.caches.users, {
      business,
      platformIntegrationId: claimed.platformIntegrationId,
    });
    const href = buildActionHref(claimed);
    const copy = buildNotificationCopy({
      item: claimed,
      accountName: account?.name ?? null,
      timeZone,
    });
    const dedupeKey = `calendar-queue:${claimed.id}:processed`;
    let notificationCount = 0;

    for (const userId of userIds) {
      await upsertNotification(supabase, {
        businessId: claimed.businessId,
        userId,
        sourceType: 'calendar_queue_item',
        sourceId: claimed.id,
        dedupeKey,
        severity: severityForPriority(claimed.priority),
        type: notificationTypeForItem(claimed),
        title: copy.title,
        message: copy.message,
        link: href,
        payload: {
          queueItemId: claimed.id,
          adAccountId: claimed.adAccountId,
          scheduledFor: claimed.scheduledFor,
          completedAt: input.timestamp,
        },
      });
      await createOrUpdateDeliveryLog(supabase, {
        businessId: claimed.businessId,
        userId,
        channel: 'in_app',
        sourceType: 'calendar_queue_item',
        sourceId: claimed.id,
        dedupeKey,
        status: 'sent',
        sentAt: input.timestamp,
        payload: {
          queueItemId: claimed.id,
          link: href,
        },
      });
      notificationCount += 1;
    }

    const payload = {
      ...asRecord(claimed.payload),
      execution: {
        status: 'completed',
        processor: 'calendar_queue_processor',
        processedAt: input.timestamp,
        notificationUserIds: userIds,
      },
    };

    await completeCalendarQueueItem(supabase, {
      queueItemId: claimed.id,
      timestamp: input.timestamp,
      payload,
    });

    return {
      processed: true,
      notifications: notificationCount,
    };
  } catch (error) {
    await releaseCalendarQueueItemAfterFailure(supabase, {
      queueItemId: claimed.id,
      timestamp: input.timestamp,
      payload: {
        ...asRecord(claimed.payload),
        execution: {
          status: 'failed',
          processor: 'calendar_queue_processor',
          failedAt: input.timestamp,
          error: error instanceof Error ? error.message : 'Unknown calendar queue processing error',
        },
      },
    });

    throw error;
  }
}

export async function processCalendarQueue(
  supabase: IntelligenceClient,
  input: ProcessorInput = {}
): Promise<CalendarQueueProcessingResult> {
  const now = input.now ?? new Date();
  const limit =
    typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0
      ? Math.min(Math.floor(input.limit), 100)
      : DEFAULT_LIMIT;
  const lookbackDays =
    typeof input.lookbackDays === 'number' &&
    Number.isFinite(input.lookbackDays) &&
    input.lookbackDays > 0
      ? Math.min(Math.floor(input.lookbackDays), 60)
      : DEFAULT_LOOKBACK_DAYS;
  const processedAt = now.toISOString();
  const caches = {
    accounts: new Map<string, AccountContext | null>(),
    businesses: new Map<string, BusinessContext | null>(),
    platformIntegrations: new Map<string, string | null>(),
    users: new Map<string, string[]>(),
  };
  const materializeResult = await materializeDueTemplateOccurrences(
    supabase,
    {
      ...input,
      now,
      limit,
      lookbackDays,
    },
    {
      accounts: caches.accounts,
      platformIntegrations: caches.platformIntegrations,
    }
  );
  const dueItems = await listDueCalendarQueueItems(supabase, {
    nowIso: processedAt,
    limit,
    businessId: input.businessId,
    adAccountId: input.adAccountId,
  });
  const errors = [...materializeResult.errors];
  let processedCount = 0;
  let notificationCount = 0;
  let failedCount = materializeResult.errors.length;

  for (const item of dueItems) {
    try {
      const result = await processOneQueueItem(supabase, item, {
        timestamp: processedAt,
        caches: {
          accounts: caches.accounts,
          businesses: caches.businesses,
          users: caches.users,
        },
      });

      if (result.processed) {
        processedCount += 1;
        notificationCount += result.notifications;
      }
    } catch (error) {
      failedCount += 1;
      errors.push(
        `Queue item ${item.id}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  return {
    success: failedCount === 0,
    processedAt,
    materializedCount: materializeResult.materialized,
    processedCount,
    notificationCount,
    skippedCount: materializeResult.skipped,
    failedCount,
    errors,
  };
}

export async function processCalendarQueueItem(
  supabase: IntelligenceClient,
  item: CalendarQueueItem,
  input: {
    now?: Date;
  } = {}
): Promise<CalendarQueueProcessingResult> {
  const now = input.now ?? new Date();
  const processedAt = now.toISOString();
  const scheduledFor = item.scheduledFor ? new Date(item.scheduledFor) : null;

  if (scheduledFor && scheduledFor.getTime() > now.getTime()) {
    return {
      success: true,
      processedAt,
      materializedCount: 0,
      processedCount: 0,
      notificationCount: 0,
      skippedCount: 1,
      failedCount: 0,
      errors: [],
    };
  }

  try {
    const result = await processOneQueueItem(supabase, item, {
      timestamp: processedAt,
      caches: {
        accounts: new Map<string, AccountContext | null>(),
        businesses: new Map<string, BusinessContext | null>(),
        users: new Map<string, string[]>(),
      },
    });

    return {
      success: true,
      processedAt,
      materializedCount: 0,
      processedCount: result.processed ? 1 : 0,
      notificationCount: result.notifications,
      skippedCount: result.processed ? 0 : 1,
      failedCount: 0,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      processedAt,
      materializedCount: 0,
      processedCount: 0,
      notificationCount: 0,
      skippedCount: 0,
      failedCount: 1,
      errors: [
        `Queue item ${item.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      ],
    };
  }
}
