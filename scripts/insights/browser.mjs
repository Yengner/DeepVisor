import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
assert.equal(process.env.DEEPVISOR_INSIGHTS_TEST,'gkdyyjqepzayjdpvqnja');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'https://gkdyyjqepzayjdpvqnja.supabase.co');
const users=[JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users[0],JSON.parse(await readFile('.env.beta-phase2.json','utf8')).users[1]],user=users[0];
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const must=r=>{if(r.error)throw r.error;return r.data;};
const integration=must(await db.from('platform_integrations').select('integration_details').eq('business_id',user.businessId).single());assert.ok(integration.integration_details['deepvisor-meta-phase2']);
const account=must(await db.from('ad_accounts').select('id').eq('business_id',user.businessId).eq('external_account_id',integration.integration_details.primary_ad_account_external_id).single());
const ad=must(await db.from('ad_entities').select('external_id,parent_external_id,name').eq('ad_account_id',account.id).eq('entity_level','ad').limit(1).single());
const entity={id:ad.external_id,name:'[SIMULATED] Salon creative',level:'ad',parent:ad.parent_external_id,campaign:null,configured:'ACTIVE',effective:'DISAPPROVED',start:null,end:'2026-11-10T16:00:00-0500',dailyBudget:null,lifetimeBudget:null,targeting:{}};
const reviewOnly=process.argv.includes('--review-only');
const obs=reviewOnly?null:must(await db.from('ad_lifecycle_observations').insert({business_id:user.businessId,ad_account_id:account.id,entities:[entity]}).select('id').single());
const event=reviewOnly?null:must(await db.from('ad_lifecycle_events').insert({business_id:user.businessId,ad_account_id:account.id,after_id:obs.id,event_key:'synthetic-insights-browser',kind:'unavailable',root_id:ad.external_id,affected_ids:[ad.external_id],explanation:'[SIMULATED] Delivery stopped after a disapproval in the test provider.',provenance:'observed'}).select('id').single());
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/sync/**',route=>route.request().method()==='POST'?route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Read-only browser verification'})}):route.continue());
 await page.goto('http://localhost:3000/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 const history=await (await context.request.get('http://localhost:3000/api/insights')).json();
 const saved=history.items.find(i=>i.payload.recap&&i.payload.issues.length);assert.ok(saved);
 if(reviewOnly){await page.goto(`http://localhost:3000/insights?id=${saved.id}`);}
 await page.getByRole('dialog').waitFor({timeout:60000});await page.getByRole('heading',{name:'Your results, and something to check',exact:true}).waitFor();
 const modal=page.getByRole('dialog');await modal.getByText('Meta rejected this advertisement',{exact:true}).waitFor();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/dv-insights-${width}.png`,fullPage:true});}
 assert.ok(saved.payload.recap);assert.ok(saved.payload.issues.length);if(event)assert.ok(saved.payload.lifecycle.some(e=>e.eventId===event.id));
 // Real persisted totals, at the same entity and date scope as the presentation.
 const recap=saved.payload.recap;
 const rows=must(await db.from('report_entity_daily_v').select('spend,leads,messages,calls').eq('business_id',user.businessId).eq('ad_account_id',account.id).eq('entity_level','adset').gte('day',recap.since).lte('day',recap.until));
 assert.ok(rows.length);assert.ok(Math.abs(recap.spend-rows.reduce((n,r)=>n+r.spend,0))<.001);assert.equal(recap.results,rows.reduce((n,r)=>n+r.leads+r.messages+r.calls,0));
 const tab2=await context.newPage();await tab2.goto('http://localhost:3000/dashboard');await tab2.waitForLoadState('domcontentloaded');assert.equal(await tab2.getByRole('dialog').count(),0);await tab2.close();
 for(const format of ['csv','pdf']){const response=await context.request.get(`http://localhost:3000/api/insights/export?id=${saved.id}&format=${format}`);assert.equal(response.status(),200);const bytes=await response.body();assert.ok(bytes.length>100);await writeFile(`/tmp/dv-insights.${format}`,bytes);if(format==='pdf')assert.equal(bytes.subarray(0,4).toString(),'%PDF');}
 if(!reviewOnly){
 await modal.getByRole('button',{name:'Got it',exact:true}).click();await modal.waitFor({state:'hidden'});await page.reload();await page.waitForLoadState('domcontentloaded');assert.equal(await page.getByRole('dialog').count(),0);
 await page.goto('http://localhost:3000/insights');await page.getByRole('heading',{name:'Insights & Events',exact:true}).waitFor();await page.getByRole('button').filter({hasText:'Your results, and something to check'}).first().click();await page.getByRole('dialog').waitFor();
 }
 const other=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});must(await other.auth.signInWithPassword({email:users[1].email,password:users[1].password}));assert.deepEqual(must(await other.from('insight_presentations').select('id').eq('id',saved.id)),[]);assert.deepEqual(must(await other.from('insight_issues').select('id').eq('ad_account_id',account.id)),[]);assert.ok((await other.rpc('acknowledge_insights',{p_account:account.id,p_user:users[1].id,p_id:saved.id,p_token:crypto.randomUUID()})).error);await other.auth.signOut({scope:'local'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:reviewOnly?'Authenticated saved-history rendering, persisted metrics, exports, tenant RLS':'Authenticated combined modal, persisted metrics, multi-tab claim, exports, dismissal, history, tenant RLS',presentation:saved.id,coverage:[recap.since,recap.until],spend:recap.spend,results:recap.results}));
}finally{await browser.close();}
