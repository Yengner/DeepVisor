import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { metaStateSchema } from './advertising/types';
vi.mock('server-only',()=>({}));
import { MetaActionAdapter } from './advertising/MetaActionAdapter';
import { simulationAccounts, simulationToken, simulatedMetaResponse } from './integrations/simulation/meta';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
describe('beta release safety',()=>{
 it.each(['processAccountSyncJobs','queueAccountSyncJobs'])('%s rejects absent/mismatched secrets, including the old bypass',async name=>{
  const env:Record<string,string>={SKIP_CRON_SECRET:'true',APP_BASE_URL:'https://test.invalid',INTERNAL_API_KEY:'internal'};
  vi.stubGlobal('Deno',{env:{get:(key:string)=>env[key]}});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.spyOn(console,'warn').mockImplementation(()=>{});
  const worker=await import(`../../../supabase/functions/_shared/${name}.ts`);
  const handler=worker[name==='processAccountSyncJobs'?'handleProcessAccountSyncJobsRequest':'handleQueueAccountSyncJobsRequest'];
  expect((await handler(new Request('https://test.invalid'))).status).toBe(403);
  env.CRON_SECRET='expected';expect((await handler(new Request('https://test.invalid',{headers:{'x-cron-secret':'wrong'}}))).status).toBe(403);expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue(new Response('{}',{status:200}));expect((await handler(new Request('https://test.invalid',{headers:{'x-cron-secret':'expected'}}))).status).toBe(200);
 });
 it('keeps the calendar worker fail-closed too',()=>{
  const source=readFileSync('supabase/functions/process_calendar_queue/index.ts','utf8');
  expect(source).toContain('if (!secrets.expected?.trim()) return false');expect(source).not.toContain('SKIP_CRON_SECRET');expect(source).not.toContain('Fingerprint');
 });
 it('rejects synthetic IDs at the live transport and production state boundary',()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('DEEPVISOR_META_SIMULATION','gkdyyjqepzayjdpvqnja');
  expect(metaStateSchema.shape.adset.shape.id.safeParse('act_dvsim_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_1_set1').success).toBe(false);
  expect(()=>new MetaActionAdapter({adsetId:'act_dvsim_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_1_set1',accountId:'123',accessToken:'test',liveEnabled:true})).toThrow('INVALID_META_CONFIGURATION');
 });
 it('extends deterministic simulation coverage only with a controlled clock',()=>{
  vi.stubEnv('NODE_ENV','test');vi.stubEnv('DEEPVISOR_META_SIMULATION','gkdyyjqepzayjdpvqnja');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://gkdyyjqepzayjdpvqnja.supabase.co');
  const config={businessId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',scenario:'single' as const,revision:0,anchorDay:'2026-10-22'};
  const account=simulationAccounts(config)[0];
  const result=simulatedMetaResponse(simulationToken(config),account.externalAccountId+'/insights',{time_range:JSON.stringify({since:'2026-10-21',until:'2026-10-21'}),level:'adset',time_increment:'1'}) as {data:{spend:string}[]};
  expect(result.data.map(row=>row.spend)).toEqual(['40']);
 });
});
