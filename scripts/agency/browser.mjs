// Read-only UI verification using existing synthetic Auth users. No Meta calls or approvals.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const base = process.env.AGENCY_BASE_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const credentials = JSON.parse(await readFile('.env.beta-fixtures.json', 'utf8')).users;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.name));
  await page.goto(`${base}/agency`); await page.waitForURL('**/login**');
  await page.getByLabel('Email').fill(credentials.a.email); await page.getByLabel('Password').fill(credentials.a.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/dashboard');
  await page.context().addCookies([{name: 'ad_account_row_id', value: 'eeee4445-0000-4000-8000-000000000001', url: base}]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/agency`); await page.getByRole('heading', { name: 'Agency activity' }).waitFor();
    await page.getByText('Simulated execution', { exact: true }).first().waitFor();
    for (const theme of ['light', 'dark']) {
      if (await page.locator('[data-dv-theme]').getAttribute('data-dv-theme') !== theme) await page.getByRole('button', { name: `Switch to ${theme} theme` }).click();
      await page.waitForFunction(expected => getComputedStyle(document.querySelector('[data-dv-theme]')).backgroundColor === expected, theme === 'dark' ? 'rgb(9, 23, 42)' : 'rgb(244, 247, 252)');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}/${theme}`);
      assert.equal(await page.locator('[data-spider-mascot]').first().getAttribute('data-state'), 'attention');
      assert.equal(await page.getByText('$120.00', {exact:true}).count(), 1);
      assert.equal(await page.getByText('18', {exact:true}).count(), 1);
      if (process.env.DEEPVISOR_CAPTURE === '1') { await mkdir('/tmp/deepvisor-agency', { recursive: true }); await page.screenshot({ path: `/tmp/deepvisor-agency/${width}-${theme}.png`, fullPage: true }); await page.getByRole('heading', {name:'Agency activity'}).scrollIntoViewIfNeeded(); await page.screenshot({path:`/tmp/deepvisor-agency/${width}-${theme}-activity.png`}); await page.locator('.app-platform-main').evaluate(el=>{el.scrollTop=0;}); }
    }
  }
  await page.goto(`${base}/agency?preview=decisions`);
  await page.getByRole('heading', {name: 'Agency story · Development preview'}).waitFor();
  for (const button of await page.getByRole('button', {name: 'Approve', exact: true}).all()) assert.equal(await button.isDisabled(), true);
  // A second normal session cannot select A's account by forging its selection cookie.
  const other = await browser.newPage();
  await other.goto(`${base}/login`); await other.getByLabel('Email').fill(credentials.b.email); await other.getByLabel('Password').fill(credentials.b.password);
  await other.getByRole('button', {name: 'Sign in', exact: true}).click(); await other.waitForURL('**/dashboard');
  await other.context().addCookies([{name: 'ad_account_row_id', value: 'eeee4445-0000-4000-8000-000000000001', url: base}]);
  await other.goto(`${base}/agency`); await other.getByRole('heading', {name: 'Agency activity'}).waitFor();
  assert.equal(await other.getByText('Simulated execution', {exact: true}).count(), 0);
  assert.equal(await other.getByRole('heading', {name: '[SYNTHETIC PHASE 4] Intelligence fixture'}).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: authenticated saved evaluations; 1440/390 light/dark; no overflow; preview cannot approve; forged cross-business selection rejected; no browser errors.');
} finally { await browser.close(); }
