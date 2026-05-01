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

export interface MetaAdCreativeSeed {
  externalId: string;
  name: string | null;
  creativeType: string | null;
  ctaType: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  imageHash: string | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  pageId: string | null;
  instagramActorId: string | null;
  objectStoryId: string | null;
  objectStorySpec: Json | null;
  assetFeedSpec: Json | null;
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

export interface MetaAudienceBreakdownSeed {
  entityLevel: 'adset' | 'ad';
  entityExternalId: string;
  adsetExternalId: string;
  adExternalId: string | null;
  campaignExternalId: string | null;
  day: string;
  breakdownType: string;
  dimension1Key: string;
  dimension1Value: string;
  dimension2Key: string;
  dimension2Value: string;
  publisherPlatform: string | null;
  platformPosition: string | null;
  impressionDevice: string | null;
  currencyCode: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  actions: Json;
  costPerActionType: Json;
  raw: Json | null;
}

export interface MetaHourlyPerformanceSeed {
  entityLevel: 'adset' | 'ad';
  entityExternalId: string;
  adsetExternalId: string;
  adExternalId: string | null;
  campaignExternalId: string | null;
  day: string;
  weekStart: string;
  dayOfWeek: number;
  hourOfDay: number;
  advertiserTimeBucket: string;
  timeBasis: 'advertiser';
  currencyCode: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  ctr: number;
  cpc: number;
  cpm: number;
  actions: Json;
  costPerActionType: Json;
  raw: Json | null;
}
