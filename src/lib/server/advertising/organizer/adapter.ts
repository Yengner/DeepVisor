import 'server-only';
import {z} from 'zod';
import {executionEnabled} from '../ReviewExecutor';
import {sameState,stateSchema,type RenameChange,type RenameState} from '@/lib/shared/organizer/renamePlan';
import type {RenameAdapter} from './execute';
export function renameEnabled(business:string){return executionEnabled(business)&&process.env.DEEPVISOR_ORGANIZER_RENAMES_ENABLED==='true'&&process.env.DEEPVISOR_ORGANIZER_EXCLUSIVE_WRITER==='true'&&(process.env.DEEPVISOR_ORGANIZER_BUSINESSES??'').split(',').includes(business);}
/** Strict name-only transport: no generic mutation method, redirects or write retries. */
export class MetaRenameAdapter implements RenameAdapter{
 constructor(private config:{businessId:string;accountId:string;token:string;writeDeadline?:number},private transport:typeof fetch=fetch){if(!/^(act_)?\d+$/.test(config.accountId)||!config.token)throw new Error('INVALID_META_CONFIGURATION');}
 private async request(path:string,params:Record<string,string>,post=false){
  const url=new URL(`https://graph.facebook.com/v24.0/${path}`);if(!post)url.search=new URLSearchParams(params).toString();
  try{const r=await this.transport(url,{method:post?'POST':'GET',headers:{Authorization:`Bearer ${this.config.token}`,...(post?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:post?new URLSearchParams(params).toString():undefined,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});const body=await r.json();if(!r.ok||body?.error)throw new Error('META_RENAME_REQUEST_FAILED');return body;}catch{throw new Error('META_RENAME_REQUEST_FAILED');}
 }
 async assertWritable(){
  if(!renameEnabled(this.config.businessId))throw new Error('RENAMING_DISABLED');
  const permissions=z.object({data:z.array(z.object({permission:z.string(),status:z.string()}))}).parse(await this.request('me/permissions',{}));
  if(!permissions.data.some(p=>p.permission==='ads_management'&&p.status==='granted'))throw new Error('META_WRITE_PERMISSION_MISSING');
 }
 async read(c:RenameChange):Promise<RenameState>{
  if(!/^\d+$/.test(c.before.id))throw new Error('INVALID_META_ENTITY');
  const parent=c.before.level==='ad'?'adset_id':c.before.level==='adset'?'campaign_id':null;
  const row=z.object({id:z.string(),account_id:z.string(),name:z.string(),updated_time:z.string(),campaign_id:z.string().optional(),adset_id:z.string().optional(),objective:z.string().optional(),optimization_goal:z.string().optional(),creative:z.object({id:z.string()}).optional()}).parse(await this.request(c.before.id,{fields:`id,account_id,name,updated_time${parent?','+parent:''},${c.before.level==='campaign'?'objective':c.before.level==='adset'?'optimization_goal':'creative{id}'}`}));
  if(row.id!==c.before.id||row.account_id!==this.config.accountId.replace(/^act_/,''))throw new Error('META_SCOPE_MISMATCH');
  if(c.before.level==='campaign'&&!row.objective||c.before.level==='adset'&&!row.optimization_goal||c.before.level==='ad'&&!row.creative)throw new Error('META_ENTITY_TYPE_MISMATCH');
  if(parent&&!row[parent])throw new Error('MISSING_META_PARENT');
  return stateSchema.parse({id:row.id,accountId:row.account_id,level:c.before.level,parentId:parent?row[parent]:null,name:row.name,updatedAt:row.updated_time,creativeId:row.creative?.id??null});
 }
 async rename(c:RenameChange){
  await this.assertWritable();
  const name=z.string().min(1).max(255).refine(v=>v.trim().length>0).parse(c.afterName);
  if(!/^\d+$/.test(c.before.id)||c.before.accountId!==this.config.accountId.replace(/^act_/,''))throw new Error('META_SCOPE_MISMATCH');
  if(!sameState(await this.read(c),c.before))throw new Error('STALE_META_STATE');
  if(!renameEnabled(this.config.businessId))throw new Error('RENAMING_DISABLED');
  if(this.config.writeDeadline!==undefined&&Date.now()>=this.config.writeDeadline)throw new Error('EXECUTION_DEADLINE_ELAPSED');
  const result=await this.request(c.before.id,{name},true);if(result?.success!==true)throw new Error('UNCONFIRMED_META_RENAME');
 }
}
