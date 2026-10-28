import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const project='gkdyyjqepzayjdpvqnja';
assert.equal(process.env.DEEPVISOR_META_SIMULATION,project);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,`https://${project}.supabase.co`);
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const user=JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users[0];
const evidence=JSON.parse(await readFile('docs/beta-readiness/automatic-sync/live.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:3011/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);
 const visit=page.waitForResponse(r=>r.url().includes('/api/sync/automatic-refresh')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 const first=await visit;assert.equal(first.status(),200);assert.equal((await first.json()).reason,'checked_today');
 const state=await context.request.get('http://localhost:3011/api/sync/automatic-refresh');const body=await state.json();
 assert.equal(body.status,'completed');assert.equal(body.lastSuccessfulAt,evidence.finishedAt);
 await page.getByText('Meta synchronization',{exact:false}).first().waitFor();
 assert.ok((await page.locator('main time').getAttribute('datetime'))===evidence.finishedAt);
 await page.locator('dd[title="$480.00"]').first().waitFor();await page.locator('dd[title="48"]').first().waitFor();
 await page.getByRole('button',{name:'Refresh Meta data',exact:true}).waitFor();
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const integration=await admin.from('platform_integrations').select('id,status,integration_details').eq('business_id',user.businessId).single();
 if(integration.error)throw integration.error;assert.equal(integration.data.integration_details['deepvisor-meta-phase2'].businessId,user.businessId);
 try{
  const changed=await admin.from('platform_integrations').update({status:'needs_reauth'}).eq('id',integration.data.id);if(changed.error)throw changed.error;
  const denied=await context.request.get('http://localhost:3011/api/sync/automatic-refresh');assert.equal((await denied.json()).status,'reauthentication_required');
  await page.reload();await page.getByText('Reconnect Meta in Connections to resume synchronization.',{exact:false}).waitFor();
  await page.locator('dd[title="$480.00"]').first().waitFor();
 }finally{const restored=await admin.from('platform_integrations').update({status:integration.data.status}).eq('id',integration.data.id);if(restored.error)throw restored.error;}
 const forged=await context.request.post('http://localhost:3011/api/sync/automatic-refresh',{headers:{origin:'http://localhost:3011'},data:{adAccountId:'foreign'}});assert.equal(forged.status(),400);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);
 await writeFile('docs/beta-readiness/automatic-sync/browser.json',JSON.stringify({actualPersistedTimestamp:evidence.finishedAt,selectedAccount:evidence.accountId,observedMetrics:{spend:480,results:48},repeatVisitDidNotQueue:true,manualButtonAvailable:true,reauthRetainsSavedAnalytics:true,forgedScopeRejected:true,widths:[1440,390],pageErrors:errors,screenshots:0},null,2));
 console.log('Authenticated sync state, persisted timestamp/KPIs, repeat visit, manual button, scope rejection and desktop/mobile checks passed.');
}finally{await browser.close();}
