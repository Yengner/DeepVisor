-- Deleting a user cascades to their saved Insights popups (insight_presentations.user_id ON DELETE
-- CASCADE), but each popup's review receipt still pointed at it with NO ACTION, so the delete
-- failed with insight_receipts_presentation_id_fkey (23503). A receipt is only "this popup was
-- reviewed", so it goes with its popup, like insight_history_views already does.
begin;

alter table public.insight_receipts drop constraint if exists insight_receipts_presentation_id_fkey;
alter table public.insight_receipts add constraint insight_receipts_presentation_id_fkey
  foreign key (presentation_id) references public.insight_presentations(id) on delete cascade;

commit;
