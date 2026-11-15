import { describe, expect, it } from 'vitest';
import { affectedObjects, noticeText, parseMetaWebhook } from './meta';

const delivery = (changes: unknown[], id: unknown = '123', time: unknown = 1_700_000_000) => ({ object: 'ad_account', entry: [{ id, time, changes }] });

describe('parseMetaWebhook', () => {
  it('reads an effective_status change as a refresh signal with no status claim', () => {
    const [event] = parseMetaWebhook(delivery([{ field: 'effective_status', value: { object_id: '555', object_type: 'adset', changed_fields: ['effective_status'] } }]))!;
    expect(event).toMatchObject({ externalAccountId: '123', field: 'effective_status', objectId: '555', level: 'adset', refresh: true, sentAt: '2023-11-14T22:13:20.000Z' });
    expect(event.detail).toEqual({ changed_fields: 'effective_status' });
  });
  it('keeps Meta’s notice text for issues and fatigue, trimmed', () => {
    const events = parseMetaWebhook(delivery([
      { field: 'with_issues_ad_objects', value: { id: '9', level: 'AD', error_code: 1815869, error_summary: ' Payment\nfailed ', error_message: 'x'.repeat(400) } },
      { field: 'creative_fatigue', value: { ad_account_id: '123', adgroup_id: 77, creative_fatigue_level: 'HIGH', creative_fatigue_message: 'Cost per result is rising' } },
      { field: 'in_process_ad_objects', value: { id: '10', level: 'AD_SET', status_name: 'ACTIVE' } },
    ]))!;
    expect(events[0]).toMatchObject({ objectId: '9', level: 'ad', detail: { error_code: '1815869', error_summary: 'Payment failed' } });
    expect(events[0].detail.error_message).toHaveLength(240);
    expect(events[1]).toMatchObject({ objectId: '77', level: 'ad', refresh: true, detail: { creative_fatigue_level: 'HIGH' } });
    expect(events[2]).toMatchObject({ objectId: '10', level: 'adset' });
  });
  it('stores unknown or non-refresh fields without asking for a read', () => {
    const events = parseMetaWebhook(delivery([{ field: 'ad_recommendations', value: { ad_object_ids: ['1'], recommendation_type: 'X' } }, { field: 'something_new', value: { secret: 'ignored' } }]))!;
    expect(events.map(e => e.refresh)).toEqual([false, false]);
    expect(events[1].detail).toEqual({});
    expect(affectedObjects(events)).toBeNull();
  });
  it('accepts act_ prefixed and numeric account ids and skips malformed entries', () => {
    expect(parseMetaWebhook(delivery([{ field: 'effective_status', value: { object_id: '1', object_type: 'ad' } }], 'act_42'))![0].externalAccountId).toBe('42');
    expect(parseMetaWebhook(delivery([{ field: 'effective_status', value: {} }], 'not-an-id'))).toEqual([]);
    expect(parseMetaWebhook(delivery([{ field: 'BAD FIELD', value: {} }, 'junk', null]))).toEqual([]);
    expect(parseMetaWebhook({ object: 'page', entry: [] })).toBeNull();
    expect(parseMetaWebhook('nope')).toBeNull();
  });
  it('gives retried deliveries the same identity and different changes different ones', () => {
    const change = { field: 'effective_status', value: { object_id: '1', object_type: 'ad' } };
    const a = parseMetaWebhook(delivery([change]))![0], b = parseMetaWebhook(delivery([change]))![0];
    const later = parseMetaWebhook(delivery([change], '123', 1_700_000_060))![0];
    expect(a.identity).toBe(b.identity);
    expect(later.identity).not.toBe(a.identity);
  });
  it('caps the changes handled from one delivery', () => {
    const many = Array.from({ length: 500 }, (_, n) => ({ field: 'effective_status', value: { object_id: String(n + 1), object_type: 'ad' } }));
    expect(parseMetaWebhook(delivery(many))).toHaveLength(200);
  });
});

describe('affectedObjects', () => {
  it('lists distinct objects, and widens when one has no id or there are too many', () => {
    const events = parseMetaWebhook(delivery([
      { field: 'effective_status', value: { object_id: '1', object_type: 'ad' } },
      { field: 'effective_status', value: { object_id: '1', object_type: 'ad' } },
      { field: 'with_issues_ad_objects', value: { id: '2', level: 'CAMPAIGN' } },
    ]))!;
    expect(affectedObjects(events)).toEqual([{ id: '1', level: 'ad' }, { id: '2', level: 'campaign' }]);
    expect(affectedObjects(parseMetaWebhook(delivery([{ field: 'effective_status', value: { changed_fields: ['effective_status'] } }]))!)).toBeNull();
    const many = Array.from({ length: 60 }, (_, n) => ({ field: 'effective_status', value: { object_id: String(n + 1), object_type: 'ad' } }));
    expect(affectedObjects(parseMetaWebhook(delivery(many))!)).toBeNull();
  });
});

describe('noticeText', () => {
  it('removes control characters and empty text', () => {
    expect(noticeText('a\u0000b\tc')).toBe('a b c');
    expect(noticeText('   ')).toBeNull();
    expect(noticeText({})).toBeNull();
  });
});
