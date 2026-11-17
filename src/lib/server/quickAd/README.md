# Quick ad

Owner uploads a photo or video at `/campaigns/quick` (or "Quick ad" on Campaigns) and gets a
**paused, review-required draft** in the existing builder. Nothing is published and no Meta
write is reachable from this flow.

| Piece | Location |
| --- | --- |
| Source choice, plan, schedule (pure) | `src/lib/shared/quickAd/plan.ts` |
| Ad text contract, validation, fallback, prompt (pure) | `src/lib/shared/quickAd/copy.ts` |
| WhatsApp welcome setup parser (pure) | `src/lib/shared/quickAd/welcome.ts` |
| Orchestration | `src/lib/server/quickAd/service.ts` (`server-only`) |
| Upload + create | `POST /api/campaigns/quick-ad` (multipart) |
| Page | `src/app/(root)/campaigns/quick/` |
| Draft building | existing `createCampaignReuseDraft` with optional `content` |

## How a draft is made

1. Scope from `authorizeAssistant` (session business, selected Meta account, integration).
2. Answers from business facts (`server/agent`); missing ones are asked inline (owner/admin),
   then saved once.
3. Source ad set from `adset_dims` (what the reuse flow reads): WhatsApp first, then other
   messaging; lowest cost per result with ≥3 results in 90 saved days, else most recent.
   Deleted/archived are never used.
4. The source's latest ad supplies the **WhatsApp welcome setup** (`page_welcome_message`,
   ice breakers or pre-filled message), carried over unchanged; the owner's saved greeting is
   used only when the source has none. Its text is the fallback ad text.
5. Daily limit (10 per business, account-local day) counted from `ai.ai_generation_runs`
   (`source_type = quick_ad_copy`), checked **before** upload or model call.
6. Media validated by magic bytes (JPEG/PNG/WebP/MP4/WebM ≤4 MB) and stored privately in
   `assistant-draft-media` at `business/account/user/quick/<uuid>`; removed if the draft fails
   or replays. The existing draft-media GET route serves it to the draft's creator.
7. One `runStructuredAI` call (`gpt-5.4-nano` default, 8 s cap, recorded run) writes one
   variant per client language. Output must match the schema, every language, length limits,
   and contain no links or phone numbers; the prompt carries Meta's personal-attributes rule
   and forbids invented prices or claims. On any failure the previous ad's text is reused
   (first language only) and the review note says so.
8. Draft via `createCampaignReuseDraft` (`creativeMode: fresh`): exact source configuration,
   daily budget, start at next local midnight, whole local days, one creative per language,
   media, welcome setup, `PAUSED` + `reviewRequired`. Planned spend above the monthly limit is
   flagged, not blocked; existing budget guardrails still apply.

## Limits and follow-ups

- Small race: two simultaneous requests can exceed the daily limit by one.
- Draft media retention follows the assistant bucket (Jira KAN-6, not yet defined).
- Publishing (needs `ads_management` and App Review) and translating the page are separate work.
- The assistant draft path still maps WhatsApp to `LEAD_GENERATION`; Quick ad keeps the
  source ad set's `CONVERSATIONS` goal.

Tests: `npm test -- src/lib/shared/quickAd src/lib/server/quickAd src/lib/server/campaigns/reuse.test.ts`.
