import { it, expect } from 'vitest';
import { makeEvidence, resolveEvidence } from './evidence';
import { performanceAnswer, type AnalyticsArguments, type AnalyticsRow } from './analyticsModel';
import { shiftReportDay } from '@/lib/shared/reports/dates';
import type { AssistantReply } from '@/lib/shared/assistant/contracts';
const args: AnalyticsArguments = { period: 'today', dateFrom: null, dateTo: null, platform: 'combined', level: 'account', entityId: null, metric: 'conversion', order: 'highest', dimension: 'publisher_platform', visual: true };
const reply: AssistantReply = { message: 'Here is what I found.', plan: null, creativeIds: [], questions: [], visuals: [], insights: [], metadata: [], suggestedFollowUps: [] };
function scenario(today: number, week: number, previous: number, at = '2026-11-05T21:00:00Z') {
  const rows: AnalyticsRow[] = Array.from({ length: 14 }, (_, i) => ({ entity_id: 'adset', day: shiftReportDay('2026-11-05', -i), updated_at: at, currency_code: 'USD', spend: 20, impressions: 1000, clicks: 20, inline_link_clicks: 10, leads: 0, calls: 0, messages: i === 0 ? today : i < 7 ? week : previous }));
  const daily = performanceAnswer(rows.filter(r => r.day! >= '2026-10-29'), args, 'UTC', 'USD', new Date(at));
  const weekly = performanceAnswer(rows, { ...args, period: '7d' }, 'UTC', 'USD', new Date(at));
  return { rows, daily, weekly, sources: [makeEvidence('day', daily, 'today'), makeEvidence('week', weekly, '7d')] };
}
it.each([[5, 20, 10, 'unfavorable', 'favorable'], [20, 5, 10, 'favorable', 'unfavorable'], [30, 20, 10, 'favorable', 'favorable']] as const)('keeps mixed day/week evidence separate: %s / %s / %s', (today, week, previous, dayTone, weekTone) => {
  const data = scenario(today, week, previous);
  expect(data.sources[0].observations.find(o => o.id === 'day:conversion')?.tone).toBe(dayTone);
  expect(data.sources[1].observations.find(o => o.id === 'week:conversion')?.tone).toBe(weekTone);
  expect(data.weekly.changes.conversion?.value).toBeCloseTo(((today + 6 * week) / (7 * previous) - 1) * 100);
  const resolved = resolveEvidence({ ...reply, insights: ['day:conversion', 'week:conversion'], visuals: [{ sourceId: 'day', kind: 'comparison', metrics: ['conversion'] }] }, data.sources);
  expect(resolved.visuals[0].items).toHaveLength(1);
  expect(resolved.visuals[0].items[0].value).toBe(String(today));
  expect(resolved.metadata).toHaveLength(2);
});
it('before cutoff presents a baseline without a performance verdict; after cutoff allows preliminary changes', () => {
  const early = scenario(5, 20, 10, '2026-11-05T19:59:00Z');
  expect(early.sources[0].observations.some(o => o.id === 'day:conversion')).toBe(false);
  expect(early.sources[0].block.items[1].baseline).not.toBe('Unavailable');
  expect(scenario(5, 20, 10, '2026-11-05T20:00:00Z').sources[0].observations.some(o => o.id === 'day:conversion')).toBe(true);
});
it('missing baseline produces uncertainty, never an invented positive or negative finding', () => {
  const data = scenario(5, 20, 10);
  const limited = performanceAnswer(data.rows.slice(0, 2), args, 'UTC', 'USD', new Date('2026-11-05T21:00:00Z'));
  const evidence = makeEvidence('limited', limited, 'today');
  expect(evidence.observations.every(o => o.tone === 'neutral')).toBe(true);
  expect(evidence.observations.some(o => o.text.includes('not enough'))).toBe(true);
});
it('rejects invented evidence IDs and does not cross platform scopes', () => {
  const fb = makeEvidence('facebook', { unavailable: 'No saved daily platform history', platform: 'facebook' }, '7d');
  const ig = makeEvidence('instagram', { unavailable: 'Different snapshot period', platform: 'instagram' }, '7d');
  expect(fb.facts.platform).toBe('facebook'); expect(ig.facts.platform).toBe('instagram');
  expect(() => resolveEvidence({ ...reply, insights: ['instagram:conversion'] }, [fb, ig])).toThrow();
  expect(() => resolveEvidence({ ...reply, visuals: [{ sourceId: 'other', kind: 'kpis', metrics: ['spend'] }] }, [fb])).toThrow();
});
it('creative cards require real tool-returned creative evidence', () => {
  const source = makeEvidence('rank', { rankings: [{ id: 'a', name: 'Actual ad', value: 12, creativeId: 'creative' }], metric: 'conversion' }, '30d');
  expect(source.creativeIds).toEqual(['creative']);
  expect(resolveEvidence({ ...reply, visuals: [{ sourceId: 'rank', kind: 'creative', metrics: [] }] }, [source]).visuals).toHaveLength(1);
  expect(() => resolveEvidence({ ...reply, visuals: [{ sourceId: 'day', kind: 'creative', metrics: [] }] }, scenario(5, 20, 10).sources)).toThrow();
});
it('keeps compact performance numeric evidence in components and preserves real daily results', () => {
 const data=scenario(5,20,10);
 const result=resolveEvidence({...reply,message:'Long narrative '.repeat(100),visuals:[{sourceId:'week',kind:'kpis',metrics:['spend']},{sourceId:'week',kind:'trend',metrics:['spend']}],insights:['week:conversion']},data.sources,true);
 expect(result.summary!.split(/\s+/).length).toBeLessThan(45);
 expect(result.insights.some(i=>i.text===result.summary)).toBe(false);
 expect(result.visuals[0].items.map(i=>i.key)).toEqual(['spend','conversion','costPerResult']);
 expect(result.visuals[1].trend.map(p=>p.results)).toEqual(data.weekly.daily.map(p=>p.conversion));
 const missing=makeEvidence('missing',{daily:[{day:'2026-11-01',spend:10}],metrics:{conversion:100}},'7d');
 expect(missing.block.trend[0].results).toBeNull();
});
it('renders fallback audience segments with actual dates and a visible requested-period limitation',()=>{
 const source=makeEvidence('audience',{range:{dateFrom:'2026-10-01',dateTo:'2026-10-14'},requestedRange:{dateFrom:'2026-10-20',dateTo:'2026-10-26'},snapshotCoverage:{dateFrom:'2026-10-01',dateTo:'2026-10-14',matchesRequestedPeriod:false},coverageNotice:'Latest snapshot covers October 1–14, not the requested week.',metric:'spend',currency:'USD',breakdown:[{key:'female',label:'25–34 · female',value:100}]},'7d');
 const result=resolveEvidence({...reply,visuals:[{sourceId:'audience',kind:'kpis',metrics:['spend']}]},[source],true);
 expect(result.visuals[0]).toMatchObject({kind:'ranking',title:'Audience snapshot · 2026-10-01–2026-10-14',status:'Latest snapshot covers October 1–14, not the requested week.',items:[{label:'25–34 · female',value:'$100.00'}]});
 expect(result.insights).toEqual([]);
});
