import type { Json } from '@/lib/shared/types/supabase';

export type AdEntityLevel = 'campaign' | 'adset' | 'ad';

export type AdEntityRow = {
  id: string;
  business_id: string;
  ad_account_id: string;
  platform_id: string;
  platform_integration_id: string | null;
  entity_level: AdEntityLevel;
  external_id: string;
  parent_id: string | null;
  parent_external_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  name: string | null;
  objective: string | null;
  optimization_goal: string | null;
  status: string | null;
  creative_external_id: string | null;
  created_time: string | null;
  updated_time: string | null;
  raw: Json;
  created_at: string;
  updated_at: string;
};

export type CampaignEntityRow = AdEntityRow & {
  entity_level: 'campaign';
};

export type AdsetEntityRow = AdEntityRow & {
  entity_level: 'adset';
  campaign_external_id: string;
};

export type AdEntityCompatRow = AdEntityRow & {
  entity_level: 'ad';
  adset_external_id: string;
  creative_id: string | null;
};

export type AdAccountEntityScope = {
  id: string;
  business_id: string;
  platform_id: string;
};

export function toAdsetCompatRow(row: AdEntityRow): AdsetEntityRow {
  return {
    ...row,
    entity_level: 'adset',
    campaign_external_id: row.parent_external_id ?? '',
  };
}

export function toAdCompatRow(row: AdEntityRow): AdEntityCompatRow {
  return {
    ...row,
    entity_level: 'ad',
    adset_external_id: row.parent_external_id ?? '',
    creative_id: row.creative_external_id,
  };
}
