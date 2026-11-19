import { expect, it } from 'vitest';
import { normalize } from './insightModel';

it('keeps a zero-spend breakdown row as zero delivery instead of failing the whole refresh', () => {
  const [row] = normalize([{ adset_id: '1', date_start: '2026-11-17', date_stop: '2026-11-17', publisher_platform: 'facebook', age: '25-34', gender: 'female', spend: '0',
    actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '1' }] }], 'USD');
  expect(row).toMatchObject({ spend: 0, impressions: 0, clicks: 0, messages: 1 });
  expect(() => normalize([{ adset_id: '1', date_start: '2026-11-17', publisher_platform: 'facebook', spend: '3.10' }], 'USD')).toThrow('Required Meta delivery metric unavailable');
});
