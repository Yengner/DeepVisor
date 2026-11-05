import { asNumber, asRecord } from '@/lib/shared/utils/format';

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
  const calls = asNumber(entity.calls);
  const impressions = asNumber(entity.impressions);
  const reach = asNumber(entity.reach);
  const conversion = asNumber(entity.conversion) || leads + messages + calls;

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

