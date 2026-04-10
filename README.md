# DeepVisor Backend README

DeepVisor should be built as an account intelligence system. The backend is responsible for understanding an ad account after integration, preserving useful history, generating explainable recommendations, and improving those recommendations as the account changes over time.

This document is for backend engineering work. It focuses on what should happen after an ad account is connected, with Meta as the first concrete platform.

## Repo Basics

### Stack

- Frontend and backend runtime: Next.js
- Database and auth: Supabase
- Primary platform integration today: Meta
- Current backend foundations:
  - platform sync orchestration in `src/lib/server/sync`
  - assessment and classification in `src/lib/server/agency`
  - reporting and read models in `src/lib/server/repositories`
  - shared schema types in `src/lib/shared/types/supabase.ts`

### Important Scripts

- `npm run dev`: local development
- `npm run build`: production build verification
- `npm run types:supabase`: regenerate typed schema bindings for `public` and `ai`

### Backend Shape Today

- Integration callbacks and manual sync routes trigger backend sync orchestration.
- Meta is the first supported platform and currently drives the most complete flow.
- The current codebase already syncs selected ad account data, runs account assessment, and stores creative feature snapshots.

## API Endpoints

The active HTTP surface should stay small and production-oriented. Test-only sync endpoints have been removed. If we need to test sync behavior, use the real integration flow or call the underlying server functions directly in backend tests.

### Shared Route Helpers

- `src/lib/server/integrations/service.ts`
  - shared OAuth state handling, integration persistence, token resolution, account listing, and disconnect helpers
- `src/lib/server/integrations/metaSelection.ts`
  - shared route helper for:
    - setting the primary Meta ad account
    - running the real selected-account sync
    - applying selection cookies consistently

### Auth

- `GET /api/auth/verification`
  - purpose: verify Supabase email OTP links and redirect the user back into the app
  - auth: token hash from the email link
  - flow:
    - read `token_hash` and `type`
    - call `supabase.auth.verifyOtp`
    - redirect to `/dashboard` on success or `/login` on failure

### Integrations

- `GET /api/integrations/connect/[platform]`
  - purpose: start provider OAuth for a supported platform
  - auth: signed-in app user
  - flow:
    - resolve the current business context
    - create an OAuth state row
    - build the provider authorize URL
    - redirect to Meta

- `GET /api/integrations/callback/[platform]`
  - purpose: finish OAuth and move the business into discovery or full sync
  - auth: provider callback plus stored OAuth state
  - flow:
    - validate the callback payload and consume OAuth state
    - exchange the Meta code for a token and validate the token
    - upsert `platform_integrations`
    - fetch accessible Meta ad accounts
    - if more than one account is available:
      - run Step 01 discovery only through `discoverMetaAdAccounts`
      - redirect back to `/integration` with `requires_account_selection=1`
    - if exactly one account is available:
      - call `syncSelectedMetaAdAccount`
      - which sets the primary account, runs `syncBusinessPlatform`, then applies selection cookies

- `POST /api/integrations/disconnect`
  - purpose: soft-disconnect a platform integration without deleting historical data
  - auth: signed-in app user
  - flow:
    - validate `integrationId`
    - resolve the user business context
    - call `softDisconnectIntegration`

- `GET /api/integrations/meta/ad-accounts`
  - purpose: list selectable Meta ad accounts for a connected integration
  - auth: signed-in app user
  - flow:
    - validate `integrationId`
    - load the integration and current primary selection
    - attempt live Meta account listing
    - if Meta listing fails, fall back to saved `ad_accounts` rows
    - return a merged account list plus the current primary account

- `POST /api/integrations/meta/select-ad-account`
  - purpose: select the primary Meta ad account and run the real sync flow
  - auth: signed-in app user
  - flow:
    - validate `integrationId` and `externalAccountId`
    - load the Meta integration
    - verify the selected account is still accessible
    - call `syncSelectedMetaAdAccount`
    - which:
      - persists the primary account selection
      - runs `syncBusinessPlatform`
      - fetches the synced `ad_accounts` row
      - applies `platform_integration_id` and `ad_account_row_id` cookies

- `POST /api/integrations/refetch-ad-accounts`
  - purpose: internal/admin refresh for one or many businesses
  - auth: `x-internal-api-key` or bearer token matching `INTERNAL_API_KEY`
  - flow:
    - load the requested business or all businesses
    - call `syncConnectedBusinessPlatforms` with `trigger: 'cron'`
    - return per-business success and failure counts

