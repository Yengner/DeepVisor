-- campaign_drafts.source_action_id was created as uuid, but every writer stores a text tag
-- ('reuse:<key>:<fingerprint>', 'assistant:<conversation>:<revision>:<fingerprint>',
-- 'revive:<source>', 'meta_lead_helper'). Postgres rejected each insert, so "Run again",
-- "Prepare this ad again" and Quick ad could never save a draft. No foreign key or index
-- depends on the column; existing values (none in development) are kept as text.
alter table public.campaign_drafts
  alter column source_action_id type text using source_action_id::text;
