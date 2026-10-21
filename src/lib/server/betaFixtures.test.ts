import { describe, it, expect } from 'vitest';
import { businesses, generateFixture, rates, totals, uid, dayAt, AS_OF } from '../../../scripts/beta-fixtures/fixture';
const f = generateFixture(uid('platform'), 'https://test.example/media');
describe('deterministic beta fixture generator', () => {
  it('is repeatable with disjoint businesses and the required delivery states', () => {
    expect(generateFixture(uid('platform'), 'https://test.example/media')).toEqual(f);
    const a = f.entities.filter(e => e.business_id === businesses[0].id);
    expect(a.filter(e => e.entity_level === 'campaign')).toHaveLength(3);
    expect(a.filter(e => e.entity_level === 'adset')).toHaveLength(5);
    expect(a.filter(e => e.entity_level === 'adset' && e.status === 'ACTIVE')).toHaveLength(1);
    expect(new Set(f.entities.map(e => e.id)).size).toBe(f.entities.length);
  });
  it('keeps ads and ad sets mathematically coherent and missing days absent', () => {
    for (const set of f.entities.filter(e => e.entity_level === 'adset')) {
      const children = new Set(f.entities.filter(e => e.adset_id === set.id).map(e => e.id));
      expect(children.size).toBeGreaterThanOrEqual(2);
      for (const row of f.daily.filter(r => r.entity_id === set.id)) {
        const ads = f.daily.filter(r => children.has(r.entity_id) && r.day === row.day);
        const total = totals(ads);
        for (const k of ['spend', 'impressions', 'clicks', 'leads', 'messages'] as const) expect(total[k]).toBe(row[k]);
        expect(row.clicks).toBeLessThanOrEqual(row.impressions);
      }
    }
    expect(f.daily.filter(r => r.entity_id === uid('a:adset-4'))).toHaveLength(2);
    expect(f.daily.filter(r => r.entity_id === uid('a:adset-3')).length).toBeLessThan(90);
    expect(f.daily.filter(r => r.day === AS_OF).every(r => r.spend === 0)).toBe(true);
  });
  it('has known weekly metrics and a deteriorating cost per result', () => {
    const window = (id: string, start: number, end: number) => totals(f.daily.filter(r => r.entity_id === uid(id) && r.day >= dayAt(start) && r.day <= dayAt(end)));
    const current = window('a:adset-0', -7, -1), previous = window('a:adset-0', -14, -8);
    expect(current.spend).toBe(420); expect(current.leads + current.messages).toBe(84);
    expect(rates(current).cost_per_result).toBe(5); expect(rates(previous).cost_per_result).toBe(7);
    expect(rates(window('a:adset-1', -7, -3)).cost_per_result).toBe(36);
    expect(rates(window('a:adset-1', -14, -8)).cost_per_result).toBe(18);
    expect(rates(window('a:adset-2', -7, -3)).cost_per_result).toBeNull();
    expect(rates(current).ctr).toBe(3);
  });
  it('preserves snapshot coverage and never sums daily reach into period reach', () => {
    expect(new Set(f.audience.map(r => r.first_day)).size).toBe(2);
    const summary = f.summaries.find(r => r.entity_id === uid('a:adset-0'))!;
    expect(summary.reach).toBe(3600);
    expect(f.creatives.some(c => !c.image_url && !c.thumbnail_url)).toBe(true);
  });
});