- `POST /api/integrations/refresh`
  - purpose: backward-compatible alias for manual sync
  - auth: signed-in app user
  - flow:
    - re-exports `POST /api/sync/refresh`

### Sync

- `POST /api/sync/refresh`
  - purpose: user-triggered manual refresh for the current business
  - auth: signed-in app user
  - flow:
    - resolve the user business context
    - call `runManualBusinessSync`
    - enforce cooldown/rate limiting
    - on allowed runs, call `syncConnectedBusinessPlatforms`
    - per integration, call `syncBusinessPlatform`

### Reports

- `GET /api/reports/csv`
  - purpose: export the current report view as CSV
  - auth: signed-in app user
  - flow:
    - parse report query params for the current business
    - build the report payload and CSV rows
    - stream the CSV response with a generated file name

- `GET /api/reports/pdf`
  - purpose: export the current report view as PDF
  - auth: signed-in app user
  - flow:
    - parse report query params for the current business
    - build the PDF payload
    - render `ReportPdfDocument` on the server
    - return a PDF download

### Agency / Intelligence

- `POST /api/agency/assess`
  - purpose: run the current business or ad account assessment on demand
  - auth: signed-in app user
  - flow:
    - resolve the required app context and current selection
    - validate the request with `RunAgencyAssessmentRequestSchema`
    - call `runBusinessAgencyAssessment`
    - return the fresh assessment result

## Overview

DeepVisor is not just an AI model wrapper. It is an account intelligence system.

After an ad account is integrated, the backend should do more than import rows. It should determine what kind of account it is, understand how the account has behaved over time, identify what has worked and what has failed, and turn that into explainable optimization intelligence. Over time, it should preserve account memory so the system becomes more useful as additional syncs and outcomes accumulate.

Meta is the first platform because it is the most mature integration path in the current repo. The architecture should remain platform-extensible so the same lifecycle can later be applied to Google Ads, TikTok, and other supported platforms.

### Current Implementation Today

- Meta integration callback and ad account selection already trigger backend sync.
- Sync orchestration exists in `src/lib/server/sync/syncBusinessPlatform.ts`.
- Meta-specific orchestration exists in `src/lib/server/sync/meta/syncMetaBusinessPlatform.ts`.
- Account assessment and classification exist in `src/lib/server/agency/assessments/service.ts`.

### Near-Term Target Direction

- Treat every selected ad account as a long-lived intelligence object.
- Use sync + analysis + explainable recommendation generation as the default post-integration lifecycle.
- Keep account memory durable enough to support future feedback loops and ML.

## Post-Integration Flow

After a successful account integration, the backend should follow this sequence:

1. Detect the connected ad account or selected primary ad account.
2. Fetch account metadata and access context.
3. Determine whether meaningful historical data exists.
4. If history exists, ingest account structure and performance history.
5. If little or no history exists, classify the account as new and initialize fresh tracking.
6. Build or refresh an internal account intelligence profile.
7. Generate ranked recommendations from that profile.
8. Continue syncing over time so recommendations and account memory improve with new performance.

### Current Implementation Today

- The repo already orchestrates Meta post-integration sync from callback and account-selection routes into:
  - `syncBusinessPlatform`
  - `syncMetaBusinessPlatform`
  - account assessment
  - business assessment
- The current Meta flow already syncs:
  - ad accounts
  - campaigns
  - ad sets
  - ads
  - creatives
  - daily performance
- Creative enrichment is already stored in `ai.creative_feature_snapshots`.

### Near-Term Target Direction

- Make history detection explicit, not implicit.
- Build a durable intelligence profile per business and selected ad account.
- Move from "sync then assess" toward "sync, classify, analyze, recommend, learn."

## Account Classification

The backend should classify accounts into three primary product-level buckets:

- `new account`
  - little or no usable delivery history
  - recommendations should focus on onboarding defaults, controlled exploration, measurement setup, and first structured experiments
- `weak-history account`
  - some delivery exists, but signal quality is thin or inconsistent
  - recommendations should focus on tightening inputs, improving tracking confidence, and expanding only where there is early signal
- `mature account`
  - enough history exists to reuse proven patterns and optimize known winners
  - recommendations should focus on scaling, budget allocation, creative refresh, audience reuse, and efficiency improvements

