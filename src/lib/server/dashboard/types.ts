

export type DashboardBreakdownState = 'available' | 'syncing' | 'unsupported';

export interface DashboardAudienceMetricRow {
  entityLevel: 'adset' | 'ad';
  adsetInternalId: string | null;
  adInternalId: string | null;
  breakdownType: string;
  dimension1Key: string;
  dimension1Value: string;
  dimension2Key: string;
  dimension2Value: string;
  publisherPlatform: string | null;
  platformPosition: string | null;
  impressionDevice: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
  calls: number;
}

export interface DashboardPlatformSlice {
  key: string;
  kind: 'publisher_platform' | 'platform_position' | 'impression_device';
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  shareOfSpend: number;
}

export interface DashboardAudienceSlice {
  key: string;
  kind: 'age_gender' | 'geo';
  label: string;
  secondaryLabel: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  shareOfSpend: number;
}

export interface DashboardPlatformBreakdowns {
  state: DashboardBreakdownState;
  publisherPlatforms: DashboardPlatformSlice[];
  placements: DashboardPlatformSlice[];
  impressionDevices: DashboardPlatformSlice[];
}

export interface DashboardAudienceBreakdowns {
  state: DashboardBreakdownState;
  ageGender: DashboardAudienceSlice[];
  geo: DashboardAudienceSlice[];
}

export interface DashboardTrendPoint {
  label: string;
  dayKey: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  spend: number;
  results: number;
  clicks: number;
  inlineLinkClicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  costPerResult: number;
}
