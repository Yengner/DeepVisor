-- Development project gkdyyjqepzayjdpvqnja only. Removes this phase's isolated
-- fixture account and audit chain; preserves Auth, the original accounts and policy.
begin;
do $$ begin
 if exists(select 1 from public.ad_accounts where id='eeee4445-0000-4000-8000-000000000001'
   and (business_id<>'f6f96cff-bde3-4627-a613-4f16bfdc1d7c' or name<>'[SYNTHETIC PHASE 4] Intelligence fixture')) then
  raise exception 'Fixture scope mismatch';
 end if;
end $$;
create temporary table agency_runs on commit drop as
 select r.id from ai.decision_runs r join ai.feature_snapshots s on s.id=r.feature_snapshot_id
 where s.ad_account_id='eeee4445-0000-4000-8000-000000000001' and r.business_id='f6f96cff-bde3-4627-a613-4f16bfdc1d7c';
create temporary table agency_proposals on commit drop as select id from ai.action_proposals where decision_run_id in(select id from agency_runs);
create temporary table agency_executions on commit drop as select id from ai.executed_actions where action_proposal_id in(select id from agency_proposals);
delete from ai.action_outcomes where executed_action_id in(select id from agency_executions) or shadow_decision_run_id in(select id from agency_runs);
delete from ai.review_execution_claims where execution_id in(select id from agency_executions);
delete from ai.executed_actions where id in(select id from agency_executions);
delete from ai.action_proposals where id in(select id from agency_proposals);
delete from ai.shadow_evaluation_jobs where ad_account_id='eeee4445-0000-4000-8000-000000000001';
delete from ai.decision_runs where id in(select id from agency_runs);
delete from ai.feature_snapshots where ad_account_id='eeee4445-0000-4000-8000-000000000001';
delete from public.ad_entity_performance_daily where ad_account_id='eeee4445-0000-4000-8000-000000000001';
delete from public.ad_entities where ad_account_id='eeee4445-0000-4000-8000-000000000001' and entity_level='adset';
delete from public.ad_entities where ad_account_id='eeee4445-0000-4000-8000-000000000001';
delete from public.ad_account_sync_state where ad_account_id='eeee4445-0000-4000-8000-000000000001';
delete from public.account_sync_jobs where ad_account_id='eeee4445-0000-4000-8000-000000000001';
delete from public.ad_accounts where id='eeee4445-0000-4000-8000-000000000001';
commit;