Classification should change recommendation behavior. The system should not recommend the same strategy to a brand new account that it would recommend to a high-spend, well-instrumented account with durable history.

### Current Implementation Today

The current assessment layer already classifies accounts into more detailed internal states such as:

- `launch_ready`
- `learning`
- `optimizable`
- `mature`
- `stale`
- `misconfigured`

These internal states are useful for backend logic. The simpler three-bucket model above should be treated as the product-level maturity model for future recommendation behavior.

### Near-Term Target Direction

- Map the existing assessment states into the simpler maturity buckets.
- Use maturity bucket plus tracking confidence plus history depth as recommendation inputs.
- Keep the classification deterministic and testable before adding any learned model behavior.

## Layered Architecture

Development should proceed layer by layer. Each layer should be independently testable in the backend before the next layer becomes a dependency.

### Layer 1: Ingestion

Purpose:
- Pull enough account structure and performance data to understand what exists and how it has been performing over time.

Inputs:
- platform integration
- selected ad account
- access token
- sync trigger and backfill window

Outputs:
- synced account structure
- synced daily performance history
- creative metadata and creative feature snapshots
- sync summary and sync status

Current implementation today:
- Meta ingestion is substantially underway.
- The current flow syncs ad accounts, campaigns, ad sets, ads, creatives, and daily performance.
- `public.ad_accounts` already stores aggregated metrics, time-increment metrics, currency, timezone, status, and last-synced state.

Near-term target direction:
- Make first full-history sync and later incremental sync explicit modes.
- Use sync metadata to record what window was attempted, what succeeded, and what remains incomplete.
- Keep the ingestion layer platform-neutral behind orchestration boundaries.

### Layer 2: Account Analysis

Purpose:
- Turn raw synced structure and performance into patterns, summaries, and explainable account understanding.

Inputs:
- daily performance history
- campaign, ad set, ad, and creative structure
- creative feature snapshots
- historical availability and sync coverage

Outputs:
- account maturity classification
- performance summaries
- efficiency signals
- top and bottom entity breakdowns
- internal account intelligence profile

Current implementation today:
- Assessment and digest generation already exist for ad accounts and businesses.
- The current system computes weighted windows, maturity, tracking confidence, objective mix, recent activity, and top/bottom campaign and ad set breakdowns.

Near-term target direction:
- Expand the analysis layer into a stable account intelligence profile, not only an assessment digest.
- Explicitly identify top-performing campaigns, ad sets, audiences, creatives, placements, and objectives.
- Detect fatigue, wasted spend, weak tracking, inefficient structure, and missed opportunities.

### Layer 3: Recommendation Engine

Purpose:
- Convert account analysis into ranked, actionable recommendations.

Inputs:
- account intelligence profile
- maturity classification
- assessment summaries
- synced structure and recent performance

Outputs:
- recommendation objects with rationale, rank, and action scope

Current implementation today:
- The repo has recommendation intent in product language and some legacy recommendation query paths, but not a complete recommendation engine lifecycle.
- Recommendation generation should be treated as foundational or partial, not complete.

Near-term target direction:
- Start with a hybrid recommendation engine:
  - rules first
  - heuristics second
  - ML later
- Generate actions such as:
  - create a new campaign
  - create a new ad set under a strong campaign
  - reuse a proven audience
  - create a lookalike
  - refresh fatigued creatives
  - improve objective or budget allocation

### Layer 4: Feedback and Learning

Purpose:
- Improve future recommendations based on what the user did and what happened afterward.

Inputs:
- recommendation decisions
- post-launch performance outcomes
- edits, ignores, approvals, and rejections

Outputs:
- business-specific memory
- updated defaults
- stronger future recommendation ranking

Current implementation today:
- The schema already contains future-facing AI foundations such as `ai.business_agent_profiles` and `ai.agent_observations`.
- The repo does not yet implement a full recommendation acceptance or outcome-learning loop.

Near-term target direction:
- Track whether recommendations were accepted, rejected, launched, edited, or ignored.
- Measure downstream outcomes after execution.
- Update business-specific memory and recommended defaults over time.

## Historical Sync Behavior

Historical sync should behave differently on first sync versus later syncs.

### First-Time Sync

- If account history exists, ingest as much relevant history as practical.
- Capture the earliest and latest usable history window.
- Persist whether enough history exists to support recommendation quality.
- Build the initial intelligence profile from available structure and performance.

