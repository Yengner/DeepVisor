import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const user=JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users[0];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/sync/**',route=>route.fulfill({status:409,contentType:'application/json',body:'{"error":"Read-only visual verification"}'}));
 await context.route('**/api/insights',route=>route.fulfill({json:route.request().method()==='POST'?{presentation:null}:{items:[],issues:[],issueCount:1,next:null}}));
 await page.goto('http://localhost:3000/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 const sidebar=page.getByRole('complementary',{name:'Workspace navigation'});
 // The saved-updates history is reached from notifications and the popup, not the sidebar.
 assert.equal(await sidebar.getByRole('button',{name:/^Insights & Events/}).count(),0);
 await page.goto('http://localhost:3000/insights');await page.getByRole('heading',{name:'Insights & Events',exact:true}).waitFor();
 await sidebar.getByRole('button',{name:'Insights preview',exact:true}).click();await page.waitForURL('**/insights/preview**');
 await page.getByRole('heading',{name:'Insights & Events preview',exact:true}).waitFor();
 const requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url().split('?')[0]);});
 const list=page.getByRole('navigation',{name:'Preview scenarios'});const buttons=list.getByRole('button');
 const total=await buttons.count();assert.ok(total>=32,`expected at least 32 scenarios, got ${total}`);
 const category=page.getByLabel('Preview category');
 for(const [group,count] of [['performance',6],['lifecycle',8],['attention',8],['live',5],['combined',5],['coverage',7]]){await category.selectOption(group);assert.equal(await buttons.count(),count);}
 await category.selectOption('all');
 const frame=page.locator('[data-insight-preview]');
 for(let i=0;i<total;i++){await buttons.nth(i).click();await frame.first().waitFor();assert.equal(await page.locator('a[href^="/api/"]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 const pick=async id=>{await list.locator(`[data-scenario="${id}"]`).click();await page.locator(`[data-insight-preview="preview-${id}"]`).waitFor();};
 await pick('daily');assert.equal(await page.locator('[data-granularity="hour"] > div').count(),24);
 for(const width of ['Desktop','390px','320px']){await page.getByRole('group',{name:'Preview width'}).getByRole('button',{name:width}).click();await page.screenshot({path:`/tmp/dv-insights-hourly-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await pick('daily-missing');await page.getByText('Hourly breakdown isn’t available for this report').waitFor();
 for(const id of ['daily-missing','hourly-partial','sparse','zero','unknown','empty','long-names']){await pick(id);await page.screenshot({path:`/tmp/dv-insights-edge-${id}.png`,fullPage:true});}
 for(const id of ['live-rejection','live-delivery','fatigue','fatigue-recap','live-mixed']){await pick(id);await page.screenshot({path:`/tmp/dv-insights-live-${id}.png`,fullPage:true});}
 await pick('fatigue');assert.equal(await page.locator('[data-level="notice"]').count(),1);await page.getByText('Worth a look').first().waitFor();
 await page.getByRole('group',{name:'Preview width'}).getByRole('button',{name:'390px'}).click();await page.getByRole('button',{name:'Switch to dark'}).click();await page.screenshot({path:'/tmp/dv-insights-live-fatigue-390-dark.png',fullPage:true});
 await page.getByRole('button',{name:'Switch to light'}).click();await page.getByRole('group',{name:'Preview width'}).getByRole('button',{name:'Desktop'}).click();
 await pick('catch-up');assert.equal(await page.locator('[data-granularity="day"] > div').count(),7);
 await page.getByRole('group',{name:'Preview layout'}).getByRole('button',{name:'Gallery'}).click();assert.equal(await frame.count(),total);
 await page.getByRole('button',{name:'Switch to dark'}).click();await page.screenshot({path:'/tmp/dv-insights-gallery-dark.png',fullPage:true});await page.getByRole('button',{name:'Switch to light'}).click();
 await page.getByRole('button',{name:'Open as real modal'}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('button',{name:'Dismiss preview'}).click();await dialog.waitFor({state:'hidden'});
 for(const width of [390,320]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log(`${total} development scenarios rendered; widths, gallery, dark/light, real modal, and zero preview API requests passed.`);
}finally{await browser.close();}
