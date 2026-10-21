-- Run via Supabase MCP execute_sql after seed. Every test insert is rolled back.
-- No Auth inserts, no provider calls, no executor calls, no committed audit data.
begin;
do $$ declare b record; begin
 for b in select id as business_id,
   case when id='f6f96cff-bde3-4627-a613-4f16bfdc1d7c' then '1afa9103-d8c3-467a-af4d-f80f9d5ef6ce'::uuid else 'd96187c7-cf1b-4485-a499-5f87bd68d3d9'::uuid end integration_id,
   case when id='f6f96cff-bde3-4627-a613-4f16bfdc1d7c' then '7e365a93-b133-4574-aa86-89deb51030bf'::uuid else '98de1118-7867-4d20-aea2-1f1a92df6630'::uuid end account_id
 from public.business_profiles where id in ('f6f96cff-bde3-4627-a613-4f16bfdc1d7c','ff73ea93-7aaa-4d62-afc4-b98fe206f657') loop
  insert into ai.feature_snapshots(id,business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,feature_json)
   values(b.business_id,b.business_id,b.integration_id,b.account_id,'adset','synthetic-rls-rollback-only',1,'{"synthetic":true}');
  insert into ai.decision_runs(id,business_id,feature_snapshot_id,provider)
   values(b.business_id,b.business_id,b.business_id,'synthetic-rls-rollback-only');
  insert into ai.action_proposals(id,business_id,decision_run_id,action_type,target_entity_type,target_entity_id)
   values(b.business_id,b.business_id,b.business_id,'REVIEW_CREATIVE','adset','synthetic-rls-rollback-only');
  insert into ai.executed_actions(id,business_id,action_proposal_id,request_metadata_json)
   values(b.business_id,b.business_id,b.business_id,'{"synthetic":true,"neverExecuted":true}');
  insert into ai.action_outcomes(business_id,executed_action_id,measurement_horizon_hours,metrics_before_json,metrics_after_json,calculated_change_json)
   values(b.business_id,b.business_id,24,'{}','{}','{}');
  insert into ai.autonomy_policies(business_id) values(b.business_id);
  insert into intelligence.ad_account_signals(id,business_id,platform_integration_id,ad_account_id,source_digest_hash,signal_type,severity,title,reason)
   values(b.business_id,b.business_id,b.integration_id,b.account_id,'synthetic-rls-rollback-only','efficiency_deterioration','info','Synthetic RLS test','Rolled back');
 end loop;
end $$;
set local role authenticated;
do $$ declare b record; t text; n integer; begin
 for b in select * from (values
  ('5efb0bcd-3ac9-4d42-ad28-00bad6a42610','f6f96cff-bde3-4627-a613-4f16bfdc1d7c'),
  ('cfd21931-3866-4c60-a458-7ace7279388a','ff73ea93-7aaa-4d62-afc4-b98fe206f657')) x(user_id,business_id) loop
  perform set_config('request.jwt.claim.sub',b.user_id,true);
  foreach t in array array['feature_snapshots','decision_runs','action_proposals','executed_actions','action_outcomes','autonomy_policies'] loop
   execute format('select count(*) from ai.%I',t) into n;
   if n<>1 then raise exception 'RLS visibility failure: %',t; end if;
   execute format('select count(*) from ai.%I where business_id<>$1::uuid',t) into n using b.business_id;
   if n<>0 then raise exception 'Cross-business AI leak: %',t; end if;
   if has_table_privilege('authenticated','ai.'||t,'insert') then raise exception 'Browser insert allowed: %',t; end if;
  end loop;
  select count(*) into n from intelligence.ad_account_signals;
  if n<>1 then raise exception 'Signals RLS visibility failure'; end if;
  select count(*) into n from intelligence.ad_account_signals where business_id<>b.business_id::uuid;
  if n<>0 then raise exception 'Cross-business signals leak'; end if;
 end loop;
end $$;
reset role;
rollback;
select 'passed; all synthetic AI/signals rows rolled back' as beta_fixture_rls;
