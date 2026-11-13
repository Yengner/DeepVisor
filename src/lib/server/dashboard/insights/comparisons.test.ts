import { expect, it } from 'vitest';
import { comparisons } from './comparisons';
import { normalize } from './model';
import { shiftDay } from '../overview/model';
const now='2026-11-04T12:00:00Z';
const rows=normalize(Array.from({length:60},(_,i)=>({date_start:shiftDay('2026-11-04',-i),adset_id:'one',publisher_platform:'facebook',spend:i<7?'20':'10',impressions:'100',clicks:i<7?'10':'5',actions:[{action_type:'lead',value:i<7?'4':'1'}]})),'USD');
const run=(period:'today'|'7d'|'30d'='7d', data=rows, platform:'facebook'|'instagram'|'combined'='facebook',at=now)=>comparisons(data,platform,period,'2026-11-04','USD',at,now);
it('compares selected seven days with the preceding non-overlapping window',()=>{
 const result=run();expect(result.comparison).toContain('2026-10-29–2026-11-04 vs 2026-10-22–2026-10-28');
 expect(result.deltas.spend).toMatchObject({value:100,tone:'neutral'});
 expect(result.deltas.results).toMatchObject({value:300,tone:'positive'});
 expect(result.deltas.costPerResult).toMatchObject({value:-50,tone:'positive'});
 expect(result.deltas.ctr).toMatchObject({value:5,unit:'pp',tone:'positive'});
});
it('uses thirty non-overlapping account calendar days per window',()=>{expect(run('30d').comparison).toContain('2026-10-06–2026-11-04 vs 2026-09-06–2026-10-05');});
it('omits Today when account timezone is unverified',()=>{expect(run('today').deltas).toEqual({});});
it('isolates publishers and rejects gaps, duplicates and stale data',()=>{
 expect(run('7d',rows,'instagram').deltas).toEqual({});expect(run('7d',rows.slice(1)).deltas).toEqual({});
 expect(run('7d',[...rows,rows[0]]).deltas).toEqual({});expect(run('7d',rows,'facebook','2026-11-03T00:00:00Z').deltas).toEqual({});
});
it('keeps unavailable conversions and zero denominators unknown',()=>{
 const unknown=rows.map(r=>({...r,leads:null}));expect(run('7d',unknown).deltas.results).toBeUndefined();expect(run('7d',unknown).deltas.spend).toBeDefined();
 const zero=rows.map(r=>({...r,leads:0}));expect(run('7d',zero).deltas.results).toBeUndefined();expect(run('7d',zero).deltas.costPerResult).toBeUndefined();
});
it('marks worsening outcomes red, unchanged metrics neutral and mismatched currency unavailable',()=>{
 const worse=rows.map((r,i)=>({...r,leads:i<7?1:4,clicks:i<7?1:10}));
 expect(run('7d',worse).deltas.results?.tone).toBe('negative');expect(run('7d',worse).deltas.costPerResult?.tone).toBe('negative');expect(run('7d',worse).deltas.ctr?.tone).toBe('negative');
 expect(run('7d',rows.map(r=>({...r,spend:10}))).deltas.spend).toMatchObject({value:0,tone:'neutral'});
 expect(run('7d',rows.map(r=>({...r,currency_code:'EUR'}))).deltas).toEqual({});
});

const evening = (at: string, data = rows, today = '2026-11-04', timezone = 'America/New_York', cutoff?: string) => comparisons(data, 'facebook', 'today', today, 'USD', at, at, { timezone, cutoff });
it.each([
 ['2026-11-05T00:59:00Z', false], // 7:59 PM EST
 ['2026-11-05T01:00:00Z', true], // 8 PM EST
 ['2026-11-05T04:59:00Z', true], // 11:59 PM EST
 ['2026-11-05T05:00:00Z', false], // next account-local midnight
])('evaluates the account-local cutoff and resets at midnight: %s', (at, eligible) => {
 expect(Boolean(evening(at).deltas.spend)).toBe(eligible);
});
it('uses daily averages for additive metrics and aggregate ratios for efficiency',()=>{
 const data = rows.map((r,i)=>({...r,spend:i===0?20:10,leads:i===0?4:1,clicks:i===0?10:5}));
 const result=evening('2026-11-05T01:00:00Z',data);
 expect(result.deltas.spend).toMatchObject({value:100,tone:'neutral'});
 expect(result.deltas.results).toMatchObject({value:300,tone:'positive'});
 expect(result.deltas.costPerResult).toMatchObject({value:-50,tone:'positive'});
 expect(result.deltas.ctr).toMatchObject({value:5,unit:'pp'});
 expect(result.comparison).toContain('Live today');expect(result.comparison).toContain('2026-10-28–2026-11-03');
});
it('requires seven baseline dates and current-day observations',()=>{
 expect(evening('2026-11-05T01:00:00Z',rows.filter((_,i)=>i!==3)).deltas).toEqual({});
 expect(evening('2026-11-05T01:00:00Z',rows.slice(1)).deltas).toEqual({});
 expect(evening('2026-11-05T05:00:00Z',rows,'2026-11-05').deltas).toEqual({});
});
it('supports configured cutoffs, timezone offsets, DST and rejects invalid settings',()=>{
 expect(evening('2026-11-05T00:59:00Z',rows,'2026-11-04','America/New_York','19:00').deltas.spend).toBeDefined();
 expect(evening('2026-11-04T20:00:00Z',rows,'2026-11-04','UTC').deltas.spend).toBeDefined();
 expect(evening('2026-11-05T01:00:00Z',rows,'2026-11-04','America/Los_Angeles').deltas).toEqual({});
 expect(evening('2026-11-05T01:00:00Z',rows,'2026-11-04','Invalid/Zone').deltas).toEqual({});
 expect(evening('2026-11-05T01:00:00Z',rows,'2026-11-04','UTC','25:00').deltas).toEqual({});
 const summerRows=rows.map(r=>({...r,day:shiftDay(r.day,-90)}));
 expect(evening('2026-08-07T00:00:00Z',summerRows,'2026-08-06').deltas.spend).toBeDefined();
});
it('rejects stale retrievals after the cutoff',()=>{
 expect(comparisons(rows,'facebook','today','2026-11-04','USD','2026-11-05T00:00:00Z','2026-11-05T01:00:00Z',{timezone:'America/New_York'}).deltas).toEqual({});
});
