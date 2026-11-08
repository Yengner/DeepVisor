import { it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock('./access', () => ({ authorizeAssistant: mocks.authorize, AssistantError: class extends Error {} }));
import { readAssistantTool } from './tools';
import { analyticsNames } from './analytics';
import type { AnalyticsArguments } from './analyticsModel';
const args: AnalyticsArguments = { period: 'yesterday', dateFrom: null, dateTo: null, platform: 'combined', level: 'account', entityId: null, metric: 'spend', order: 'highest', dimension: 'publisher_platform', visual: false };
function setup(data: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'range']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  const db = { from: vi.fn(() => chain) };
  const scope = { businessId: 'business', userId: 'user', account: { id: 'account', currency_code: 'USD', timezone: 'UTC' }, db };
  mocks.authorize.mockResolvedValue(scope);
  return { scope, chain, db };
}
beforeEach(() => { vi.clearAllMocks(); });
it.each(analyticsNames)('%s rejects cross-account/tenant access before queries', async name => {
  const { scope, db } = setup(); mocks.authorize.mockResolvedValue({ ...scope, businessId: 'other' });
  await expect(readAssistantTool(name, args, scope as never)).rejects.toThrow('access changed');
  expect(db.from).not.toHaveBeenCalled(); expect(mocks.authorize).toHaveBeenCalledWith('account');
});
it('scopes daily reads to business/account and date range without querying Meta', async () => {
  const { scope, chain } = setup();
  const result = await readAssistantTool('getAccountPerformance', args, scope as never);
  expect(chain.eq).toHaveBeenCalledWith('business_id', 'business'); expect(chain.eq).toHaveBeenCalledWith('ad_account_id', 'account');
  expect(chain.gte).toHaveBeenCalledWith('day', expect.any(String));
  expect(result).toMatchObject({ coverage: { complete: false }, metrics: { spend: null } });
});
it.each(['facebook', 'instagram'])('does not substitute combined history for %s', async platform => {
  const { scope, db } = setup();
  const result = await readAssistantTool('getAccountPerformance', { ...args, platform }, scope as never);
  expect(result).toHaveProperty('unavailable'); expect(db.from).not.toHaveBeenCalled();
});
it('returns older snapshot values with actual coverage, never as selected-period data', async () => {
  const { scope } = setup([{ entity_level: 'adset', adset_id: 'one', entity_id: 'one', breakdown_type: 'publisher_platform', first_day: '2020-01-01', last_day: '2020-01-30', spend: 12345, currency_code: 'USD', dimension_1_key: 'publisher_platform', dimension_1_value: 'facebook', publisher_platform: 'facebook' }]);
  const result = await readAssistantTool('getPerformanceBreakdown', args, scope as never);
  expect(result).toMatchObject({ snapshotCoverage: {dateFrom:'2020-01-01',dateTo:'2020-01-30',matchesRequestedPeriod:false}, range:{dateFrom:'2020-01-01',dateTo:'2020-01-30'}, availableWindows: ['2020-01-01 / 2020-01-30'], breakdown:[{value:12345}], unavailable:null });
});
it('excludes rankings with incomplete coverage', async () => {
  const { scope } = setup([{ entity_id: 'one', entity_name: 'One', day: '2026-11-01', spend: 10, impressions: 100, clicks: 10, leads: 1, messages: 0, calls: 0, inline_link_clicks: 10, currency_code: 'USD' }]);
  const result = await readAssistantTool('getPerformanceRankings', { ...args, period: 'custom', dateFrom: '2026-11-01', dateTo: '2026-11-03', level: 'ad' }, scope as never);
  expect(result).toMatchObject({ rankings: [] });
});
it('memoizes only within a turn, reauthorizing even cached reads', async () => {
  const { scope, db } = setup(); const reads = new Map<string, Promise<unknown>>();
  await readAssistantTool('getAccountPerformance', args, scope as never, reads);
  await readAssistantTool('getAccountPerformance', args, scope as never, reads);
  expect(mocks.authorize).toHaveBeenCalledTimes(2); expect(db.from).toHaveBeenCalledTimes(1);
  mocks.authorize.mockResolvedValue({ ...scope, userId: 'other' });
  await expect(readAssistantTool('getAccountPerformance', args, scope as never, reads)).rejects.toThrow('access changed');
});

it('prefers exact coverage and otherwise selects one latest window before resolving entity level',async()=>{
 const row={entity_level:'adset',adset_id:'parent',entity_id:'parent',breakdown_type:'age_gender',currency_code:'USD',dimension_1_key:'age',dimension_1_value:'25-34',dimension_2_key:'gender',dimension_2_value:'female',spend:10};
 const {scope}=setup([{...row,first_day:'2026-10-01',last_day:'2026-10-07'}, {...row,entity_level:'ad',ad_id:'child',entity_id:'child',first_day:'2026-10-08',last_day:'2026-10-14',spend:20}, {...row,first_day:null,last_day:null,spend:999}]);
 const custom={...args,dimension:'age_gender',period:'custom',dateFrom:'2026-10-01',dateTo:'2026-10-07'};
 expect(await readAssistantTool('getPerformanceBreakdown',custom,scope as never)).toMatchObject({snapshotCoverage:{matchesRequestedPeriod:true},breakdown:[{value:10}]});
 expect(await readAssistantTool('getPerformanceBreakdown',{...custom,dateFrom:'2026-10-20',dateTo:'2026-10-26'},scope as never)).toMatchObject({snapshotCoverage:{dateFrom:'2026-10-08',dateTo:'2026-10-14',matchesRequestedPeriod:false},breakdown:[{value:20}]});
 expect(await readAssistantTool('getPerformanceBreakdown',{...custom,platform:'instagram'},scope as never)).toMatchObject({snapshotCoverage:null,breakdown:[]});
});
