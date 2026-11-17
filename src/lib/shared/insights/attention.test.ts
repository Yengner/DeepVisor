import { describe, expect, it } from 'vitest';
import { adSchedule } from '@/lib/shared/performance/schedule';
import { attentionItems } from './attention';
import type { IssueEvidence } from './model';

const now = '2026-11-15T12:00:00Z';
const billing: IssueEvidence & { observedAt: string } = {
  key: 'account-disabled', title: 'Meta reports an unpaid balance', explanation: 'Ads can’t run until the balance is paid.',
  action: 'Review billing in Meta', href: 'https://business.facebook.com/billing_hub/payment_settings', entities: [], code: 'ACCOUNT_STATUS_3', observedAt: '2026-11-15T10:00:00Z',
};
const adset = (id: string, end: string | null, delivery = 'ACTIVE') => ({
  id, name: `Ad set ${id}`, delivery,
  schedule: adSchedule({ start_time: '2026-11-01T12:00:00Z', ...(end ? { end_time: end } : {}) }, null, now),
});

describe('attentionItems', () => {
  it('puts Meta issues first, then active ad sets ending within two days, soonest first', () => {
    const items = attentionItems([billing], [adset('a', '2026-11-17T18:00:00Z'), adset('b', '2026-11-15T20:00:00Z'), adset('c', '2026-11-30T12:00:00Z')], { now, zone: 'UTC' });
    expect(items.map((i) => [i.tone, i.title])).toEqual([
      ['urgent', 'Meta reports an unpaid balance'],
      ['soon', 'Ad set b ends today'],
      ['soon', 'Ad set a ends in 2 days'],
    ]);
    expect(items[0].action).toEqual({ label: 'Review billing in Meta', href: billing.href });
    expect(items[0].note).toBeUndefined();
  });

  it('skips paused, ended and open-ended ad sets', () => {
    const items = attentionItems([], [adset('p', '2026-11-16T12:00:00Z', 'PAUSED'), adset('e', '2026-11-15T06:00:00Z'), adset('o', null)], { now, zone: 'UTC' });
    expect(items).toEqual([]);
  });

  it('dates an issue Meta has not re-reported for a day, and never repeats one', () => {
    const old = { ...billing, observedAt: '2026-11-13T09:00:00Z' };
    const items = attentionItems([old, old], [], { now, zone: 'UTC' });
    expect(items).toHaveLength(1);
    expect(items[0].note).toBe('Last reported by Meta on Nov 13');
  });
});
