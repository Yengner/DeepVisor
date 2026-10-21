import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { state, adminClient, tag } from './state.mjs';
const require=createRequire('/tmp/deepvisor-phase2-tools/package.json');
const {chromium}=require('playwright');
const data=await state(),admin=adminClient(),base='http://localhost:3011';
const out=new URL('../../docs/beta-readiness/phase2-browser/',import.meta.url);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.setDefaultTimeout(30000);
const evidence=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
async function shot(name){await page.screenshot({path:new URL(`${name}.png`,out).pathname,fullPage:true});}
async function pickAccount(name){
 const field=page.getByRole('textbox',{name:/Primary Meta ad account|Discovered Meta ad accounts/});
 await field.waitFor();
 // Click waits for discovery to finish and enable the field. Inspecting its value
 // before that race could select the now-current option again and clear Mantine's selection.
 await field.click();
 if(await field.inputValue()!==name)await page.getByRole('option',{name,exact:false}).click();
 else await field.press('Tab');
 const pending=page.waitForResponse(r=>r.url().includes('/select-ad-account')&&r.request().method()==='POST',{timeout:180000});pending.catch(()=>{});
 await page.getByRole('button',{name:/Select primary account and start sync|Save and sync account/}).click();
 const response=await pending,body=await response.json();assert.equal(body.success,true,JSON.stringify(body));
 await page.getByRole('textbox',{name:/Primary Meta ad account|Discovered Meta ad accounts/}).waitFor({state:'hidden'});
 return body.data;
}
try {
 const user=data.users[0];
 await page.goto(`${base}/login`);await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 await page.getByRole('heading',{name:'[SIMULATED] Phase 2 Salon A',exact:true}).waitFor();
 const own=await admin.from('platform_integrations').select('*').eq('business_id',user.businessId).single();if(own.error)throw own.error;
 const reset=await admin.from('platform_integrations').update({integration_details:{...own.data.integration_details,[tag]:{businessId:user.businessId,scenario:'multiple',revision:0}}}).eq('id',own.data.id);if(reset.error)throw reset.error;
 const foreign=await admin.from('platform_integrations').select('id').eq('business_id',data.users[1].businessId).single();if(foreign.error)throw foreign.error;
 const accounts=await admin.from('ad_accounts').select('id,external_account_id').eq('business_id',user.businessId).order('external_account_id');if(accounts.error)throw accounts.error;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=new Date(`${today}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-6);
 async function expectedSpend(accountId,from=start.toISOString().slice(0,10)) {
   const rows=await admin.from('ad_entity_performance_daily').select('spend').eq('ad_account_id',accountId).eq('entity_level','adset').gte('day',from).lte('day',today);
   if(rows.error)throw rows.error;
   return rows.data.length?new Intl.NumberFormat('en',{style:'currency',currency:'USD'}).format(rows.data.reduce((sum,row)=>sum+Number(row.spend),0)):'—';
 }
 // Always start from account 1, including a rerun after a partially completed browser journey.
 await page.goto(`${base}/integration`);await page.getByRole('button',{name:'Change ad account',exact:true}).first().click();
 await pickAccount('[SIMULATED] Salon account 1');
 await page.goto(`${base}/dashboard`);
 let response=await context.request.post(`${base}/api/integrations/meta/select-ad-account`,{data:{integrationId:foreign.data.id,externalAccountId:accounts.data[0].external_account_id}});assert.equal(response.status(),404);
 response=await context.request.post(`${base}/api/integrations/meta/select-ad-account`,{data:{integrationId:own.data.id,externalAccountId:'act_forged'}});assert.equal(response.status(),400);
 response=await context.request.post(`${base}/api/integrations/meta/select-ad-account`,{data:'{invalid',headers:{'Content-Type':'application/json'}});assert.equal(response.status(),400);
 evidence.push('Authenticated forged integration/account IDs and malformed selection rejected');
 // UI refresh must acknowledge durable work, poll it, and only then display completion.
 const queued=page.waitForResponse(r=>r.url().endsWith('/api/sync/refresh')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Refresh Meta data',exact:true}).click();
 response=await queued;const job=await response.json();assert.equal(response.status(),202);assert.ok(job.jobId);
 const rapid=await context.request.post(`${base}/api/sync/refresh`);assert.ok([202,429].includes(rapid.status()));
 if(rapid.status()===202)assert.equal((await rapid.json()).jobId,job.jobId);
 await page.getByRole('status').filter({hasText:/Refresh completed|Meta data updated/}).waitFor({timeout:180000});
 await shot('manual-refresh');
 evidence.push(`Manual refresh returned 202, polled ${job.jobId}, displayed completed; rapid repeat ${rapid.status()}`);
 // Existing Connections account picker must retain the selected internal account on reload.
 await page.goto(`${base}/integration`);
 await page.getByRole('button',{name:'Change ad account',exact:true}).first().click();
 const selected=await pickAccount('[SIMULATED] Salon account 2');assert.equal(selected.adAccountId,accounts.data[1].id);
 await page.goto(`${base}/dashboard`);await page.getByRole('heading',{name:'[SIMULATED] Phase 2 Salon A',exact:true}).waitFor();
 const spend2=await expectedSpend(accounts.data[1].id);
 await page.getByText(spend2,{exact:true}).first().waitFor();await page.reload();await page.getByText(spend2,{exact:true}).first().waitFor();
 await shot('account-2-dashboard');evidence.push(`Account switch persisted; Dashboard 7D spend matches account 2 database rows (${spend2}, as of ${today})`);
 await page.getByText('Today',{exact:true}).click();await page.waitForURL('**period=today');await page.getByText(await expectedSpend(accounts.data[1].id,today),{exact:true}).first().waitFor();await shot('today');
 await page.getByText('30D',{exact:true}).click();await page.waitForURL('**period=30d');await page.getByText('[SIMULATED] Historical facial',{exact:true}).first().waitFor();await shot('30-day-paused-history');
 await page.setViewportSize({width:390,height:844});await shot('dashboard-mobile');await page.setViewportSize({width:1440,height:1000});
 evidence.push('Today matches source coverage (missing remains unavailable); 30-day paused history rendered; mobile screenshot captured');
 for(const scenario of ['none','permissions','expired','connection_failure']) {
   const marked=await admin.auth.admin.updateUserById(user.id,{app_metadata:{[tag]:{scenario,revision:0}}});if(marked.error)throw marked.error;
   await page.goto(`${base}/api/integrations/connect/meta?returnTo=/integration`);
   assert.equal(new URL(page.url()).searchParams.get('status'),'error');
   evidence.push(`Connection scenario ${scenario}: callback returned error`);
 }
 const marked=await admin.auth.admin.updateUserById(user.id,{app_metadata:{[tag]:{scenario:'multiple',revision:0}}});if(marked.error)throw marked.error;
 const disconnected=await context.request.post(`${base}/api/integrations/disconnect`,{data:{integrationId:own.data.id}});assert.equal(disconnected.status(),200);
 await page.goto(`${base}/dashboard`);await page.getByRole('heading',{name:'Connect your advertising'}).waitFor();await shot('disconnected-after-sync');
 await page.goto(`${base}/api/integrations/connect/meta?returnTo=/integration`);await pickAccount('[SIMULATED] Salon account 1');
 await page.goto(`${base}/dashboard`);await page.getByText(await expectedSpend(accounts.data[0].id),{exact:true}).first().waitFor();evidence.push('Disconnect showed disconnected Dashboard; reconnect reused existing account and recovered data');
 await page.getByRole('button',{name:'Log out',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForURL('**/login');
 await page.goto(`${base}/campaigns`);await page.waitForURL('**/login');
 assert.deepEqual(errors,[]);
} catch(error) {await shot('reliability-failure');console.log('Page state',new URL(page.url()).pathname,(await page.locator('body').innerText()).slice(-1500));throw error;}
finally {await writeFile(new URL('reliability.json',out),JSON.stringify({evidence,errors},null,2));console.log(JSON.stringify({evidence,errors},null,2));await browser.close();}
