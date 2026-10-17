# Phase 3 review — analytical sections

Implemented focused audience, geography, placement/device, hourly, advertising and findings views. All use the existing reporting payload and saved sources. Section controls mount on first visit and retain their state between section switches. Phase 4 has not started.

## Files changed in Phase 3

Relative to `src/app/(root)/reports/`:

- `components/ReportsClient.tsx`: connects the focused sections; remains a small coordinator.
- `components/layout/ReportSectionPanel.tsx`: lazy section mounting and retained exploration state.
- `components/sections/BreakdownSection.tsx`: metric switching, age/gender views, country/region/DMA, publisher/placement/device, source-window selection, interactive ranked bars and exact-value table.
- `components/sections/TimeSection.tsx`: advertiser-local heatmap, metric selection, observed totals/averages, keyboard/touch cell inspection, mobile day selection and observation counts.
- `components/sections/AdvertisingSection.tsx`: hierarchy/context selection, explicit metric sorting, search, responsive entity cards, drilldowns and the existing detailed table.
- `components/sections/CreativePreview.tsx`: actual resolved creative images/posters, dimension checks and failure fallback.
- `components/sections/FindingsSection.tsx`: severity/status filters, persisted evidence, measurement windows and related report links.
- `components/sections/Sections.module.css`: shared analytical styling and responsive layouts.
- `PHASE_3_REVIEW.md`: this handoff.

Relative to `src/lib/shared/reports/`:

- `breakdowns.ts`: nullable snapshot aggregation, ratios, independent source windows and dimension grouping.
- `timeAnalysis.ts`: hourly totals/observed-date averages and weighted ratios.
- `advertising.ts`: metric-based sorting, availability and safe contextual drilldown links.
- `findings.ts`: persisted evidence extraction and filtering.
- `analytics.test.ts`: numerical assertions for the new analytical models.
- `fixtures.ts`: structured demographic/delivery observations, hierarchy, creative and finding fixtures.

Server files:

- `src/lib/server/reports/types.ts`: optional resolved creative preview on ad breakdown rows.
- `src/lib/server/reports/demo.ts`, `demoSurfaces.ts`: explicit demo-only snapshot and hourly measurements.
- `src/lib/server/repositories/reports/buildReportPayload.ts`: connects the extracted creative reader/resolver; no extra reporting data architecture.
- `src/lib/server/repositories/reports/creatives.ts`, `creatives.test.ts`: paginated creative reads scoped to authorized business/accounts, existing campaign media resolver, optional-media failure handling.

Retired Phase 2 compatibility modules after replacing their consumers: `sections/SavedBreakdowns.tsx`, `sections/AdvertisingRanking.tsx`, and shared `savedBreakdowns.ts`, `savedBreakdowns.test.ts`, `legacyFormatting.ts`. Their relevant numerical checks are covered by the new analytical tests. The hidden composite ranking score and US-only geographic default are no longer used.

## Correctness verified

- Source measurement dates determine snapshot windows. Different windows are never silently aggregated. Unknown windows remain explicitly unknown and their individual observations remain separate.
- Country, region and DMA are independent dimensions. Platform, placement and device views never sum one another.
- CTR, CPC, CPM and CPR use sums of their source numerators/denominators. Missing inputs remain unavailable; observed zero remains zero; zero denominators are unavailable.
- Delivery-only snapshots do not claim attributed results/CPR. Unverified unique reach remains unavailable. Mixed currencies suppress monetary bars and rankings.
- Hourly values use advertiser-local calendar dates, count observed dates, retain unobserved cells, and calculate ratios from aggregated measurements. Darker cells mean larger values, not an unsupported best-time recommendation.
- Advertising ordering uses the visible selected metric; unavailable values sort last. Historical paused entities remain available. Account-context views are labeled separately from selected scope.
- Finding coverage comes only from saved measurement boundaries, never detection timestamps. Saved evidence is not presented as a new evaluation.
- Creative requests are scoped to the authenticated business and authorized accounts; creative lookup keys include account ID. Media failures do not erase report metrics. Existing poster/fallback resolution and actual image dimensions are reused.

## Checks

- Targeted reporting tests: **101 passed** across six files.
- Full suite: **696 passed** across 46 files, including PDF rendering and reporting regressions.
- `npm run typecheck`: passed.
- Targeted ESLint with Next's flat configuration: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Existing Browserslist-age and Node experimental type-stripping warnings remain. The repository's legacy `next lint` script was not changed.

## Rendered validation and limits

Headless Chrome rendered all six analytical sections at **1280, 1440, 320, 390 and 430 px**: 30 section/viewport checks, with no page overflow or runtime exceptions. Verified metric/dimension switches, delivery-only unavailable states, keyboard heatmap inspection, creative rendering, entity search/sorting, detailed table access, date/demo-preserving drilldowns, saved evidence and empty/failed/missing-demographic states.

Screenshots and the temporary harness are in `/tmp/deepvisor-report-preview/`, including `phase3-audience-1440.png`, `phase3-time-320.png`, `phase3-advertising-1440.png` and `phase3-findings-320.png`. Screenshots were visually reviewed. These are local temporary artifacts.

The preview uses the real components with isolated deterministic payloads, stubbed Next navigation and intercepted synthetic creative images. It is not authenticated live-account validation. Actual remote creative availability, source permissions/retention and live Meta responses were not tested. Missing or unknown measurements remain labeled accordingly.

Existing PDF/CSV routes remain available; export alignment and secondary navigation belong to Phase 4. No sync implementation, scheduling behavior, advertising actions, database schema, dependencies, production configuration or deployment was changed. Existing unrelated working-tree changes were preserved.
