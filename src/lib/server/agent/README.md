# Business advertising facts ("ask once, remember")

What DeepVisor knows about how a business advertises, used to prefill drafts (Quick ad,
next) without asking the owner the same questions twice.

| Piece | Location |
| --- | --- |
| Fact keys, validation, freshness, history derivation, resolution | `src/lib/shared/agent/facts.ts` (pure) |
| Owner-facing labels/questions | `src/lib/shared/agent/factCopy.ts` |
| Persistence and loading | `src/lib/server/agent/facts.ts` (`server-only`) |
| Owner/admin writes | `src/app/(root)/settings/adFactsActions.ts` |
| Settings card | `src/app/(root)/settings/components/AdFactsCard.tsx` (`/settings#ad-facts`) |
| Table | `public.business_ad_facts`, migration `20261117035925_business_ad_facts.sql` |

## Facts

`daily_budget`, `monthly_ceiling` (integer minor units + ISO currency, Meta's budget
convention), `run_days` (1–90), `whatsapp_greeting` (≤300 chars), `client_languages`
(`en`/`es`), `slow_days` (weekday list; empty means "no slow days").

## Rules

- **Owner answers** are stored one per key with `confirmed_at`/`confirmed_by`. A fresh answer
  always wins. Freshness windows are in `FACT_FRESH_DAYS` (90–365 days).
- **History** is computed on read from the selected account's saved ad sets, never stored:
  `daily_budget` = most recently created ad set's daily budget, else its campaign's daily
  budget (campaign budget optimization); `run_days` = median scheduled length. Ad sets
  missing the fields are skipped. History fills a fact only when there is no fresh answer.
- **Ask** (`factsToAsk`) only when neither a fresh answer nor history supplies the fact.
- Stored values that fail validation, or money in a different currency from the ad
  account, are ignored rather than trusted. Nothing is defaulted.

## Access

Members read their business's facts through RLS (`can_access_business`). `anon` and
`authenticated` have no write grants; writes use the admin client only after the action
resolves the business from the session and requires owner/admin. The browser never
supplies a business id. Rows cascade with the business and are also covered by
`delete_workspace_scoped_rows` during account deletion.

## Not yet

`ai.business_agent_profiles` (legacy trends output, empty in development) is not used.
Best weekdays/hours and the ad set to reuse are derived in the Quick ad flow, not here.
Labels are English until the translation catalog exists.

Tests: `npm test -- src/lib/shared/agent src/lib/server/agent src/lib/server/businessAdFactsMigration.test.ts`.
