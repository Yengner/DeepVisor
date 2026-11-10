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
 await context.route('**/api/insights',route=>route.request().method()==='POST'?route.fulfill({status:200,contentType:'application/json',body:'{"presentation":null}'}):route.continue());
 await page.goto('http://localhost:3000/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 await page.getByRole('link',{name:'Test event scenarios',exact:true}).click();await page.waitForURL('**/insights/preview');
 const dialog=page.getByRole('dialog');await dialog.getByText('Preview only · 23 scenarios · No real advertising activity').waitFor();
 const requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url().split('?')[0]);});
 const select=dialog.getByLabel('Preview scenario');const ids=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));assert.equal(ids.length,23);
 for(const id of ids){await select.selectOption(id);await dialog.locator(`[data-insight-preview="preview-${id}"]`).waitFor();assert.equal(await dialog.locator('a[href^="/api/"]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await select.selectOption('daily');
 assert.equal(await dialog.locator('[data-granularity="hour"] > div').count(),24);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});await dialog.getByRole('heading',{name:'Hourly spend',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/dv-insights-hourly-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await select.selectOption('daily-missing');await dialog.getByText('Hourly data is unavailable for this saved report. Daily totals are shown above.').waitFor();
 await select.selectOption('catch-up');assert.equal(await dialog.locator('[data-granularity="day"] > div').count(),7);
 await select.selectOption('all');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/dv-insights-preview-${width}.png`,fullPage:true});}
 await dialog.getByRole('button',{name:'Switch to dark'}).click();await page.screenshot({path:'/tmp/dv-insights-preview-dark.png',fullPage:true});
 await dialog.getByRole('button',{name:'Switch to light'}).click();await dialog.getByRole('button',{name:'Dismiss preview'}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Open scenario preview'}).click();await dialog.waitFor();
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log('23 development scenarios rendered; 1440/390/320px, dark/light, reopen, and zero preview API requests passed.');
}finally{await browser.close();}
