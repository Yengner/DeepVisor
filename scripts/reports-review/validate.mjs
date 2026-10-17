import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tool dependencies live outside the application. See README.md beside this file.
const requireTool = createRequire(join(resolve(process.env.REPORTS_REVIEW_TOOLS), 'package.json'));
const { build } = requireTool('esbuild');
const { chromium } = requireTool('playwright');
const AxeBuilder = requireTool('@axe-core/playwright').default;
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..');
const output = await mkdtemp(join(tmpdir(), 'deepvisor-phase5-'));
const requireApp = createRequire(join(repo,'package.json'));
const globalStyles = await requireApp('postcss')([requireApp('tailwindcss')({config:join(repo,'tailwind.config.ts')}),requireApp('autoprefixer')]).process(await readFile(join(repo,'src/globals.css'),'utf8'),{from:join(repo,'src/globals.css')});
await writeFile(join(output,'global.css'),globalStyles.css);
await build({ entryPoints: [join(here, 'preview.tsx')], outdir: output, bundle: true, format: 'esm', jsx: 'automatic',
  nodePaths: [join(repo, 'node_modules')], alias: { '@': join(repo, 'src'), 'next/navigation': join(here, 'navigation.ts'), 'next/link': join(here, 'link.tsx') },
  define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.svg': 'dataurl', '.woff2': 'dataurl' } });
await writeFile(join(output, 'index.html'), `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Isolated Reports acceptance fixtures</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/preview.css"><style>body{--font-body:Arial;--font-display:Arial;margin:0;background:#f6f7f1;font-family:Arial,sans-serif;--platform-border:#dfe3d7;--platform-text-strong:#182119}#root{max-width:1392px;margin:auto;padding:24px}@media(max-width:760px){#root{padding:12px}}</style><div id="root"></div><script type="module" src="/preview.js"></script></html>`);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = ['/preview.js','/preview.css','/global.css'].includes(path) ? path.slice(1) : 'index.html';
  response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  response.end(await readFile(join(output, file)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const errors = [], accessibility = [];
let renders = 0;
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fixtures.invalid/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#dcecb9"/><text x="40" y="120" font-size="30">Synthetic creative fixture</text></svg>' }));
  const sections = [['Performance','performance'],['Audience','audience'],['Geography','geography'],['Placements & devices','delivery'],['Time & day','time'],['Advertising','advertising'],['Findings','findings']];
  for (const width of [1280,1440,320,390,430]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`${origin}/?demo=1`);
    for (const [name, key] of sections) {
      await page.getByRole('navigation',{name:'Report sections'}).getByRole('button',{name,exact:true}).click();
      await page.getByRole('heading',{name:key==='performance'?'Spend':name,exact:true}).waitFor();
      if (key==='advertising') await page.getByLabel('Entity scope').selectOption('ads');
      if (key==='findings') await page.getByText('Inspect saved evidence',{exact:true}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key}/${width}: overflow`);
      const active = page.getByRole('navigation',{name:'Report sections'}).locator('[aria-current]');
      assert.equal(await active.evaluate(el=>{const b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return b.left>=p.left-1&&b.right<=p.right+1;}),true,`${key}/${width}: active section hidden`);
      await page.screenshot({path:join(output,`${key}-${width}.png`),fullPage:true});
      if ([320,1440].includes(width)) {
        const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        accessibility.push({width,section:key,violations:result.violations});
      }
      renders++;
    }
  }
  await writeFile(join(output,'accessibility.json'),JSON.stringify(accessibility,null,2));
  const nav=page.getByRole('navigation',{name:'Report sections'});
  await nav.getByRole('button',{name:'Audience',exact:true}).click();
  await page.getByLabel('Audience view').selectOption('gender');
  await page.getByRole('combobox',{name:/^Breakdown metric/}).selectOption('ctr');
  await page.getByRole('button',{name:/female.*3.00%/}).click();
  await page.locator('aside').filter({hasText:'female'}).getByText('Clear selection',{exact:true}).waitFor();
  await nav.getByRole('button',{name:'Placements & devices',exact:true}).click();
  await page.getByRole('combobox',{name:/^Dimension/}).selectOption('platform_position');
  await page.getByRole('combobox',{name:/^Breakdown metric/}).selectOption('conversion');
  assert.match(await page.getByLabel('Results by segment').innerText(),/Unavailable/);
  await nav.getByRole('button',{name:'Time & day',exact:true}).click();
  const slot=page.getByRole('button',{name:'Thursday 9:00, Clicks: 10, 1 observed dates',exact:true});
  await slot.focus(); await page.keyboard.press('Enter');
  await page.getByText('Thursday · 9:00–9:59',{exact:true}).waitFor();
  await page.getByLabel('Hourly metric').selectOption('ctr');
  await page.getByRole('button',{name:'Thursday 9:00, CTR: 2.00%, 1 observed dates',exact:true}).waitFor();
  await nav.getByRole('button',{name:'Performance',exact:true}).click();
  await page.getByLabel('Chart metric').selectOption('cpc');
  await nav.getByRole('button',{name:'Audience',exact:true}).click();
  await page.goBack();
  assert.equal(await page.getByLabel('Chart metric').inputValue(),'cpc');
  await page.getByRole('button',{name:'Export',exact:true}).click();
  for(const name of ['Complete report · PDF','All report data · CSV']) {
    const href=await page.getByRole('menuitem',{name}).getAttribute('href');
    assert.match(href,/date_from=2026-10-08/); assert.match(href,/demo=1/); assert.match(href,/ad_account_id=/);
  }
  await page.keyboard.press('Escape');
  await nav.getByRole('button',{name:'Geography',exact:true}).click();
  await page.getByRole('button',{name:'30D',exact:true}).click();
  assert.equal(new URL(page.url()).hash,'#geography');
  assert.equal(new URL(page.url()).searchParams.get('date_from'),'2026-09-15');
  await page.getByText('Compare previous period',{exact:true}).click();
  assert.equal(new URL(page.url()).searchParams.get('compare'),'none');
  await page.getByRole('button',{name:'Reload saved report data'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.reportReloads),'1');
  await page.getByRole('button',{name:/Filters/}).click();
  await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
  for(const scenario of ['declining','sparse','mixed','empty','failed','missing-demographics','unknown-timezone']) {
    const section=scenario==='unknown-timezone'?'time':scenario==='missing-demographics'?'audience':'performance';
    await page.goto(`${origin}/?demo=1&scenario=${scenario}#${section}`);
    await page.getByRole('heading',{name:section==='time'?'Time & day':section==='audience'?'Audience':'Spend',exact:true}).waitFor();
    if(scenario==='unknown-timezone') {
      await page.getByText('A verified advertiser timezone is required.').waitFor();
      assert.equal(await page.getByText('Inspect hourly data',{exact:true}).count(),0);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:join(output,`${scenario}-430.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'accessibility.json'),JSON.stringify(accessibility,null,2));
  const violations=accessibility.flatMap(result=>result.violations.map(v=>`${result.section}/${result.width}: ${v.id}`));
  assert.deepEqual(violations,[],`Accessibility failures; inspect ${output}/accessibility.json`);
  console.log(`PASS: ${renders} section/viewport renders, seven data states, numerical interaction assertions, history/filter/export scope and ${accessibility.length} accessibility scans. Artifacts: ${output}`);
} finally { await browser.close(); server.close(); console.log(`Review artifacts: ${output}`); }
