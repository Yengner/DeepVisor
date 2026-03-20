import { asNumber, asRecord, asString } from '@/lib/shared';
import type { DashboardCampaignSnapshotItem } from '@/lib/server/dashboard/types';
import type { CampaignMetric } from '../types';

export function deriveCampaignResultMetrics(
  value: unknown
): Pick<CampaignMetric, 'conversion' | 'conversion_rate' | 'cost_per_result'> {
  const campaign = asRecord(value);
  const spend = asNumber(campaign.spend);
  const clicks = asNumber(campaign.clicks);
  const leads = asNumber(campaign.leads);
  const messages = asNumber(campaign.messages);
  const conversion = asNumber(campaign.conversion) || leads + messages;

  return {
    conversion,
    conversion_rate:
      asNumber(campaign.conversion_rate) || (clicks > 0 ? (conversion / clicks) * 100 : 0),
    cost_per_result: asNumber(campaign.cost_per_result) || (conversion > 0 ? spend / conversion : 0),
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
        status: asString(campaign.status) || 'unknown',
        spend,
        clicks,
        leads,
        messages,
        conversion,
        conversionRate,
        costPerResult,
      };
    })
    .filter((campaign) => Boolean(campaign.campaignId))
    .slice(0, 5);
}
