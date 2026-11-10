export type Observation = { id: string; level: string; parent: string | null; campaign: string | null; name: string; configured: string; effective: string; end: string | null; start: string | null; dailyBudget: number | null; lifetimeBudget: number | null; targeting: unknown };
export type Change = { kind: 'activated'|'resumed'|'paused'|'parent_paused'|'scheduled_end'|'unavailable'|'archived'; root: string; affected: string[]; explanation: string };
const active = (r: Observation, at: string) => r.effective === 'ACTIVE' && (!r.end || Date.parse(r.end) > Date.parse(at));
export function changes(before: Observation[], after: Observation[], previousAt: string, at: string): Change[] {
 const old=new Map(before.map(r=>[r.id,r])), now=new Map(after.map(r=>[r.id,r]));
 const grouped=new Map<string,Change>();
 for(const r of after.filter(r=>r.level==='ad')) {
  const p=old.get(r.id); if(!p)continue; // First observation is a baseline, not a claimed activation.
  const ended=Boolean(r.end && Date.parse(r.end)<=Date.parse(at) && Date.parse(r.end)>Date.parse(previousAt) && p.end===r.end);
  if(p.effective===r.effective && !ended)continue;
  let kind:Change['kind'],root=r.id,explanation:string;
  if(ended && active(p,previousAt)){kind='scheduled_end';explanation='The saved scheduled end has been reached. This alone does not confirm the exact time delivery stopped.';}
  else if(active(r,at)){
   kind=p.effective==='PENDING_REVIEW'||p.effective==='PREAPPROVED'?'activated':'resumed';
   const parent=[now.get(r.campaign??''),now.get(r.parent??'')].find(candidate=>candidate&&old.has(candidate.id)&&active(candidate,at)&&!active(old.get(candidate.id)!,previousAt));
   if(parent)root=parent.id;
   explanation='Meta now reports this advertising as active. Delivery and results are not guaranteed.';
  }
  else if(active(p,previousAt)) {
   const parent=r.effective==='CAMPAIGN_PAUSED'?now.get(r.campaign??''):r.effective==='ADSET_PAUSED'?now.get(r.parent??''):null;
   if(parent && parent.configured==='PAUSED'){kind='parent_paused';root=parent.id;explanation=`Delivery is interrupted because ${parent.name} is paused.`;}
   else if(r.configured==='PAUSED'){kind='paused';explanation='Meta now reports this ad as paused.';}
   else if(['ARCHIVED','DELETED'].includes(r.effective)){kind='archived';explanation='Meta reports this advertising as archived or deleted.';}
   else {kind='unavailable';explanation='Delivery eligibility changed. The available evidence does not establish a more specific cause.';}
  } else continue;
  const key=`${kind}:${root}`,event=grouped.get(key)??{kind,root,affected:[],explanation};event.affected.push(r.id);grouped.set(key,event);
 }
 // Record independently changed parent entities even when there are no affected ads.
 // Inherited child statuses remain grouped under the highest changed parent.
 for(const r of after.filter(r=>r.level==='campaign'||r.level==='adset')){
  const p=old.get(r.id);if(!p)continue;
  const crossing=Boolean(r.end&&p.end===r.end&&Date.parse(r.end)>Date.parse(previousAt)&&Date.parse(r.end)<=Date.parse(at));
  if(p.configured===r.configured&&p.effective===r.effective&&!crossing)continue;
  if([...grouped.values()].some(e=>e.root===r.id))continue;
  if(r.level==='adset'&&r.campaign&&[...grouped.values()].some(e=>e.root===r.campaign))continue;
  let kind:Change['kind']|null=null;
  if(crossing&&active(p,previousAt))kind='scheduled_end';
  else if(active(r,at)&&!active(p,previousAt))kind=['PENDING_REVIEW','PREAPPROVED'].includes(p.effective)?'activated':'resumed';
  else if(active(p,previousAt)&&r.configured==='PAUSED')kind='paused';
  else if(active(p,previousAt)&&['ARCHIVED','DELETED'].includes(r.effective))kind='archived';
  if(!kind)continue;
  const explanation=kind==='scheduled_end'?'The saved scheduled end has been reached. This alone does not confirm when delivery stopped.':kind==='paused'?`Meta now reports ${r.name} as paused.`:kind==='archived'?`Meta reports ${r.name} as archived or deleted.`:`Meta now reports ${r.name} as active. Delivery and results are not guaranteed.`;
  grouped.set(`${kind}:${r.id}`,{kind,root:r.id,affected:[],explanation});
 }
 return [...grouped.values()];
}
export function forecast(rows: Array<{day:string;spend:number|null;results:number|null}>,planned:number|null) {
 if(rows.some(r=>r.spend===null||r.results===null||r.spend<0||r.results<0))return null;
 const valid=rows;
 const results=valid.reduce((s,r)=>s+r.results!,0),spend=valid.reduce((s,r)=>s+r.spend!,0);
 if(planned===null||new Set(valid.map(r=>r.day)).size<7||results<20)return null;
 if(spend<=0)return null;
 const costs=valid.filter(r=>r.results!>0&&r.spend!>0).map(r=>r.spend!/r.results!).sort((a,b)=>a-b);
 if(!costs.length)return null;
 return {results:planned/(spend/results),low:planned/costs[Math.floor((costs.length-1)*.75)],high:planned/costs[Math.floor((costs.length-1)*.25)],basis:'Historical efficiency scenario, not a guarantee or confidence interval'};
}