### Incremental Sync

- Refresh recent performance and structural changes.
- Update account intelligence without reprocessing the full account unless needed.
- Preserve prior history and extend account memory rather than replacing it.

### Current Implementation Today

- Current sync metrics and last-synced state live primarily in `public.ad_accounts`.
- Sync run and job tables exist in schema:
  - `public.platform_sync_runs`
  - `public.ingestion_jobs`
- Those tables are not yet the primary live orchestration path in current code.
- `ai.business_agent_profiles` already includes future-facing history and assessment fields such as:
  - `history_available`
  - `history_start_date`
  - `history_end_date`
  - `assessment_status`
  - `last_assessed_at`
  - `last_learning_update_at`

### Near-Term Target Direction

- Treat `business_agent_profiles` as the long-term backend memory record for account-level intelligence.
- Track whether recommendation quality is history-limited.
- Keep first sync and incremental sync testable as separate backend behaviors.

## Recommendation Philosophy

Recommendations should be specific to the account. They should not be generic summaries or generic AI advice.

Each recommendation should be ranked by:

- confidence
- expected impact
- implementation difficulty
- missing-data dependency

Recommendations should be generated at multiple levels:

- campaign
- ad set
- creative
- audience
- optimization

Recommendations should always be explainable. The system should be able to state why a recommendation exists, what evidence supports it, what level it applies to, and what missing data might reduce confidence.

### Current Implementation Today

- The existing repo has assessment summaries and creative-enrichment signals that can support explainable recommendation generation.
- It does not yet have a complete runtime recommendation object lifecycle or recommendation decision tracking.

### Near-Term Target Direction

- Build recommendation objects from deterministic analysis and heuristics first.
- Use analysis evidence directly in recommendation explanations.
- Add ML only after the deterministic engine is reliable and measurable.

## Backend Development Plan

Implementation should proceed in this order:

1. Complete ingestion.
2. Expand account analysis.
3. Add recommendation generation.
4. Add feedback and learning.

Each layer should be independently testable before it becomes a dependency for the next layer.

### Current Implementation Today

- Ingestion is substantially underway for Meta.
- Assessment and classification already exist.
- Creative feature enrichment already exists.
- Recommendation and feedback layers are still foundational or partial.

### Near-Term Target Direction

- Finish the Meta-first backend lifecycle before widening platform scope.
- Treat the recommendation engine as a backend system first, not a UI feature first.
- Make feedback and learning depend on stable recommendation objects and stable sync coverage.

## Initial Backend Testing Plan

Backend testing should come before frontend dependency work wherever possible.

Required scenarios:

- test integration with accounts that already have meaningful history
- test integration with brand new accounts
- test first sync versus incremental sync
- test classification logic across new, weak-history, and mature accounts
- test account intelligence profile generation
- test recommendation generation using mocked data and real synced data

Testing expectations:

- ingestion should be verifiable independently from assessment
- assessment should be verifiable independently from recommendation generation
- recommendation generation should be verifiable with deterministic fixtures before any ML layer is introduced
- the README must not claim a layer is live if the repo only contains schema placeholders or partial support

## Suggested Internal Outputs / Objects

These are the internal backend objects the system should ultimately produce and maintain.

### Existing Now

- account assessment digests
- business assessments
- creative feature snapshots
- sync summaries and sync counts
- selected ad account performance summaries

Concrete current examples include:

- `ai.business_assessments`
- ad account assessment records stored through the assessment repository
- `ai.creative_feature_snapshots`
- sync result objects returned by sync orchestration

### Planned / Should Exist Next

- account intelligence profile
- account maturity classification object
- recommendation objects
- sync job status objects used operationally
- reusable analysis summaries
- feedback records
- business-specific memory records

Concrete schema-level foundations already present or implied include:

- `ai.business_agent_profiles`
- `ai.agent_observations`
- future recommendation and feedback records

The important rule is that planned objects should not be treated as complete runtime systems until they are wired into backend orchestration, persistence, and tests.

## Near-Term Goal

The immediate backend goal is to build a reliable foundation that can understand an ad account, preserve its history, and generate explainable recommendations before moving toward deeper ML and automation.

That means:

- reliable Meta-first ingestion
- stable account classification
- durable account intelligence records
- explainable recommendation generation
- measured expansion into feedback and learning only after the earlier layers are dependable
