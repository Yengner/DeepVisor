import { asNumber, asRecord, asString } from '@/lib/shared';
import type { DashboardCampaignSnapshotItem } from '@/lib/server/dashboard/types';
import type { CampaignMetric } from '../types';

import { derivePerformanceMetrics } from '@/lib/shared/performance/metrics';
export { derivePerformanceMetrics, type DerivedPerformanceMetrics } from '@/lib/shared/performance/metrics';

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
