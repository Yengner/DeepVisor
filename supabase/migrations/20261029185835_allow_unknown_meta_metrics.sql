-- Preserve source unavailability rather than fabricating zero observations.
-- Existing observations, authorization, indexes and RLS are unchanged.
alter table public.ad_entity_performance_daily alter column reach drop not null, alter column reach drop default;
alter table public.ad_entity_performance_summary alter column reach drop not null, alter column reach drop default;
alter table public.ad_entity_performance_hourly
  alter column reach drop not null, alter column reach drop default,
  alter column ctr drop not null, alter column ctr drop default,
  alter column cpc drop not null, alter column cpc drop default,
  alter column cpm drop not null, alter column cpm drop default;
alter table public.ad_audience_breakdowns_summary
  alter column reach drop not null, alter column reach drop default,
  alter column leads drop not null, alter column leads drop default,
  alter column messages drop not null, alter column messages drop default,
  alter column calls drop not null, alter column calls drop default;
