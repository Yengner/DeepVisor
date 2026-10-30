import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { fixture, identity, now } from '../shadow/fixture';
import { reviewVersion } from './evaluate';
vi.mock('server-only',()=>({}));
import { runReviewJob } from './service';
import { runShadowJob } from '../shadow/service';

afterEach(()=>vi.restoreAllMocks());
describe('Review failure persistence',()=>{
 it('records provider failure without an actionable proposal or fallback',async()=>{
  vi.spyOn(console,'info').mockImplementation(()=>{});
  const job=fixture();job.source_json.policy.mode='approval_required';job.evaluation_version=reviewVersion(identity);
  const calls:Array<{path:string;body:Record<string,unknown>}>=[];
  const transport:typeof fetch=async(url,init)=>{
   const path=new URL(String(url)).pathname;const body=JSON.parse(String(init?.body??'{}'));calls.push({path,body});
   const data=path.endsWith('autonomy_policies')?{...job.source_json.policy,created_at:now.toISOString(),updated_at:now.toISOString()}:path.includes('/rpc/')?null:body;
   return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  };
  const client=createClient<Database>('https://unit-test.supabase.co','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});
  const evaluate=vi.fn(async()=>{throw new Error('private provider failure');});
  const readState=vi.fn();
  await runReviewJob(client,job,{identity,evaluate},{now:()=>now,readState,simulation:true});
  expect(evaluate).toHaveBeenCalledTimes(1);expect(readState).not.toHaveBeenCalled();
  expect(calls.find(c=>c.path.endsWith('finish_meta_review'))?.body).toMatchObject({p_proposal:null,p_result:null,p_error:expect.any(String)});
  expect(calls.some(c=>c.path.endsWith('action_proposals'))).toBe(false);
  expect(JSON.stringify(calls)).not.toContain('private provider failure');
 });
});

it.each(['Shadow', 'Review'])('%s fails closed before calling the provider when business context cannot be read', async mode => {
 vi.spyOn(console, 'info').mockImplementation(() => {});
 const job = fixture();
 if (mode === 'Review') { job.source_json.policy.mode = 'approval_required'; job.evaluation_version = reviewVersion(identity); }
 const calls: Array<{path: string; body: Record<string, unknown>}> = [];
 const client = createClient<Database>('https://unit-test.supabase.co', 'test', { auth: {persistSession:false}, global: {fetch: async (url, init) => {
  const path = new URL(String(url)).pathname;
  const body = JSON.parse(String(init?.body ?? '{}')); calls.push({path,body});
  if (path.endsWith('business_profiles')) return new Response(JSON.stringify({message:'denied'}), {status:403});
  return new Response(JSON.stringify(path.endsWith('autonomy_policies') ? {...job.source_json.policy,created_at:now.toISOString(),updated_at:now.toISOString()} : null), {headers:{'Content-Type':'application/json'}});
 }}});
 const evaluate = vi.fn();
 if (mode === 'Review') await runReviewJob(client, job, {identity,evaluate}, {now:()=>now});
 else await runShadowJob(client, job, {identity,evaluate}, ()=>now);
 expect(evaluate).not.toHaveBeenCalled();
 expect(calls.find(c=>c.path.endsWith(`finish_meta_${mode.toLowerCase()}`))?.body).toMatchObject({p_result:null,p_proposal:null,p_error:expect.any(String)});
 expect(calls.some(c=>c.path.endsWith('feature_snapshots'))).toBe(false);
});
