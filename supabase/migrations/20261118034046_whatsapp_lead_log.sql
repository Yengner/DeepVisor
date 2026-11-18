-- WhatsApp lead log: one row per customer conversation, linked to the ad that started it.
-- Minimal customer data: WhatsApp profile name, the last 4 digits and a keyed hash of the
-- number (to recognize the same customer). No message text is stored.
begin;

-- A WhatsApp Business number connected to one business. Created by Embedded Signup later;
-- test numbers are added by scripts/whatsapp/connect-number.mjs.
create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{1,30}$'),
  waba_id text check (waba_id ~ '^[0-9]{1,30}$'),
  display_phone text check (char_length(display_phone) <= 40),
  is_test boolean not null default false,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  check ((status = 'disconnected') = (disconnected_at is not null))
);
create index if not exists whatsapp_connections_business_idx on public.whatsapp_connections (business_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  connection_id uuid references public.whatsapp_connections(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'call')),
  -- 'ad': Meta's referral named the ad. 'organic': a message with no ad referral. 'manual': added by the owner.
  source text not null check (source in ('ad', 'organic', 'manual')),
  contact_key text check (contact_key ~ '^[0-9a-f]{64}$'),
  contact_name text check (char_length(contact_name) <= 80),
  contact_last4 text check (contact_last4 ~ '^[0-9]{1,4}$'),
  ad_external_id text check (ad_external_id ~ '^[0-9]{1,30}$'),
  ctwa_clid text check (char_length(ctwa_clid) <= 512),
  first_message_at timestamptz not null,
  last_message_at timestamptz not null,
  first_reply_at timestamptz,
  messages_in integer not null default 0 check (messages_in >= 0),
  messages_out integer not null default 0 check (messages_out >= 0),
  -- Owner's answer. Null means not marked yet, which is never counted as "didn't book".
  outcome text check (outcome in ('booked', 'not_booked', 'spam')),
  outcome_at timestamptz,
  outcome_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (last_message_at >= first_message_at),
  check (first_reply_at is null or first_reply_at >= first_message_at),
  check ((source = 'ad') = (ad_external_id is not null)),
  check ((channel = 'whatsapp') = (contact_key is not null)),
  check ((outcome is null) = (outcome_at is null))
);
create index if not exists leads_business_time_idx on public.leads (business_id, first_message_at desc);
create index if not exists leads_contact_idx on public.leads (business_id, contact_key, last_message_at desc) where contact_key is not null;

-- Message ids already counted, so Meta's retries never double count. Ids only, never content.
create table if not exists public.whatsapp_message_receipts (
  message_key text primary key check (message_key ~ '^[0-9a-f]{64}$'),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  received_at timestamptz not null default now()
);
create index if not exists whatsapp_message_receipts_received_idx on public.whatsapp_message_receipts (received_at);

alter table public.whatsapp_connections enable row level security;
alter table public.leads enable row level security;
alter table public.whatsapp_message_receipts enable row level security;

drop policy if exists whatsapp_connections_read on public.whatsapp_connections;
create policy whatsapp_connections_read on public.whatsapp_connections
  for select to authenticated using (public.can_access_business(business_id));
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads
  for select to authenticated using (public.can_access_business(business_id));

revoke all on public.whatsapp_connections, public.leads, public.whatsapp_message_receipts from public, anon, authenticated;
grant select on public.whatsapp_connections, public.leads to authenticated;
grant all on public.whatsapp_connections, public.leads, public.whatsapp_message_receipts to service_role;

comment on table public.leads is
  'Customer conversations per business. Written by the WhatsApp webhook (record_whatsapp_message) and by the server after owner/admin checks.';

/**
 * Records one WhatsApp message (customer -> business 'in', or the business's reply 'out').
 * Returns {status: unknown_number | duplicate | ignored | recorded, lead_id, created}.
 * A customer message starts a new lead when there is no conversation in the last 30 days or
 * when it comes from a different ad; otherwise it joins the open one. A business message only
 * updates an existing lead (conversations the business starts are not leads).
 */
create or replace function public.record_whatsapp_message(
  p_phone_number_id text, p_message_key text, p_direction text, p_contact_key text,
  p_contact_name text, p_contact_last4 text, p_at timestamptz, p_ad_external_id text, p_ctwa_clid text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_connection public.whatsapp_connections;
  v_lead public.leads;
  v_created boolean := false;
begin
  if p_direction not in ('in', 'out') or p_message_key is null or p_contact_key is null or p_at is null then
    raise exception 'invalid whatsapp message' using errcode = '22023';
  end if;
  select * into v_connection from public.whatsapp_connections
    where phone_number_id = p_phone_number_id and status = 'active';
  if not found then
    return jsonb_build_object('status', 'unknown_number');
  end if;

  insert into public.whatsapp_message_receipts (message_key, business_id)
    values (p_message_key, v_connection.business_id) on conflict (message_key) do nothing;
  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- One writer per customer at a time, so simultaneous messages never open two leads.
  perform pg_advisory_xact_lock(hashtextextended(v_connection.business_id::text || ':' || p_contact_key, 0));

  select * into v_lead from public.leads
    where business_id = v_connection.business_id and contact_key = p_contact_key and channel = 'whatsapp'
      and last_message_at >= p_at - interval '30 days' and first_message_at <= p_at + interval '1 day'
    order by first_message_at desc limit 1;

  if p_direction = 'in' then
    if v_lead.id is null or (p_ad_external_id is not null and v_lead.ad_external_id is distinct from p_ad_external_id) then
      insert into public.leads (business_id, connection_id, channel, source, contact_key, contact_name, contact_last4,
        ad_external_id, ctwa_clid, first_message_at, last_message_at, messages_in)
      values (v_connection.business_id, v_connection.id, 'whatsapp', case when p_ad_external_id is null then 'organic' else 'ad' end,
        p_contact_key, nullif(left(p_contact_name, 80), ''), p_contact_last4, p_ad_external_id, left(p_ctwa_clid, 512), p_at, p_at, 1)
      returning * into v_lead;
      v_created := true;
    else
      update public.leads set
        messages_in = messages_in + 1,
        first_message_at = least(first_message_at, p_at),
        last_message_at = greatest(last_message_at, p_at),
        contact_name = coalesce(nullif(left(p_contact_name, 80), ''), contact_name),
        ctwa_clid = coalesce(ctwa_clid, left(p_ctwa_clid, 512))
      where id = v_lead.id returning * into v_lead;
    end if;
  else
    if v_lead.id is null then
      return jsonb_build_object('status', 'ignored');
    end if;
    update public.leads set
      messages_out = messages_out + 1,
      last_message_at = greatest(last_message_at, p_at),
      first_reply_at = case when p_at < first_message_at then first_reply_at
                            else least(coalesce(first_reply_at, p_at), p_at) end
    where id = v_lead.id returning * into v_lead;
  end if;

  update public.whatsapp_message_receipts set lead_id = v_lead.id where message_key = p_message_key;
  -- Retries arrive within days; old receipts are pruned here (bounded), so no schedule is needed.
  delete from public.whatsapp_message_receipts where message_key in (
    select message_key from public.whatsapp_message_receipts where received_at < now() - interval '60 days' limit 500);
  return jsonb_build_object('status', 'recorded', 'lead_id', v_lead.id, 'created', v_created);
end $$;

revoke all on function public.record_whatsapp_message(text, text, text, text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.record_whatsapp_message(text, text, text, text, text, text, timestamptz, text, text) to service_role;

commit;
