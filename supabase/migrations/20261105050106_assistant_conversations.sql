-- Application-owned private chat state and durable inference budgets. No Meta execution.
create table public.assistant_conversations (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 ad_account_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 state jsonb not null default '{"messages":[],"plan":null,"creatives":[],"revision":0,"savedDraftId":null}'::jsonb,
 revision integer not null default 0,
 generation uuid not null default gen_random_uuid(),
 lock_id uuid,
 locked_until timestamptz,
 updated_at timestamptz not null default now(),
 foreign key(business_id,ad_account_id) references public.ad_accounts(business_id,id) on delete cascade,
 unique(business_id,ad_account_id,user_id)
);
create table public.assistant_usage (
 id uuid primary key,
 business_id uuid not null references public.business_profiles(id) on delete cascade,
 conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
 generation uuid not null,
 created_at timestamptz not null default now(),
 reserved_tokens integer not null check(reserved_tokens>0),
 input_tokens integer not null default 0,
 output_tokens integer not null default 0,
 cached_tokens integer not null default 0,
 estimated_usd numeric,
 model text,
 status text not null default 'reserved' check(status in ('reserved','succeeded','failed'))
);
create index assistant_usage_budget on public.assistant_usage(business_id,created_at);
create index assistant_usage_conversation on public.assistant_usage(conversation_id,generation);
alter table public.assistant_conversations enable row level security;
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_conversations,public.assistant_usage from anon,authenticated;
grant select,insert,update,delete on public.assistant_conversations,public.assistant_usage to service_role;
-- Browser access uses authenticated server routes only. Even other business members cannot read private chats.
create function public.claim_assistant_turn(
 p_business uuid,p_account uuid,p_user uuid,p_revision integer,p_lock uuid,p_tokens integer,
 p_conversation_requests integer,p_conversation_tokens integer,p_business_requests integer,p_business_tokens integer,p_minute integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.assistant_conversations; requests bigint; tokens bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,0));
 insert into public.assistant_conversations(business_id,ad_account_id,user_id) values(p_business,p_account,p_user) on conflict do nothing;
 select * into c from public.assistant_conversations where business_id=p_business and ad_account_id=p_account and user_id=p_user for update;
 if c.revision<>p_revision then raise exception 'ASSISTANT_REVISION'; end if;
 if c.locked_until>now() then raise exception 'ASSISTANT_BUSY'; end if;
 if p_tokens>0 then
  select count(*),coalesce(sum(reserved_tokens),0) into requests,tokens from public.assistant_usage where conversation_id=c.id and generation=c.generation;
  if requests>=p_conversation_requests or tokens+p_tokens>p_conversation_tokens then raise exception 'ASSISTANT_CONVERSATION_LIMIT'; end if;
  select count(*),coalesce(sum(reserved_tokens),0) into requests,tokens from public.assistant_usage where business_id=p_business and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if requests>=p_business_requests or tokens+p_tokens>p_business_tokens then raise exception 'ASSISTANT_BUSINESS_LIMIT'; end if;
  select count(*) into requests from public.assistant_usage where business_id=p_business and created_at>now()-interval '1 minute';
  if requests>=p_minute then raise exception 'ASSISTANT_RATE_LIMIT'; end if;
  insert into public.assistant_usage(id,business_id,conversation_id,generation,reserved_tokens) values(p_lock,p_business,c.id,c.generation,p_tokens);
 end if;
 update public.assistant_conversations set lock_id=p_lock,locked_until=now()+interval '5 minutes' where id=c.id;
 return jsonb_build_object('id',c.id,'state',c.state,'revision',c.revision);
end $$;
revoke all on function public.claim_assistant_turn(uuid,uuid,uuid,integer,uuid,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_assistant_turn(uuid,uuid,uuid,integer,uuid,integer,integer,integer,integer,integer,integer) to service_role;

-- Private draft media; access goes through reauthorized server routes, never a public URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('assistant-draft-media','assistant-draft-media',false,4194304,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do nothing;
create policy assistant_media_server_only on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'assistant-draft-media') with check(bucket_id<>'assistant-draft-media');
