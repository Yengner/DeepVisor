import { z } from 'zod';
export const levels = ['campaign','adset','ad'] as const;
export type Level = typeof levels[number];
export type Node = { id:string; externalId:string; parentId:string|null; parentExternalId?:string|null; level:Level; name:string; creativeId:string|null; createdAt:string|null; objective:string|null; optimization:string|null; status:string|null; image:string|null; spend:number|null; firstDelivery:string|null; lastDelivery:string|null };
export type Snapshot = { accountId:string; accountName:string; capturedAt:string; syncedAt?:string|null; currency:string|null; zone:string; nodes:Node[] };
export const tokens = ['Objective','Initiative','Market','StartDate','Audience','Geography','Optimization','Concept','Variation','Version','LaunchDate'] as const;
const fields = z.record(z.enum(tokens), z.string().trim().max(255)).superRefine((values,ctx)=>{
 for(const key of ['StartDate','LaunchDate'] as const){const value=values[key];if(value && (!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))ctx.addIssue({code:'custom',message:'Use a valid YYYY-MM-DD date',path:[key]});}
});
export const configSchema = z.object({ campaign:z.string().max(300),adset:z.string().max(300),ad:z.string().max(300),separator:z.string().min(1).max(8),dateFormat:z.enum(['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY']) });
export const editSchema = z.object({ id:z.string().uuid(),name:z.string().min(1).max(255).refine(v=>v.trim().length>0,'Name cannot be blank'),family:z.string().trim().max(120),selected:z.boolean(),fields });
export const draftSchema = z.object({ config:configSchema,edits:z.array(editSchema).max(5000) });
export type Draft = z.infer<typeof draftSchema>;
export const defaults:Draft['config'] = {campaign:'{Objective} | {Initiative} | {Market} | {StartDate}',adset:'{Audience} | {Geography} | {Optimization} | {StartDate}',ad:'{Concept} | {Variation} | {Version} | {LaunchDate}',separator:' | ',dateFormat:'YYYY-MM-DD'};
export function renderName(template:string, values:Record<string,string>, config:Draft['config']) {
  const unknown = [...template.matchAll(/\{([^}]+)\}/g)].some(m => !tokens.includes(m[1] as typeof tokens[number]));
  if (unknown) throw new Error('Unknown naming token');
  const name = template.split('|').map(part => part.replace(/\{([^}]+)\}/g, (_,key:string) => {
    const value=values[key] ?? '';
    if ((key==='StartDate'||key==='LaunchDate') && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y,m,d]=value.split('-');
      if(config.dateFormat==='DD/MM/YYYY') return `${d}/${m}/${y}`;
      if(config.dateFormat==='MM/DD/YYYY') return `${m}/${d}/${y}`;
    }
    return value;
  }).trim()).filter(Boolean).join(config.separator);
  if(name.length>255) throw new Error('Generated name exceeds 255 characters');
  return name;
}
function suggestName(n:Node,values:Record<string,string>){try{return (n.level==='campaign'?renderName(defaults.campaign,values,defaults):n.name)||n.externalId;}catch{return n.name||n.externalId;}}
export function propose(snapshot:Snapshot):Draft {
  return {config:{...defaults},edits:snapshot.nodes.map(n => {
    const values:Record<string,string>={};
    if(n.name && n.level==='campaign') values.Initiative=n.name;
    if(n.objective) values.Objective=n.objective;
    if(n.optimization) values.Optimization=n.optimization;
    // Creation and observed delivery are deliberately never substituted for launch dates.
    return {id:n.id,name:suggestName(n,values),family:'',selected:false,fields:values};
  })};
}
export function validateDraft(snapshot:Snapshot, value:unknown):Draft {
  const draft=draftSchema.parse(value);
  const ids=new Set(snapshot.nodes.map(n=>n.id));
  if(draft.edits.length!==ids.size || new Set(draft.edits.map(e=>e.id)).size!==ids.size || draft.edits.some(e=>!ids.has(e.id))) throw new Error('Proposal entities do not match this snapshot');
  for(const level of levels) renderName(draft.config[level],{},draft.config);
  return draft;
}
export function parentMap(nodes:Node[]) {
  const byId=new Map(nodes.map(n=>[n.id,n]));
  return new Map(nodes.map(n=>[n.id, n.parentId && byId.get(n.parentId)?.level===(n.level==='ad'?'adset':n.level==='adset'?'campaign':'') ? n.parentId : null]));
}

/** Detect changes to rename evidence, never compare performance or expiring media URLs. */
export function organizationSignature(snapshot:Snapshot):string {
 return JSON.stringify(snapshot.nodes.map(n=>[n.id,n.externalId,n.level,n.parentId,n.name,n.creativeId,n.createdAt]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
export function snapshotStale(snapshot:Snapshot,now=Date.now()) {
 const time=Date.parse(snapshot.syncedAt??'');return !Number.isFinite(time)||now-time>24*3600000;
}
