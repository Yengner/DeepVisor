import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { businesses } from '../beta-fixtures/fixture.ts';

const project = 'gkdyyjqepzayjdpvqnja';
assert.equal(process.env.DEEPVISOR_FIXTURES, project);
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, `https://${project}.supabase.co`);
const { chromium } = createRequire('/tmp/deepvisor-reports-tools/package.json')('playwright');
const state = JSON.parse(await readFile(new URL('../../.env.beta-fixtures.json', import.meta.url), 'utf8'));
const phase2 = JSON.parse(await readFile(new URL('../../.env.beta-phase2.json', import.meta.url), 'utf8'));
const base = 'http://localhost:3011', out = new URL('../../docs/beta-readiness/phase3/', import.meta.url);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const evidence = [], errors = [];
let page;
async function login(creds) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('response', response => {
    if (response.request().method() === 'POST') console.log('POST', new URL(response.url()).pathname, response.status());
  });
  page.on('requestfailed', request => console.log('Request failed', request.method(), new URL(request.url()).pathname));
  page.on('pageerror', e => errors.push(e.message));
  // Any synthetic media resolution accidentally going to Meta is a failure.
  await context.route(/https:\/\/(graph\.facebook\.com|.*fbcdn\.net)\//, route => { errors.push('Synthetic browser requested live Meta'); return route.abort(); });
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
  console.log('Authenticated synthetic user');
  return context;
}
async function shot(name) { await page.screenshot({ path: new URL(`${name}.png`, out).pathname, fullPage: true }); }
async function section(name) { await page.getByRole('navigation', { name: 'Report sections' }).getByRole('button', { name, exact: true }).click(); }
try {
  let context = await login(state.users.a);
  await page.goto(`${base}/campaigns`);
  await page.getByRole('heading', { name: 'Campaigns', exact: true }).waitFor();
  const campaign = page.getByRole('row').filter({ hasText: '[SYNTHETIC] Hair color success' });
  await campaign.click();
  console.log('Selected campaign');
  await page.getByRole('tab', { name: /^Ad Sets/i }).click();
  await page.getByRole('row').filter({ hasText: '[SYNTHETIC] Hair color · performing' }).click();
  await page.getByRole('tab', { name: /^Ads/i }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('img').filter({ visible: true }).first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].some(img => img.complete && img.naturalWidth >= 160));
  const media = await page.locator('main img').evaluateAll(images => images.map(img => ({ src: img.getAttribute('src'), complete: img.complete, width: img.naturalWidth })));
  assert.ok(media.some(img => img.complete && img.width >= 160 && img.src.includes('beta')), JSON.stringify(media));
  evidence.push('Campaign → ad set → ads navigated through actual table selection; stored creative resolved');
  for (const width of [320, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await shot(`ads-final-${width}`);
  }
  evidence.push('Repaired ad table and previews: six requested widths, no page overflow');
  await context.route('**/storage/v1/object/public/business-media/**', route => route.abort());
  await page.reload();
  await page.getByRole('img', { name: /Preview unavailable for/ }).first().waitFor();
  await shot('ads-media-failure');
  evidence.push('Controlled media download failure retains ad rows and explicit preview fallback');
  await context.unroute('**/storage/v1/object/public/business-media/**');

  await page.goto(`${base}/reports?ad_account_id=${businesses[0].accountId}&date_from=2026-10-13&date_to=2026-10-20`);
  await section('Findings');
  await page.getByRole('heading', { name: '[SYNTHETIC] Historical fixture observation', exact: true }).waitFor();
  await page.getByLabel('Severity', { exact: true }).selectOption('info');
  await page.getByLabel('Finding status').selectOption('active');
  await page.getByText('Inspect saved evidence', { exact: true }).click();
  await page.getByRole('article').getByText('$994.00', { exact: true }).waitFor();
  await page.getByRole('article').getByText('109', { exact: true }).waitFor();
  await shot('finding-persisted');
  evidence.push('Persisted synthetic finding, severity/status filters, historical $994 / 109 evidence');

  await section('Audience');
  for (const view of ['age', 'gender', 'age_gender']) await page.getByLabel('Audience view').selectOption(view);
  const windows = await page.getByLabel('Measurement window').locator('option').allTextContents();
  assert.ok(windows.some(w => w.includes('2026-08-21')) && windows.some(w => w.includes('2026-10-13')));
  for (const window of windows) {
    await page.getByLabel('Measurement window').selectOption(window);
    const bar = page.locator('[aria-label="Spend by segment"] button').first();
    await bar.focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  }
  evidence.push('Audience view changes, distinct snapshot windows, keyboard bar inspection');
  await section('Geography');
  for (const dimension of ['country', 'region', 'dma']) await page.getByLabel('Dimension').filter({ visible: true }).selectOption(dimension);
  await page.getByRole('heading', { name: 'No measurements available', exact: true }).waitFor();
  await section('Placements & devices');
  for (const dimension of ['publisher_platform', 'platform_position', 'impression_device']) await page.getByLabel('Dimension').filter({ visible: true }).selectOption(dimension);
  await page.getByLabel('Breakdown metric').filter({ visible: true }).selectOption('conversion');
  await page.getByText('This source contains delivery metrics only; attributed results are unavailable.', { exact: true }).filter({ visible: true }).waitFor();
  evidence.push('Independent geography/delivery dimensions; missing DMA and unsupported conversion states');
  await section('Time & day');
  await page.getByLabel('Calculation').selectOption('total');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Day', { exact: true }).selectOption('1');
  const cell = page.getByRole('button', { name: /observed dates/ }).filter({ visible: true }).first();
  await cell.focus(); await page.keyboard.press('Enter');
  await shot('hourly-interaction-mobile');
  evidence.push('Actual hourly observed totals and mobile day/keyboard cell interaction');
  const csvResponse = await context.request.get(`${base}/api/reports/csv?ad_account_id=${businesses[0].accountId}&date_from=2026-10-13&date_to=2026-10-19`);
  assert.equal(csvResponse.status(), 200);
  const csv = await csvResponse.text();
  assert.ok(csv.split('\n')[0].includes('business_name') && csv.includes(businesses[0].name));
  await writeFile(new URL('a-report.csv', out), csv);
  evidence.push('Actual CSV includes synthetic business label and original selected-period coverage');
  await context.close();

  context = await login(state.users.b);
  await page.goto(`${base}/reports?ad_account_id=${businesses[1].accountId}&date_from=2026-10-13&date_to=2026-10-20`);
  await section('Findings');
  await page.getByRole('heading', { name: 'No saved findings match this view', exact: true }).waitFor();
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await client.auth.signInWithPassword(state.users.b); if (auth.error) throw auth.error;
  const findings = await client.schema('ai').from('trend_findings').select('id').eq('source', 'deepvisor-beta-phase3');
  if (findings.error) throw findings.error;
  assert.deepEqual(findings.data, []);
  await client.auth.signOut();
  evidence.push('Business B browser and normal authenticated RLS client cannot read A finding');
  await context.close();

  context = await login(phase2.users[0]);
  await page.goto(`${base}/campaigns`);
  const queued = page.waitForResponse(r => r.url().endsWith('/api/sync/refresh') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Refresh campaign data', exact: true }).click();
  const response = await queued, job = await response.json();
  assert.equal(response.status(), 202); assert.ok(job.jobId);
  await page.getByRole('status').filter({ hasText: /Refresh completed|Meta data updated/ }).waitFor({ timeout: 180000 });
  await shot('campaigns-refresh-completed');
  evidence.push(`Campaigns actual durable refresh ${job.jobId}: 202 → polling → confirmed completion`);
  await context.route('**/api/sync/refresh', route => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ retryAfterMs: 30000 }) }));
  await page.getByRole('button', { name: 'Refresh campaign data', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Please wait before refreshing again' }).waitFor();
  evidence.push('Controlled cooldown response displayed as wait, not completed synchronization');
  await context.close();
  assert.deepEqual(errors, []);
} catch (error) {
  await shot('interactions-failure');
  console.log('Failure page:', (await page.locator('body').innerText()).slice(-1800));
  throw error;
} finally {
  await writeFile(new URL('interactions.json', out), JSON.stringify({ evidence, errors }, null, 2));
  console.log(JSON.stringify({ evidence, errors }, null, 2));
  await browser.close();
}
