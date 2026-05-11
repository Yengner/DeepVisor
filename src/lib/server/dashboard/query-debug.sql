-- Dashboard query debug helpers.
-- Run these manually in the Supabase SQL editor when dashboard timing logs identify
-- a slow report, audience, hourly, or context query.

-- 1) Verify existing indexes before adding any new migration.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname in ('public', 'ai')
  and tablename in (
    'organization_memberships',
    'business_profiles',
    'ad_entities',
    'ad_entity_performance_daily',
    'ad_entity_performance_summary',
    'ad_entity_performance_monthly',
    'ad_account_performance_monthly',
    'ad_entity_performance_hourly',
    'ad_audience_breakdowns_summary',
    'ad_account_intelligence_snapshots',
    'business_data_policies'
  )
order by schemaname, tablename, indexname;

-- 2) Report bounds query behind getAdAccountReportEntityDateBounds.
explain analyze
select day
from report_entity_daily_v
where ad_account_id = '<ad_account_id>'
  and entity_level = 'campaign'
  and (
    spend > 0
    or impressions > 0
    or clicks > 0
    or inline_link_clicks > 0
    or leads > 0
    or messages > 0
    or calls > 0
  )
order by day asc
limit 1;

-- 3) Featured ad set history start.
explain analyze
select day
from report_entity_daily_v
where entity_level = 'adset'
  and entity_id = '<adset_internal_id>'
  and (spend > 0 or impressions > 0)
order by day asc
limit 1;

-- 4) Featured hourly history.
explain analyze
select
  day,
  hour_of_day,
  spend,
  reach,
  impressions,
  clicks,
  inline_link_clicks,
  leads,
  messages,
  calls,
  ctr,
  cpc,
  cpm
from ad_entity_performance_hourly
where ad_account_id = '<ad_account_id>'
  and entity_id = '<adset_internal_id>'
  and entity_level in ('adset', 'ad')
order by day asc, hour_of_day asc;

-- 5) Audience rows for dashboard live/featured sections.
explain analyze
select
  entity_level,
  entity_id,
  breakdown_type,
  dimension_1_key,
  dimension_1_value,
  dimension_2_key,
  dimension_2_value,
  publisher_platform,
  platform_position,
  impression_device,
  spend,
  impressions,
  clicks,
  leads,
  messages,
  calls
from ad_audience_breakdowns_summary
where ad_account_id = '<ad_account_id>'
  and entity_id = any(array['<adset_internal_id>']::uuid[])
  and breakdown_type in (
    'publisher_platform',
    'platform_position',
    'impression_device',
    'age_gender',
    'country',
    'region',
    'dma'
  );
