# Phase 4 — Export alignment and secondary navigation

Implemented Phase 4 only. Stop for review before Phase 5.

## Changes

- `src/lib/shared/reports/exportRecords.ts`: shared export records reuse the workspace calculations for performance, previous periods and changes, all advertising/context rows, every snapshot dimension/window, hourly totals/observed averages, persisted findings, and coverage states. No entity/period truncation or inferred commentary.
- `src/lib/shared/reports/exportLinks.ts` and Reports `components/ReportsClient.tsx`: download URLs use resolved query dates, hierarchy filters, scope, historical range, grouping, comparison and explicit demo mode.
- Reports `components/layout/ReportsHeader.tsx`: PDF/CSV menu explicitly exports all sections of the selected scope; wider menu supports mobile labels.
- `src/lib/server/reports/csv.ts` and `src/app/api/reports/csv/route.ts`: complete CSV with stable headers, row type/context, measurement boundaries, query metadata, missing metrics, demo labels, and spreadsheet-text escaping. Null stays blank; observed zero stays numeric zero.
- `src/lib/server/reports/pdf/{ReportPdfDocument,ReportPdfSections}.tsx` and `renderReportPdf.ts`: reuse the existing React PDF renderer with a summary cover and complete paginated measurement tables. Source windows, currencies, unavailable values, comparison units and recorded status are explicit. Continuation pages repeat column headers.
- `src/app/api/reports/pdf/route.ts`: private, non-cacheable downloads, matching CSV.
- `src/components/layout/{navigation,LeftSidebar}.tsx`: Reports in secondary navigation; the existing mobile drawer consumes the same list. Primary navigation and bottom tabs remain unchanged.
- Tests: `src/lib/shared/reports/exports.test.ts`, `src/lib/server/reports/exportRoutes.test.ts`, `src/components/layout/__tests__/navigation.test.ts`; `src/lib/server/reports/request.test.ts` gives the real PDF rendering test a specific 20-second timeout for parallel-suite execution.

## Verification

- Node 24.2.0. Full suite: **708 passed, 49 files**. Final focused export/request/navigation run: **17 passed, 4 files**.
- `npm run typecheck`: passed. Targeted ESLint for Phase 4 source/tests: passed, using a temporary flat config with the installed Next presets. The repository's `npm run lint` still invokes unavailable `next lint`; lint infrastructure was not changed.
- `npm run build`: passed.
- Deterministic calculations: spend 1,120, results 112, cost/result 10, impressions 9,100, CTR = 245 / 9,100 × 100; spend change +60%, CTR change 0 pp. Hourly observed totals/averages, delivery-only unavailable outcomes, mixed currency, unknown timezone/window, missing days, zeros and snapshot/report date separation verified.
- Route tests mock authentication, selected account and payload services: authenticated business scope ignores a supplied business ID, canonical filters reach the loader, demo avoids the live loader, authentication failures stop loading, and downloads have attachment/private headers.
- Generated actual PDF/CSV artifacts for healthy, sparse, mixed-currency, empty and failed fixtures. Parsed PDFs and CSVs separately; verified expected totals, blanks, all 40 stress-fixture entities including the last row, and page text bounds. Healthy stress PDF: 48 pages; other fixtures: 13–28 pages. Visually inspected cover/table pages and corrected overlapping continuation headers.
- Chromium isolated component harness: export menu and secondary navigation at 320, 390 and 1440 pixels; correct download URLs, navigation to `/reports`, no report horizontal overflow. Screenshots and generated artifacts are in `/tmp/deepvisor-report-preview/phase4-*` (temporary, not committed). Harness stubs Next navigation and unrelated account/notification services; this is not an authenticated live-app end-to-end test.

## Review considerations

- CSV now contains multiple record types, rather than entity rows alone. Consumers must filter `row_type` and `context`; dimensions, overlapping periods and context views must not be summed together. Existing metric column names are retained.
- Complete PDFs can be substantially longer than the old truncated report. Large real-account exports have not been load-tested; the 40-entity stress fixture verifies pagination and retention, not production throughput.
- Coverage uses verified source measurement boundaries; unknown stays unknown. Export generation does not resolve gaps in source data.
- No live Meta synchronization, automatic schedule changes, database migrations, dependency changes, deployment, commit or push. Existing Phase 1–3 and unrelated worktree changes are preserved.
- Phase 5 has not started.
