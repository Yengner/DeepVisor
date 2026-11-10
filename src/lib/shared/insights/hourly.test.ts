import {expect,it} from 'vitest';
import {recapChart,summarizeHours} from './hourly';
import {previewPresentation} from './preview';
import {exportCsv} from './export';
const row={day:'2026-11-07',hour_of_day:9,spend:10,leads:0,messages:2,calls:0,currency_code:'USD'};
it('aggregates observed hourly metrics while preserving zero, missing and null',()=>{
 const r=summarizeHours([row,{...row,spend:5,messages:1},{...row,hour_of_day:10,spend:0,messages:0},{...row,hour_of_day:11,spend:null},{...row,day:'2026-11-06',spend:999}],row.day,'USD');
 expect(r.hours).toHaveLength(24);expect(r.observedHours).toBe(3);
 expect(r.hours[9]).toEqual({hour:9,spend:15,results:3});expect(r.hours[10].spend).toBe(0);expect(r.hours[11].spend).toBeNull();expect(r.hours[8].results).toBeNull();
 expect(summarizeHours([row],row.day,'EUR').hours[9].spend).toBeNull();
});
it('uses 24 local hour positions for daily recaps and seven dates for weekly',()=>{
 const daily=previewPresentation('daily'),weekly=previewPresentation('catch-up');
 expect(recapChart(daily.payload.recap!).points).toHaveLength(24);expect(recapChart(daily.payload.recap!).hourly).toBe(true);
 expect(recapChart(weekly.payload.recap!).points).toHaveLength(7);expect(recapChart(weekly.payload.recap!).hourly).toBe(false);
 expect(daily.payload.recap!.hourly!.hours.reduce((s,h)=>s+h.spend!,0)).toBe(daily.payload.recap!.spend);
 expect(exportCsv(daily)).toContain('"hourly_spend","2026-11-07 09:00","3","USD"');
});
it('never substitutes one daily bar or divides totals when hourly data is absent',()=>{
 const r=previewPresentation('daily-missing').payload.recap!;expect(recapChart(r).observed).toBe(0);expect(recapChart(r).points.every(p=>p.spend===null)).toBe(true);
 delete r.hourly;expect(recapChart(r).points.every(p=>p.results===null)).toBe(true);expect(r.spend).toBe(30);
});
