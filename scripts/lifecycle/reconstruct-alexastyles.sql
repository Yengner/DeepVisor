-- Explicitly requested historical reconstruction; never a claimed observed transition.
-- Existing development project only. Does not contact Meta or alter ad entities.
do $$
declare a public.ad_entities; account public.ad_accounts; sid uuid; entities jsonb;
begin
 select * into strict a from public.ad_entities where external_id='120229570219540408' and entity_level='campaign';
 select * into strict account from public.ad_accounts where id=a.ad_account_id;
 if account.name<>'DeepVisor Ad Account' or a.raw->>'status'<>'PAUSED' then raise exception 'Reconstruction source changed; review required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('lifecycle:'||a.ad_account_id::text,0));
 if exists(select 1 from public.ad_lifecycle_events where ad_account_id=a.ad_account_id and event_key='reconstruction:alexastyles:2026-11-08') then return; end if;
 select jsonb_agg(jsonb_build_object('id',e.external_id,'level',e.entity_level,'parent',e.parent_external_id,'campaign',coalesce(e.raw->>'campaign_id',p.raw->>'campaign_id'),'name',e.name,
 'configured',e.raw->>'status','effective',coalesce(e.raw->>'effective_status',e.raw->>'status'),'start',coalesce(e.raw->>'start_time',p.raw->>'start_time'),'end',coalesce(e.raw->>'end_time',p.raw->>'end_time'),
 'dailyBudget',null,'lifetimeBudget',null,'targeting','{}'::jsonb)) into entities
 from public.ad_entities e left join public.ad_entities p on p.id=e.parent_id and p.ad_account_id=e.ad_account_id where e.ad_account_id=a.ad_account_id;
 insert into public.ad_lifecycle_observations(business_id,ad_account_id,entities) values(a.business_id,a.ad_account_id,entities) returning id into sid;
 insert into public.ad_lifecycle_events(business_id,ad_account_id,after_id,event_key,kind,root_id,affected_ids,explanation,provenance)
 values(a.business_id,a.ad_account_id,sid,'reconstruction:alexastyles:2026-11-08','parent_paused',a.external_id,
 array(select external_id from public.ad_entities where ad_account_id=a.ad_account_id and campaign_id=a.id and entity_level='ad' and raw->>'effective_status'='CAMPAIGN_PAUSED'),
 'You reported interrupting this advertisement on November 8. Saved Meta state shows the campaign paused and this ad inheriting that pause, ahead of its November 10 scheduled end. The generic campaign update timestamp is November 8 UTC / November 7 New York time; the exact pause time is not established.','reconstructed');
end $$;
