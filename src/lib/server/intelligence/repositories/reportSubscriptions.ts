import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import type { ReportSubscriptionSetting } from '../types';

type IntelligenceClient = SupabaseClient<Database>;

type ReportSubscriptionRow = {
  id: string;
  business_id: string;
  user_id: string;
  is_enabled: boolean;
  cadence: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  time_zone: string | null;
  last_sent_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ReportSubscriptionRow): ReportSubscriptionSetting {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    isEnabled: row.is_enabled,
    cadence: row.cadence as ReportSubscriptionSetting['cadence'],
    emailEnabled: row.email_enabled,
    inAppEnabled: row.in_app_enabled,
    timeZone: row.time_zone,
    lastSentAt: row.last_sent_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildDefaultReportSubscription(input: {
  businessId: string;
  userId: string;
  timeZone?: string | null;
}): ReportSubscriptionSetting {
  return {
    id: null,
    businessId: input.businessId,
    userId: input.userId,
    isEnabled: true,
    cadence: 'weekly',
    emailEnabled: true,
    inAppEnabled: true,
    timeZone: input.timeZone ?? null,
    lastSentAt: null,
    nextRunAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function getReportSubscription(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    userId: string;
    defaultTimeZone?: string | null;
  }
): Promise<ReportSubscriptionSetting> {
  const { data, error } = await (supabase as any)
    .from('report_subscriptions')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? mapRow(data as ReportSubscriptionRow)
    : buildDefaultReportSubscription({
        businessId: input.businessId,
        userId: input.userId,
        timeZone: input.defaultTimeZone,
      });
}

export async function upsertReportSubscription(
  supabase: IntelligenceClient,
  input: ReportSubscriptionSetting
): Promise<ReportSubscriptionSetting> {
  const timestamp = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('report_subscriptions')
    .upsert(
      {
        business_id: input.businessId,
        user_id: input.userId,
        is_enabled: input.isEnabled,
        cadence: input.cadence,
        email_enabled: input.emailEnabled,
        in_app_enabled: input.inAppEnabled,
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

  return mapRow(data as ReportSubscriptionRow);
}
