# Reports acceptance review

Run this isolated harness after the numerical Vitest reporting tests. It bundles the actual Reports components, application theme and compiled global styles with synthetic fixtures, stubs Next navigation, and serves only on a random localhost port. It never queries Meta or a database. Browser URL changes are inspected but do not fetch replacement server payloads; this is not authenticated end-to-end testing.

Install review tools outside the repository (no application dependency/lockfile changes):

```sh
npm install --prefix /tmp/deepvisor-reports-tools --no-package-lock esbuild playwright @axe-core/playwright
REPORTS_REVIEW_TOOLS=/tmp/deepvisor-reports-tools \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node scripts/reports-review/validate.mjs
```

Use Node 24. On other platforms set `CHROME_PATH` to a Chrome/Chromium executable, or install Playwright Chromium in the external tool directory and omit `CHROME_PATH`.

The script checks all seven sections at 1280, 1440, 320, 390 and 430 pixels, catches page overflow/runtime errors, exercises numerical chart inspection and scoped navigation, captures seven availability scenarios, and runs WCAG A/AA axe scans at desktop/mobile widths. Temporary artifacts include screenshots and `accessibility.json`; their directory is printed even on assertion failure. Visually inspect the screenshots as well as the automated results. The isolated preview uses Arial fallback fonts; it does not load Next font assets or the authenticated application shell. Automated accessibility scans do not establish complete accessibility conformance.

The harness runs only explicitly and is not a production route. Its generated assets and screenshots stay outside the repository. Production loading transitions, authenticated server navigation and live account permissions/retention still require a suitable authenticated environment.
