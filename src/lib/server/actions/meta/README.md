# Meta server actions and compatibility types

This directory contains existing [page reads](pages/actions.ts),
[creative reads](creatives/actions.ts), [WhatsApp setup](whatsapp/actions.ts), and
[compatibility form/action types](types.ts). Actions reuse authenticated business
context and the existing integration/Vault token resolver. Do not expose tokens
through browser inputs or DTOs.

The former strategy/factory examples described files absent from this checkout.
They are not an implementation guide. Current draft creation/reuse lives under
[`server/campaigns`](../../campaigns), with UI under
[`components/campaigns/create`](../../../../components/campaigns/create).
The older `useCampaignSubmit` hook references `/api/meta/create-campaign`, for which
this checkout contains no route; that compatibility reference does not establish a
live publish capability.

Authorized advertising changes belong to
[`server/advertising`](../../advertising/README.md). Draft persistence, Meta reads
and user approval do not authorize execution. See the
[workflow map](../../../../../docs/FLOWS.md) before adding a new integration path.
