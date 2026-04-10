import { asNumber, asRecord, asString } from '@/lib/shared';
import type { DashboardCampaignSnapshotItem } from '@/lib/server/dashboard/types';
import type { CampaignMetric } from '../types';

export interface DerivedPerformanceMetrics {
  conversion: number;
  conversion_rate: number;
  cost_per_result: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
}

export function derivePerformanceMetrics(value: unknown): DerivedPerformanceMetrics {
  const entity = asRecord(value);
  const spend = asNumber(entity.spend);
  const clicks = asNumber(entity.clicks);
  const leads = asNumber(entity.leads);
  const messages = asNumber(entity.messages);
  const impressions = asNumber(entity.impressions);
  const reach = asNumber(entity.reach);
  const conversion = asNumber(entity.conversion) || leads + messages;

  return {
    conversion,
    conversion_rate:
      asNumber(entity.conversion_rate) || (clicks > 0 ? (conversion / clicks) * 100 : 0),
    cost_per_result: asNumber(entity.cost_per_result) || (conversion > 0 ? spend / conversion : 0),
    ctr: asNumber(entity.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
    cpc: asNumber(entity.cpc) || (clicks > 0 ? spend / clicks : 0),
    cpm: asNumber(entity.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0),
    frequency: asNumber(entity.frequency) || (reach > 0 ? impressions / reach : 0),
  };
}

export function deriveCampaignResultMetrics(
  value: unknown
): Pick<CampaignMetric, 'conversion' | 'conversion_rate' | 'cost_per_result'> {
  const {
    conversion,
    conversion_rate: conversionRate,
    cost_per_result: costPerResult,
  } = derivePerformanceMetrics(value);

  return {
    conversion,
    conversion_rate: conversionRate,
    cost_per_result: costPerResult,
  };
}

export function normalizeCampaignSnapshot(value: unknown): DashboardCampaignSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      const campaign = asRecord(row);
      const spend = asNumber(campaign.spend);
      const clicks = asNumber(campaign.clicks);
      const leads = asNumber(campaign.leads);
      const messages = asNumber(campaign.messages);
      const {
        conversion,
        conversion_rate: conversionRate,
        cost_per_result: costPerResult,
      } = deriveCampaignResultMetrics(campaign);

      return {
        campaignId: asString(campaign.campaign_id) || asString(campaign.id),
        campaignName:
          asString(campaign.campaign_name) || asString(campaign.name) || 'Unnamed campaign',
        objective: asString(campaign.objective) || null,
        status: asString(campaign.status) || 'unknown',
        spend,
        clicks,
        leads,
        messages,
        conversion,
        conversionRate,
        costPerResult,
        ctr: asNumber(campaign.ctr),
      };
    })
    .filter((campaign) => Boolean(campaign.campaignId))
    .slice(0, 5);
}
