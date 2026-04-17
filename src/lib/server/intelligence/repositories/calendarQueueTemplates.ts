import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  CalendarQueueTemplate,
  CalendarQueueTemplateRecurrence,
  CalendarQueueTemplateType,
} from '@/lib/shared';

type IntelligenceClient = SupabaseClient<Database>;

type QueueTemplateRow = {
  id: string;
  business_id: string;
  platform_integration_id: string | null;
  ad_account_id: string | null;
  template_type: CalendarQueueTemplateType;
  title: string;
  description: string | null;
  destination_href: string | null;
  recurrence_type: CalendarQueueTemplateRecurrence;
  weekdays: number[] | null;
  monthly_day: number | null;
  time_of_day: string;
  duration_minutes: number;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'paused';
  created_at: string;
  updated_at: string;
};

export type CalendarQueueTemplateDraft = {
  businessId: string;
  platformIntegrationId: string | null;
  adAccountId: string | null;
  templateType: CalendarQueueTemplateType;
  title: string;
  description: string;
  destinationHref: string | null;
  recurrenceType: CalendarQueueTemplateRecurrence;
  weekdays: number[];
  monthlyDay: number | null;
  timeOfDay: string;
  durationMinutes: number;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'paused';
};

function mapQueueTemplateRow(row: QueueTemplateRow): CalendarQueueTemplate {
  return {
    id: row.id,
    businessId: row.business_id,
    platformIntegrationId: row.platform_integration_id,
    adAccountId: row.ad_account_id,
    templateType: row.template_type,
    title: row.title,
    description: row.description ?? '',
    destinationHref: row.destination_href,
    recurrenceType: row.recurrence_type,
    weekdays: Array.isArray(row.weekdays) ? row.weekdays : [],
    monthlyDay: row.monthly_day,
    timeOfDay: row.time_of_day,
    durationMinutes: row.duration_minutes,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInsert(draft: CalendarQueueTemplateDraft) {
  return {
    business_id: draft.businessId,
    platform_integration_id: draft.platformIntegrationId,
    ad_account_id: draft.adAccountId,
    template_type: draft.templateType,
    title: draft.title,
    description: draft.description,
    destination_href: draft.destinationHref,
    recurrence_type: draft.recurrenceType,
    weekdays: draft.weekdays,
    monthly_day: draft.monthlyDay,
    time_of_day: draft.timeOfDay,
    duration_minutes: draft.durationMinutes,
    start_date: draft.startDate,
    end_date: draft.endDate,
    status: draft.status,
  };
}

export async function listCalendarQueueTemplates(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string | null;
  }
): Promise<CalendarQueueTemplate[]> {
  let query = (supabase as any)
    .from('calendar_queue_templates')
    .select('*')
    .eq('business_id', input.businessId)
    .order('created_at', { ascending: false });

  if (input.adAccountId) {
    query = query.or(`ad_account_id.eq.${input.adAccountId},ad_account_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as QueueTemplateRow[]).map(mapQueueTemplateRow);
}

export async function createCalendarQueueTemplate(
  supabase: IntelligenceClient,
  draft: CalendarQueueTemplateDraft
): Promise<CalendarQueueTemplate> {
  const { data, error } = await (supabase as any)
    .from('calendar_queue_templates')
    .insert(toInsert(draft))
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create queue template');
  }

  return mapQueueTemplateRow(data as QueueTemplateRow);
}

export async function updateCalendarQueueTemplate(
  supabase: IntelligenceClient,
  input: {
    id: string;
    businessId: string;
    patch: Partial<CalendarQueueTemplateDraft>;
  }
): Promise<CalendarQueueTemplate> {
  const patch = {
    platform_integration_id: input.patch.platformIntegrationId,
    ad_account_id: input.patch.adAccountId,
    template_type: input.patch.templateType,
    title: input.patch.title,
    description: input.patch.description,
    destination_href: input.patch.destinationHref,
    recurrence_type: input.patch.recurrenceType,
    weekdays: input.patch.weekdays,
    monthly_day: input.patch.monthlyDay,
    time_of_day: input.patch.timeOfDay,
    duration_minutes: input.patch.durationMinutes,
    start_date: input.patch.startDate,
    end_date: input.patch.endDate,
    status: input.patch.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from('calendar_queue_templates')
    .update(patch)
    .eq('id', input.id)
    .eq('business_id', input.businessId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update queue template');
  }

  return mapQueueTemplateRow(data as QueueTemplateRow);
}

export async function deleteCalendarQueueTemplate(
  supabase: IntelligenceClient,
  input: {
    id: string;
    businessId: string;
  }
): Promise<void> {
  const { error } = await (supabase as any)
    .from('calendar_queue_templates')
    .delete()
    .eq('id', input.id)
    .eq('business_id', input.businessId);

  if (error) {
    throw error;
  }
}
