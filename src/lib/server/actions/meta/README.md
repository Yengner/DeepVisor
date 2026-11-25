# Meta server actions and compatibility types

This directory contains existing [page reads](pages/actions.ts),
[WhatsApp number lookup](whatsapp/actions.ts) (kept; no current caller), and
[form and Meta payload types](types.ts). Actions reuse authenticated business
context and the existing integration/Vault token resolver. Do not expose tokens
through browser inputs or DTOs. Creative reads use
[`api/campaigns/creative-library`](../../../../app/api/campaigns/creative-library/route.ts).

Current draft creation/reuse lives under [`server/campaigns`](../../campaigns), with
UI under [`components/campaigns/create`](../../../../components/campaigns/create).
The ad set and ad builders are hidden: `useCampaignSubmit` posts to
`/api/meta/create-campaign`, which does not exist. See
[`productAvailability.ts`](../../../shared/productAvailability.ts).

Authorized advertising changes belong to
[`server/advertising`](../../advertising/README.md). Draft persistence, Meta reads
and user approval do not authorize execution. See the
[workflow map](../../../../../docs/FLOWS.md) before adding a new integration path.
