import type { Json } from '@/lib/shared/types/supabase';

export type MetaActionMetric = {
  action_type?: string;
  value?: string;
};

export interface MetaCampaignSeed {
  externalId: string;
  name: string | null;
  objective: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  raw: Json | null;
}

export interface MetaAdsetSeed {
  externalId: string;
  campaignExternalId: string | null;
  name: string | null;
  optimizationGoal: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  raw: Json | null;
}

export interface MetaAdSeed {
  externalId: string;
  adsetExternalId: string | null;
  name: string | null;
  creativeId: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  raw: Json | null;
}

export interface MetaCampaignPerformanceSeed {
  campaignExternalId: string;
  day: string;
  currencyCode: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
}

export interface MetaAdAccountPerformanceSeed {
  day: string;
  currencyCode: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
}

export interface MetaAdsetPerformanceSeed {
  adsetExternalId: string;
  day: string;
  currencyCode: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
}

export interface MetaAdPerformanceSeed {
  adExternalId: string;
  day: string;
  currencyCode: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
}
