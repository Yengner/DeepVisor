import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import type { NotificationPreference } from '../types';

type IntelligenceClient = SupabaseClient<Database>;

type NotificationPreferenceRow = {
  id: string;
  business_id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  report_ready_enabled: boolean;
  min_severity: string;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  time_zone: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: NotificationPreferenceRow): NotificationPreference {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    inAppEnabled: row.in_app_enabled,
    emailEnabled: row.email_enabled,
    reportReadyEnabled: row.report_ready_enabled,
    minSeverity: row.min_severity as NotificationPreference['minSeverity'],
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    timeZone: row.time_zone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildDefaultNotificationPreference(input: {
  businessId: string;
  userId: string;
  timeZone?: string | null;
}): NotificationPreference {
  return {
    id: null,
    businessId: input.businessId,
    userId: input.userId,
    inAppEnabled: true,
    emailEnabled: true,
    reportReadyEnabled: true,
    minSeverity: 'warning',
    quietHoursStart: null,
    quietHoursEnd: null,
    timeZone: input.timeZone ?? null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function getNotificationPreference(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    userId: string;
    defaultTimeZone?: string | null;
  }
): Promise<NotificationPreference> {
  const { data, error } = await (supabase as any)
    .from('notification_preferences')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? mapRow(data as NotificationPreferenceRow)
    : buildDefaultNotificationPreference({
        businessId: input.businessId,
        userId: input.userId,
        timeZone: input.defaultTimeZone,
      });
}

export async function upsertNotificationPreference(
  supabase: IntelligenceClient,
  input: NotificationPreference
): Promise<NotificationPreference> {
  const timestamp = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('notification_preferences')
    .upsert(
      {
        business_id: input.businessId,
        user_id: input.userId,
        in_app_enabled: input.inAppEnabled,
        email_enabled: input.emailEnabled,
        report_ready_enabled: input.reportReadyEnabled,
        min_severity: input.minSeverity,
        quiet_hours_start: input.quietHoursStart,
        quiet_hours_end: input.quietHoursEnd,
        time_zone: input.timeZone,
        updated_at: timestamp,
      },
      {
        onConflict: 'business_id,user_id',
      }
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data as NotificationPreferenceRow);
}

export async function listNotificationPreferencesForBusiness(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    defaultTimeZone?: string | null;
    userIds?: string[];
  }
): Promise<NotificationPreference[]> {
  let query = (supabase as any)
    .from('notification_preferences')
    .select('*')
    .eq('business_id', input.businessId);

  if (input.userIds && input.userIds.length > 0) {
    query = query.in('user_id', input.userIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as NotificationPreferenceRow[]).map(mapRow);
}
