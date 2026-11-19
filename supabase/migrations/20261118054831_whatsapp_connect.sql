-- Stage 2b of the WhatsApp lead log: numbers connected in the app (Embedded Signup with the
-- WhatsApp Business app kept on the phone), and one lead per customer when WhatsApp delivers a
-- placeholder before the real first message from an ad.
begin;

alter table public.whatsapp_connections
  add column if not exists onboarded_via text not null default 'script',
  -- Vault secret id of the business token from Embedded Signup. Server-only; never sent to browsers.
  add column if not exists token_secret_id uuid,
  -- Meta requires the contact/history sync within 24 hours of onboarding a WhatsApp Business app number.
  add column if not exists sync_requested_at timestamptz,
  add column if not exists sync_error text;

do $$ begin
  alter table public.whatsapp_connections add constraint whatsapp_connections_onboarded_via_check
    check (onboarded_via in ('script', 'embedded_signup'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.whatsapp_connections add constraint whatsapp_connections_sync_error_check
    check (char_length(sync_error) <= 200);
exception when duplicate_object then null; end $$;
create index if not exists whatsapp_connections_waba_idx on public.whatsapp_connections (waba_id) where status = 'active';

-- Browsers can read their business's connection, but not the token reference or sync errors.
revoke select on public.whatsapp_connections from authenticated;
grant select (id, business_id, phone_number_id, waba_id, display_phone, is_test, status, connected_at, disconnected_at, onboarded_via, sync_requested_at)
  on public.whatsapp_connections to authenticated;

/**
 * Same contract as before, plus: a customer message that names an ad, arriving within 10 minutes
 * of an open lead that started without one, upgrades that lead to the ad instead of opening a
 * second lead. WhatsApp sends an "unsupported" placeholder (error 131060) for a first message
 * from an ad to a WhatsApp Business app number, then delivers the real message seconds later.
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
    if v_lead.id is not null and p_ad_external_id is not null and v_lead.source = 'organic'
       and v_lead.first_message_at >= p_at - interval '10 minutes' then
      update public.leads set
        source = 'ad', ad_external_id = p_ad_external_id, ctwa_clid = coalesce(left(p_ctwa_clid, 512), ctwa_clid),
        messages_in = messages_in + 1,
        first_message_at = least(first_message_at, p_at),
        last_message_at = greatest(last_message_at, p_at),
        contact_name = coalesce(nullif(left(p_contact_name, 80), ''), contact_name)
      where id = v_lead.id returning * into v_lead;
    elsif v_lead.id is null or (p_ad_external_id is not null and v_lead.ad_external_id is distinct from p_ad_external_id) then
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
