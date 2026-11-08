import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const project='gkdyyjqepzayjdpvqnja',base='http://localhost:3016';
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,`https://${project}.supabase.co`);
assert.equal(process.env.DEEPVISOR_META_SIMULATION,project);
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const user=JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users[0];
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
const integration=must(await admin.from('platform_integrations').select('*').eq('business_id',user.businessId).single());
const original=integration.integration_details,tag='deepvisor-meta-phase2';assert.equal(original[tag].businessId,user.businessId);
const account=must(await admin.from('ad_accounts').select('*').eq('business_id',user.businessId).eq('external_account_id',original.primary_ad_account_external_id).single());
const today=new Intl.DateTimeFormat('en-CA',{timeZone:account.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const since=new Date(Date.parse(`${today}T00:00:00Z`)-6*86400000).toISOString().slice(0,10);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.name));
let completed=false, root, rootJob;
const visualOnly=process.argv.includes('--visual-only');
try {
 must(await admin.from('platform_integrations').update({integration_details:{...original,[tag]:{...original[tag],anchorDay:today,scenario:'multiple',revision:0}}}).eq('id',integration.id));
 await page.goto(`${base}/login`);await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 for(let i=0;i<60;i++){
  const active=must(await admin.from('account_sync_jobs').select('id').eq('ad_account_id',account.id).in('status',['queued','running']));
  if(!active.length)break;
  if(i===59)throw new Error('Automatic maintenance did not finish');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!visualOnly) {
 // Arrange genuine pending narrow work, then exercise the normal authenticated manual endpoint.
 must(await admin.from('account_sync_resources').delete().eq('ad_account_id',account.id).eq('resource_key',`audience:v2:age_gender:${since}:${today}`));
 const queued=must(await admin.rpc('request_account_resource',{p_business:user.businessId,p_integration:integration.id,p_account:account.id,p_kind:'audience',p_query:{version:2,since,until:today,breakdown:'age_gender',source:'assistant'},p_allow_simulation:true}));
 assert.equal(queued.status,'queued');
 const requested=await context.request.post(`${base}/api/sync/refresh`);assert.equal(requested.status(),202);root=await requested.json();assert.equal(root.jobId,queued.jobId);
 let state;
 for(let i=0;i<60;i++){
  state=await (await context.request.get(`${base}/api/sync/refresh?jobId=${root.jobId}`)).json();
  if(state.status==='completed')break;
  assert.ok(['queued','running'].includes(state.status),JSON.stringify(state));
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.equal(state.status,'completed');
 rootJob=must(await admin.from('account_sync_jobs').select('metadata').eq('id',root.jobId).single());
 assert.ok(rootJob.metadata.followupJobId);
 const manual=must(await admin.from('account_sync_jobs').select('sync_type,status,requested_start_date,requested_end_date').eq('id',rootJob.metadata.followupJobId).single());
 assert.equal(manual.sync_type,'manual_refresh');assert.equal(manual.status,'completed');assert.equal((Date.parse(manual.requested_end_date)-Date.parse(manual.requested_start_date))/86400000,29);
 const forbidden=await context.request.post(`${base}/api/sync/automatic-refresh`,{headers:{origin:base},data:{adAccountId:'forged'}});assert.equal(forbidden.status(),400);
 }
 await page.reload();await page.getByRole('button',{name:'Open DeepVisor assistant'}).click();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.getByLabel('Ask about this account').waitFor();
  await page.waitForFunction(() => {
    const editor=document.querySelector('#assistant-question');
    const rect=editor?.getBoundingClientRect();
    return rect && rect.x>=0 && rect.right<=innerWidth;
  });
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/dv-resource-${width}.png`,fullPage:true});
 }
 const insights=must(await admin.from('account_insight_snapshots').select('dataset,payload,coverage_start,coverage_end').eq('ad_account_id',account.id));
 assert.deepEqual(insights.map(r=>r.dataset).sort(),['audience','daily','hourly','learning']);
 assert.ok(insights.find(r=>r.dataset==='daily').payload.length>0);
 for (const [index,u] of JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users.slice(0,2).entries()) {
  const normal=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  must(await normal.auth.signInWithPassword({email:u.email,password:u.password}));
  const rows=must(await normal.from('account_insight_snapshots').select('dataset').eq('ad_account_id',account.id));
  assert.equal(rows.length,index===0?4:0);await normal.auth.signOut({scope:'local'});
 }
 assert.deepEqual(errors,[]);completed=true;
 await mkdir('docs/beta-readiness/resource-refresh',{recursive:true});
 await writeFile('docs/beta-readiness/resource-refresh/browser.json',JSON.stringify({authenticated:true,accountId:account.id,rootJob:root?.jobId,manualJob:rootJob?.metadata.followupJobId,manualWindowDays:visualOnly?undefined:30,status:'completed',visualOnly,widths:[1440,390],pageErrors:errors,provider:'simulated',paidAiRequests:0},null,2));
 console.log('Authenticated synthetic flow and persisted dataset isolation checks passed.');
} finally {
 await browser.close();
 // Leave synthetic controls in place if a worker is still using them; never change its provider mid-flight.
 const active=must(await admin.from('account_sync_jobs').select('id').eq('ad_account_id',account.id).in('status',['queued','running']));
 if(!active.length){
  const current=must(await admin.from('platform_integrations').select('integration_details').eq('id',integration.id).single());
  must(await admin.from('platform_integrations').update({integration_details:{...current.integration_details,[tag]:original[tag]}}).eq('id',integration.id));
 } else if(!completed) console.log('Synthetic job remains active; provider fixture controls retained until it finishes.');
}
