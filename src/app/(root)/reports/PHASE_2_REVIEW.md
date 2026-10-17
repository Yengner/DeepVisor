# Phase 2 review — Reports workspace foundation

Implemented the shared header/account controls, primary and expandable secondary metrics, local section navigation, and a single-metric Performance chart. Sections retain the URL query; filter changes retain the section hash. Reports reload still calls only `router.refresh()`.

The previous Reports client was 2,471 lines at the Phase 1 handoff; it is now an 85-line coordinator. Existing saved breakdowns, hourly heatmap, geographic map, advertising rankings, and detailed table remain reachable through sections. Their deeper redesign belongs to Phase 3. PDF and CSV endpoints are unchanged in this phase.

## Phase 2 file inventory

Paths relative to `src/app/(root)/reports/`:

- `components/ReportsClient.tsx` — workspace coordinator and existing exports/filter integration.
- `components/ReportsClient.module.css` — shared control sizing and mobile action labels.
- `components/Workspace.module.css` — focused workspace, metric strip, navigation and chart styling.
- `components/ReportMetrics.tsx` — primary/secondary metrics and correctly signed comparisons.
- `components/ReportDataStatus.tsx` — compact, deduplicated coverage/error status.
- `components/layout/ReportsHeader.tsx` — account selector, comparison control, completed-day presets, custom dates and history options.
- `components/layout/ReportSections.tsx` — local section state and browser-history support.
- `components/layout/reportNavigation.ts` — extracted scope/breadcrumb helpers.
- `components/sections/PerformanceSection.tsx` — metric selection, period overlay, tooltips and accessible exact-value table.
- `components/sections/SavedBreakdowns.tsx` — retained audience, geography, delivery and hourly views.
- `components/sections/AdvertisingRanking.tsx` — retained hierarchical rankings.
- `PHASE_2_REVIEW.md` — this handoff.

Paths relative to `src/lib/shared/reports/`:

- `performance.ts`, `performance.test.ts` — chart dates, availability, units and comparison alignment.
- `savedBreakdowns.ts`, `savedBreakdowns.test.ts` — extracted existing chart models with numerical regression checks.
- `legacyFormatting.ts` — extracted existing formatting helpers.
- `fixtures.ts` — isolated deterministic healthy, declining, sparse, mixed, missing-demographic, empty and failed scenarios using the existing demo builder. No live route imports these fixtures.

## Verified

- Full suite: **667 tests passed in 45 files**, including 24 new numerical checks.
- `npm run typecheck`: passed.
- Targeted ESLint using Next's flat configuration: passed. Repository `npm run lint` remains the existing unsupported `next lint` command; configuration was not changed.
- `npm run build`: passed. Existing Browserslist-age and Node type-stripping warnings remain.
- `git diff --check`: passed.
- Deterministic totals: spend 1,120; results 112; impressions 9,100; clicks 245; CPR 10; CTR = 245 / 9,100 × 100; CPC = 1,120 / 245; CPM = 1,120 / 9,100 × 1,000.
- Every Performance selector has expected-value assertions. Additional assertions cover age/gender, platform/device, geography and observed hourly fixture values.
- Missing dates remain null gaps; observed zero remains zero; undefined ratios and mixed-currency monetary values are unavailable. Previous-period values align by relative measurement dates, including shuffled inputs. Incompatible grouped boundaries suppress the overlay with an explanation.
- Snapshot coverage remains independent of selected dates. Source coverage calculation and reporting loader were not changed in this phase.

## Browser review and limits

Headless Chrome rendered the actual workspace components in an isolated synthetic preview at **1280, 1440, 320, 390 and 430 px**. No page overflow at those widths. Verified section switching without router requests, browser back, retained metric selection, touch controls, expanded metrics/table, completed 30D filter URLs, retained section hashes, filter drawer, grouping/history access, reload callback and canonical PDF/CSV link parameters. No browser runtime exceptions occurred.

Screenshots and the temporary preview harness are in `/tmp/deepvisor-report-preview/` (for example `reports-1440.png`, `reports-320.png`, `sparse-320.png`, `failed-320.png`). These are local temporary artifacts. The harness stubs Next navigation and uses the real components and deterministic payloads; this is **not** an authenticated live-account or full application-shell end-to-end test. The existing PDF render test passed in the full suite; browser downloads against authenticated export endpoints were not exercised.

No sync implementation, automatic scheduling, database schema, dependency/lockfile, deployment or live advertising behavior was changed. Pre-existing unrelated working-tree changes were preserved. Phase 3 has not started.
