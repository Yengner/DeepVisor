import type { SavedPresentation } from './model';
export function exportRows(saved:SavedPresentation):Array<Array<string|number|null>>{
 const p=saved.payload,r=p.recap;
 const rows:Array<Array<string|number|null>>=[['record_type','name','value','context'],['snapshot','id',saved.id,saved.created_at],['scope','account',p.account,p.timezone],['scope','currency',p.currency,null],['source','last_successful_sync',p.syncedAt,null]];
 if(r){rows.push(['recap','spend',r.spend,`${r.since} through ${r.until}`],['recap','reported_results',r.results,'Leads + messaging conversations + calls'],['recap','cost_per_result',r.cpr,p.currency],['coverage','observed_days',r.observedDays,`${r.expectedDays} calendar days; absent rows are not zero`]);for(const d of r.days)rows.push(['daily_spend',d.day,d.spend,p.currency],['daily_results',d.day,d.results,'Reported results']);}
 for(const i of p.issues)rows.push(['attention',i.title,i.explanation,`${i.code}; observed ${i.observedAt}; ${i.stale?'stale observation':'saved observation'}`]);
 if(r?.hourly){rows.push(['coverage','observed_hour_slots',r.hourly.observedHours,`${r.hourly.status}; advertiser-local clock hours; missing is not zero`]);for(const h of r.hourly.hours)rows.push(['hourly_spend',`${r.since} ${String(h.hour).padStart(2,'0')}:00`,h.spend,p.currency],['hourly_results',`${r.since} ${String(h.hour).padStart(2,'0')}:00`,h.results,p.timezone]);}
 for(const c of p.lifecycle){const b=c.brief;rows.push(['lifecycle',b.title,b.explanation,`${b.provenance}; observed ${b.observedAt}`],['lifecycle_spend',b.title,b.spend,`${b.since} through ${b.until}; affected ads only`],['lifecycle_results',b.title,b.results,`${b.since} through ${b.until}; affected ads only`]);for(const x of b.breakdowns??[])for(const row of x.rows)rows.push(['snapshot_breakdown',`${x.kind}: ${row.label}`,row.impressions,`${x.scope}; ${x.since??'unknown'} through ${x.until??'unknown'}`]);for(const text of b.limitations)rows.push(['limitation',b.title,text,null]);}
 for(const text of p.limitations)rows.push(['limitation','coverage',text,null]);
 return rows;
}
export function exportCsv(saved:SavedPresentation){return exportRows(saved).map(row=>row.map(v=>{const text=v===null?'':String(v);return `"${(/^[=+@\-\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')}"`;}).join(',')).join('\r\n');}
