import type { RepositoryClient } from '../utils';

export type BusinessDataPolicy = {
  id: string;
  business_id: string;
  plan_key: string;
  max_ad_accounts: number;
  daily_history_days: number;
  hourly_history_days: number;
  audience_history_days: number;
  allowed_breakdowns: string[];
  allow_ad_level_hourly: boolean;
  allow_ad_level_audience: boolean;
  manual_refresh_limit_per_day: number;
  created_at: string;
  updated_at: string;
};

export const TRIAL_DATA_POLICY_DEFAULTS = {
  plan_key: 'trial',
  max_ad_accounts: 1,
  daily_history_days: 30,
  hourly_history_days: 7,
  audience_history_days: 14,
  allowed_breakdowns: [
    'publisher_platform',
    'platform_position',
    'impression_device',
    'age_gender',
    'country',
    'region',
    'dma',
  ],
  allow_ad_level_hourly: false,
  allow_ad_level_audience: false,
  manual_refresh_limit_per_day: 1,
} as const;

export async function getOrCreateBusinessDataPolicy(
  supabase: RepositoryClient,
  businessId: string
): Promise<BusinessDataPolicy> {
  const client = supabase as any;
  const { data: existing, error: selectError } = await client
    .from('business_data_policies')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing as BusinessDataPolicy;
  }

  const { data, error } = await client
    .from('business_data_policies')
    .insert({
      business_id: businessId,
      ...TRIAL_DATA_POLICY_DEFAULTS,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as BusinessDataPolicy;
}

export function clampHistoryDays(value: number, maxDays: number): number {
  const normalizedValue = Number.isFinite(value) && value > 0 ? Math.floor(value) : maxDays;
  return Math.max(1, Math.min(normalizedValue, Math.max(1, maxDays)));
}
