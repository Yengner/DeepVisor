import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/server/insights/issues', () => ({ observeHierarchyIssues: vi.fn(), captureAccountHealth: vi.fn() }));
import { mergeAds, targetedAdIds } from './service';
import type { Observation } from '@/lib/shared/lifecycle/model';

const set: Observation = { id: '10', level: 'adset', parent: '1', campaign: '1', name: 'Set', configured: 'ACTIVE', effective: 'ACTIVE', start: '2026-11-01T00:00:00Z', end: null, dailyBudget: 5000, lifetimeBudget: null, targeting: { age_min: 18 } };
const old: Observation = { ...set, id: '100', level: 'ad', parent: '10', name: 'Ad', dailyBudget: null };
const ad = (over: Record<string, unknown> = {}) => ({ id: '100', adset_id: '10', name: 'Ad', status: 'ACTIVE', effective_status: 'DISAPPROVED', ...over });

it('targets only small batches made entirely of ads', () => {
  expect(targetedAdIds([{ id: '1', level: 'ad' }, { id: '1', level: 'ad' }, { id: '2', level: 'ad' }])).toEqual(['1', '2']);
  expect(targetedAdIds([{ id: '1', level: 'ad' }, { id: '2', level: 'adset' }])).toBeNull();
  expect(targetedAdIds([{ id: 'dvsim_x', level: 'ad' }])).toBeNull();
  expect(targetedAdIds(Array.from({ length: 26 }, (_, n) => ({ id: String(n + 1), level: 'ad' })))).toBeNull();
  expect(targetedAdIds(undefined)).toBeNull();
  expect(targetedAdIds([])).toBeNull();
});
it('replaces the named ad and inherits schedule and audience from its saved ad set', () => {
  const merged = mergeAds([set, old], [ad()])!;
  expect(merged).toHaveLength(2);
  expect(merged.find(e => e.id === '100')).toMatchObject({ effective: 'DISAPPROVED', configured: 'ACTIVE', parent: '10', campaign: '1', start: set.start, targeting: set.targeting });
  expect(mergeAds([set], [ad({ id: '101' })])!.map(e => e.id)).toEqual(['10', '101']);
});
it('refuses a partial merge when the baseline cannot explain the ad', () => {
  expect(mergeAds([old], [ad()])).toBeNull();
  expect(mergeAds([set, old], [ad({ adset_id: null })])).toBeNull();
  expect(mergeAds([set, old], [ad({ effective_status: 'ADSET_PAUSED' })])).toBeNull();
  expect(mergeAds([set, old], [ad({ effective_status: 'CAMPAIGN_PAUSED' })])).toBeNull();
});
