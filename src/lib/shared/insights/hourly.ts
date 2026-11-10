import {nullableSum} from './model';
import type {HourlyRecap,Recap} from './model';
export type HourlyRow={day:string|null;hour_of_day:number|null;spend:number|null;leads:number|null;messages:number|null;calls:number|null;currency_code:string|null};
/** Advertiser-local slots from ad-set observations only; absent slots are never zeros. */
export function summarizeHours(rows:HourlyRow[],day:string,currency:string|null):HourlyRecap{
 const groups=new Map<number,HourlyRow[]>();
 for(const row of rows){const hour=row.hour_of_day;if(row.day!==day||hour===null||!Number.isInteger(hour)||hour<0||hour>23)continue;const group=groups.get(hour)??[];group.push(row);groups.set(hour,group);}
 return {status:groups.size?'available':'unavailable',observedHours:groups.size,hours:Array.from({length:24},(_,hour)=>{
  const group=groups.get(hour)??[],valid=Boolean(currency)&&group.every(r=>r.currency_code===currency);
  return {hour,spend:valid?nullableSum(group.map(r=>r.spend)):null,results:valid?nullableSum(group.map(r=>nullableSum([r.leads,r.messages,r.calls]))):null};
 })};
}
export function recapChart(recap:Recap){
 const hourly=recap.since===recap.until;
 return {hourly,points:hourly?(recap.hourly?.hours??summarizeHours([],recap.since,null).hours).map(h=>({...h,label:`${String(h.hour).padStart(2,'0')}:00`})):
 recap.days.map(d=>({...d,label:d.day})),observed:hourly?recap.hourly?.observedHours??0:recap.observedDays,expected:hourly?24:recap.expectedDays};
}
