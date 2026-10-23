import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const project = 'gkdyyjqepzayjdpvqnja';
assert.equal(process.env.DEEPVISOR_FIXTURES, project);
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, `https://${project}.supabase.co`);
const { chromium } = createRequire('/tmp/deepvisor-reports-tools/package.json')('playwright');
const { users } = JSON.parse(await readFile(new URL('../../.env.beta-fixtures.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const evidence = [], errors = [], base = 'http://localhost:3011';
page.on('pageerror', e => errors.push(e.message));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shift = days => new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
try {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(users.a.email); await page.getByLabel('Password').fill(users.a.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/dashboard');
  await page.goto(`${base}/reports`);
  for (const days of [null, 7, 30, 90]) {
    if (days) {
      await page.getByRole('button', { name: `${days}D`, exact: true }).click();
      await page.waitForURL(url => url.searchParams.get('date_from') === shift(-days) && url.searchParams.get('date_to') === shift(-1));
    }
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const link = page.getByRole('menuitem', { name: 'All report data · CSV', exact: true });
    await link.waitFor();
    const params = new URL(await link.getAttribute('href'), base).searchParams;
    assert.equal(params.get('date_from'), shift(-(days ?? 30)));
    assert.equal(params.get('date_to'), shift(-1));
    assert.equal(params.get('ad_account_id'), '7e365a93-b133-4574-aa86-89deb51030bf');
    evidence.push(`${days ?? 'Default 30'} completed days: ${params.get('date_from')} through ${params.get('date_to')}, America/New_York`);
    await page.keyboard.press('Escape');
  }
  await page.goto(`${base}/reports?date_from=${today}&date_to=${today}`);
  await page.getByText(/America\/New_York · Partial day/).waitFor();
  evidence.push('Custom range including today explicitly labeled Partial day');
  assert.deepEqual(errors, []);
} finally {
  await writeFile(new URL('../../docs/beta-readiness/phase3/periods.json', import.meta.url), JSON.stringify({ today, evidence, errors }, null, 2));
  console.log(JSON.stringify({ evidence, errors }, null, 2));
  await browser.close();
}
