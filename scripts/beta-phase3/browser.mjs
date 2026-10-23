import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { businesses } from '../beta-fixtures/fixture.ts';

const project='gkdyyjqepzayjdpvqnja';
assert.equal(process.env.DEEPVISOR_FIXTURES,project);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,`https://${project}.supabase.co`);
const {chromium}=createRequire('/tmp/deepvisor-reports-tools/package.json')('playwright');
const state=JSON.parse(await readFile(new URL('../../.env.beta-fixtures.json',import.meta.url),'utf8'));
const base='http://localhost:3011',out=new URL('../../docs/beta-readiness/phase3/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const evidence=[],errors=[],failures=[],expected={};
const widths=[320,390,430,768,1280,1440];
const sections=['Performance','Audience','Geography','Placements & devices','Time & day','Advertising','Findings'];
const money=n=>new Intl.NumberFormat('en',{style:'currency',currency:'USD'}).format(n);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function shift(day,n){return new Date(Date.parse(`${day}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);}
function totals(rows){if(!rows.length)return null;const sum=key=>rows.reduce((n,r)=>n+Number(r[key]??0),0);const spend=sum('spend'),results=sum('leads')+sum('messages')+sum('calls'),impressions=sum('impressions'),clicks=sum('clicks');return {spend,results,impressions,clicks,ctr:impressions?100*clicks/impressions:null,cpc:clicks?spend/clicks:null,cpm:impressions?1000*spend/impressions:null,cpr:results?spend/results:null};}
function csv(text){const records=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){records.push(row);row=[];}}else field+=c;}if(field||row.length){row.push(field.replace(/\r$/,''));records.push(row);}const [header,...rows]=records;return rows.map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]??''])));}
async function all(client,table,account){const rows=[];for(let from=0;;from+=500){let query=client.from(table).select('*').eq('ad_account_id',account);query=table==='ad_entity_performance_daily'?query.order('entity_id').order('day'):query.order('id');const result=await query.range(from,from+499);if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<500)return rows;}}
async function check(name,fn){try{await fn();evidence.push(name);}catch(e){failures.push({name,error:e.message});console.log('FAIL',name,e.message);}}
try {
 for(const b of businesses){
  const creds=state.users[b.key],client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await client.auth.signInWithPassword(creds);if(auth.error)throw auth.error;
  const facts=await all(client,'ad_entity_performance_daily',b.accountId),entities=await all(client,'ad_entities',b.accountId);
  expected[b.key]={business:b.name,account:b.accountId,today,periods:{}};
  for(const days of [1,7,30])expected[b.key].periods[days]=totals(facts.filter(r=>r.entity_level==='adset'&&r.day>=shift(today,1-days)&&r.day<=today));
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push({business:b.key,message:e.message}));
  await page.goto(`${base}/login`);await page.getByLabel('Email').fill(creds.email);await page.getByLabel('Password').fill(creds.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
  for(const [period,days] of [['today',1],['7d',7],['30d',30]])await check(`${b.key} Dashboard ${period} matches database`,async()=>{
   await page.goto(`${base}/dashboard?period=${period}`);const value=expected[b.key].periods[days];await page.locator('dl').first().getByText(value?money(value.spend):'—',{exact:true}).first().waitFor();
   const result=await context.request.get(`${base}/api/campaigns/exploration?account=${b.accountId}&level=adset&period=${period}`);assert.equal(result.status(),200);const view=await result.json();
   assert.equal(view.items.length,entities.filter(e=>e.entity_level==='adset').length);
   for(const item of view.items){const id=entities.find(e=>e.external_id===item.id).id;const metric=totals(facts.filter(r=>r.entity_id===id&&r.day>=shift(today,1-days)&&r.day<=today));assert.equal(item.metrics.spend,metric?.spend??null);assert.equal(item.metrics.results,metric?.results??null);if(period!=='today')assert.equal(item.metrics.reach,null);}
  });
  await check(`${b.key} campaign/ad-set/ad hierarchy and persisted metrics`,async()=>{
   const root=await (await context.request.get(`${base}/api/campaigns/exploration?account=${b.accountId}&level=campaign&period=30d`)).json();
   for(const campaign of root.items){const sets=await (await context.request.get(`${base}/api/campaigns/exploration?account=${b.accountId}&level=adset&period=30d&parent=${campaign.id}`)).json();
    for(const set of sets.items){const ads=await (await context.request.get(`${base}/api/campaigns/exploration?account=${b.accountId}&level=ad&period=30d&parent=${set.id}`)).json();for(const ad of ads.items){const entity=entities.find(e=>e.external_id===ad.id);assert.ok(entity);assert.equal(entity.parent_id,entities.find(e=>e.external_id===set.id).id);const t=totals(facts.filter(r=>r.entity_id===entity.id&&r.day>=shift(today,-29)));assert.equal(ad.metrics.spend,t?.spend??null);assert.equal(ad.metrics.results,t?.results??null);}}
   }
  });
  const params=new URLSearchParams({ad_account_id:b.accountId,date_from:'2026-10-13',date_to:'2026-10-19',compare:'previous_period'});
  await check(`${b.key} CSV reconciles fixed-period database metrics and snapshot dates`,async()=>{
   const response=await context.request.get(`${base}/api/reports/csv?${params}`);assert.equal(response.status(),200);const text=await response.text();await writeFile(new URL(`${b.key}-report.csv`,out),text);const rows=csv(text),summary=rows.find(r=>r.row_type==='summary'&&r.context==='Selected report');
   assert.ok(summary,JSON.stringify(rows.slice(0,2)));const t=totals(facts.filter(r=>r.entity_level==='adset'&&r.day>='2026-10-13'&&r.day<='2026-10-19'));assert.equal(Number(summary.spend),t.spend);assert.equal(Number(summary.conversion),t.results);assert.equal(summary.reach,'');assert.ok(Math.abs(Number(summary.ctr)-t.ctr)<1e-8);
   const snapshots=rows.filter(r=>r.row_type==='snapshot');assert.ok(snapshots.length);assert.ok(snapshots.some(r=>r.start_date==='2026-08-21'));assert.ok(snapshots.some(r=>r.start_date==='2026-10-13'));assert.ok(rows.some(r=>r.row_type==='hourly'));expected[b.key].export={...t,records:rows.length,snapshotWindows:[...new Set(snapshots.map(r=>`${r.start_date}/${r.end_date}`))]};
  });
  await check(`${b.key} actual PDF download`,async()=>{const r=await context.request.get(`${base}/api/reports/pdf?${params}`,{timeout:180000});assert.equal(r.status(),200);const body=await r.body();assert.equal(body.subarray(0,5).toString(),'%PDF-');await writeFile(new URL(`${b.key}-report.pdf`,out),body);});
  const foreign=businesses.find(x=>x.key!==b.key);
  await check(`${b.key} foreign exports/drilldowns/normal-client records denied`,async()=>{
   for(const format of ['csv','pdf']){const r=await context.request.get(`${base}/api/reports/${format}?ad_account_id=${foreign.accountId}`);assert.notEqual(r.status(),200);assert.ok(!(await r.text()).includes(foreign.name));}
   assert.equal((await context.request.get(`${base}/api/campaigns/exploration?account=${foreign.accountId}&level=adset`)).status(),409);
   for(const table of ['ad_entities','ad_creatives','ad_entity_performance_daily'])assert.deepEqual(await all(client,table,foreign.accountId),[]);
   const r=await context.request.get(`${base}/api/campaigns/exploration?account=${b.accountId}&level=ad&parent=forged`);assert.equal(r.status(),404);
  });
  if(b.key==='a'){
   for(const width of widths){await page.setViewportSize({width,height:1000});
    for(const path of ['dashboard','campaigns'])await check(`${path}/${width} authenticated layout`,async()=>{await page.goto(`${base}/${path}`);if(path==='dashboard')await page.getByRole('heading',{name:b.name,exact:true}).waitFor();else await page.getByRole('heading',{name:'Campaigns',exact:true}).waitFor();await page.locator('main').first().waitFor();await page.waitForTimeout(600);await writeFile(new URL(`${path}-${width}.txt`,out),await page.locator('body').innerText());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow');await page.screenshot({path:new URL(`${path}-${width}.png`,out).pathname,fullPage:true});});
    await page.goto(`${base}/reports?${params}`);
    for(const section of sections)await check(`Reports ${section}/${width}`,async()=>{await page.getByRole('navigation',{name:'Report sections'}).getByRole('button',{name:section,exact:true}).click();await page.getByRole('heading',{name:section==='Performance'?'Spend':section,exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow');await page.screenshot({path:new URL(`reports-${section.replaceAll(/[^a-z]/gi,'').toLowerCase()}-${width}.png`,out).pathname,fullPage:true});});
   }
  }
  await context.close();await client.auth.signOut();
 }
} finally {await writeFile(new URL('expected.json',out),JSON.stringify(expected,null,2));await writeFile(new URL('browser.json',out),JSON.stringify({evidence,failures,errors},null,2));console.log(JSON.stringify({checks:evidence.length,failures,errors},null,2));await browser.close();}
assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
