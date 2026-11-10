import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'https://gkdyyjqepzayjdpvqnja.supabase.co');
const user=JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users[0],db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const must=r=>{if(r.error)throw r.error;return r.data;};
const integration=must(await db.from('platform_integrations').select('integration_details').eq('business_id',user.businessId).single());assert.ok(integration.integration_details['deepvisor-meta-phase2']);
const account=must(await db.from('ad_accounts').select('id').eq('business_id',user.businessId).eq('external_account_id',integration.integration_details.primary_ad_account_external_id).single());
const ad=must(await db.from('ad_entities').select('external_id,parent_external_id,name').eq('ad_account_id',account.id).eq('entity_level','ad').limit(1).single());
const entity={id:ad.external_id,name:ad.name,level:'ad',parent:ad.parent_external_id,campaign:null,configured:'ACTIVE',effective:'CAMPAIGN_PAUSED',start:null,end:'2026-11-10T16:00:00-0500',dailyBudget:null,lifetimeBudget:null,targeting:{}};
const obs=must(await db.from('ad_lifecycle_observations').insert({business_id:user.businessId,ad_account_id:account.id,entities:[entity]}).select('id').single());
const event=must(await db.from('ad_lifecycle_events').insert({business_id:user.businessId,ad_account_id:account.id,after_id:obs.id,event_key:'synthetic-browser',kind:'parent_paused',root_id:ad.external_id,affected_ids:[ad.external_id],explanation:'[SIMULATED] This ad inherited a campaign pause before its planned end.',provenance:'reconstructed'}).select('id').single());
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3017/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 await page.getByRole('dialog').waitFor();await page.getByText('[SIMULATED] This ad inherited a campaign pause before its planned end.').waitFor();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/dv-lifecycle-${width}.png`,fullPage:true});}
 for(const format of ['csv','pdf']){const response=await context.request.get(`http://localhost:3017/api/lifecycle/${event.id}/export?format=${format}`);assert.equal(response.status(),200);const bytes=await response.body();assert.ok(bytes.length>100);if(format==='pdf')assert.equal(bytes.subarray(0,4).toString(),'%PDF');}
 await page.getByRole('button',{name:'Dismiss updates',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.reload();assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);
 console.log('Authenticated synthetic popup, desktop/mobile, PDF/CSV and persisted dismissal passed. Event '+event.id);
}finally{await browser.close();}
