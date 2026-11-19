import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { allPages, readPagesByIds } from '@/lib/server/repositories/pagination';
import { replyMinutes, summarizeLeads, type AdNumbers, type LeadChannel, type LeadOutcome, type LeadSource, type LeadSummary } from '@/lib/shared/leads/summary';
import { dayIn, localMidnightUtc } from '@/lib/shared/time/zone';

/**
 * The lead log for one business and its selected ad account. Callers pass an authorized
 * business and an account already validated to belong to it; every query filters by both.
 */
type Client = SupabaseClient<Database>;
export const LEAD_PERIODS = [7, 30] as const;
export type LeadPeriod = (typeof LEAD_PERIODS)[number];
export const isLeadPeriod = (value: unknown): value is LeadPeriod => LEAD_PERIODS.includes(Number(value) as LeadPeriod);

export type LeadView = {
  id: string;
  channel: LeadChannel;
  source: LeadSource;
  name: string | null;
  last4: string | null;
  adExternalId: string | null;
  adName: string | null;
  firstMessageAt: string;
  replyMinutes: number | null;
  messagesIn: number;
  outcome: LeadOutcome | null;
};
export type LeadLog = {
  /** `syncFailed`: Meta's contact/history sync request failed after connecting (Meta offboards after 24 hours). */
  connection: { displayPhone: string | null; isTest: boolean; connectedAt: string; syncFailed: boolean } | null;
  period: LeadPeriod;
  periodStart: string;
  /** First day (account timezone) the numbers cover: the later of the period start and the connection day. */
  coveredFrom: string;
  leads: LeadView[];
  summary: LeadSummary;
  /** Ads with spend in the period, for tagging a phone call to an ad. */
  adChoices: Array<{ externalId: string; name: string | null }>;
};

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function loadLeadLog(client: Client, input: { businessId: string; adAccountId: string; timezone: string; period: LeadPeriod; now?: Date }): Promise<LeadLog> {
  const today = dayIn(input.timezone, input.now);
  const periodStart = addDays(today, -(input.period - 1));
  const since = localMidnightUtc(periodStart, input.timezone).toISOString();

  const [connectionRes, leadRows, perf] = await Promise.all([
    client.from('whatsapp_connections').select('display_phone, is_test, connected_at, sync_error')
      .eq('business_id', input.businessId).eq('status', 'active').order('connected_at').limit(1).maybeSingle(),
    allPages((from, to) => client.from('leads')
      .select('id, channel, source, contact_name, contact_last4, ad_external_id, first_message_at, first_reply_at, messages_in, outcome')
      .eq('business_id', input.businessId).gte('first_message_at', since)
      .order('first_message_at', { ascending: false }).order('id').range(from, to)),
    allPages((from, to) => client.from('ad_entity_performance_daily')
      .select('entity_id, day, spend, messages')
      .eq('ad_account_id', input.adAccountId).eq('entity_level', 'ad').gte('day', periodStart).lte('day', today)
      .order('entity_id').order('day').range(from, to)),
  ]);
  if (connectionRes.error) throw connectionRes.error;
  const connection = connectionRes.data;
  const connectedDay = connection ? dayIn(input.timezone, new Date(connection.connected_at)) : null;
  const coveredFrom = connectedDay && connectedDay > periodStart ? connectedDay : periodStart;

  // Ad names and external ids for both the leads' ads and the ads with Meta numbers.
  const leadAdIds = [...new Set(leadRows.map(l => l.ad_external_id).filter((id): id is string => !!id))];
  const perfEntityIds = [...new Set(perf.map(p => p.entity_id))];
  const [byExternal, byId] = await Promise.all([
    readPagesByIds(leadAdIds, (ids, from, to) => client.from('ad_entities').select('id, external_id, name')
      .eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId).eq('entity_level', 'ad')
      .in('external_id', ids).order('id').range(from, to)),
    readPagesByIds(perfEntityIds, (ids, from, to) => client.from('ad_entities').select('id, external_id, name')
      .eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId).eq('entity_level', 'ad')
      .in('id', ids).order('id').range(from, to)),
  ]);
  const entities = new Map([...byExternal, ...byId].map(e => [e.id, e]));
  const names = new Map([...entities.values()].map(e => [e.external_id, e.name]));

  const totals = new Map<string, AdNumbers>();
  const spendInPeriod = new Map<string, number>();
  for (const row of perf) {
    const entity = entities.get(row.entity_id);
    if (!entity) continue;
    spendInPeriod.set(entity.external_id, (spendInPeriod.get(entity.external_id) ?? 0) + Number(row.spend ?? 0));
    if (row.day < coveredFrom) continue;
    const t = totals.get(entity.external_id) ?? { externalId: entity.external_id, name: entity.name, spend: 0, metaConversations: 0 };
    t.spend += Number(row.spend ?? 0);
    t.metaConversations += Number(row.messages ?? 0);
    totals.set(entity.external_id, t);
  }

  const leads: LeadView[] = leadRows.map(l => ({
    id: l.id,
    channel: l.channel as LeadChannel,
    source: l.source as LeadSource,
    name: l.contact_name,
    last4: l.contact_last4,
    adExternalId: l.ad_external_id,
    adName: l.ad_external_id ? names.get(l.ad_external_id) ?? null : null,
    firstMessageAt: l.first_message_at,
    replyMinutes: replyMinutes({ firstMessageAt: l.first_message_at, firstReplyAt: l.first_reply_at }),
    messagesIn: l.messages_in,
    outcome: l.outcome as LeadOutcome | null,
  }));
  const covered = localMidnightUtc(coveredFrom, input.timezone).toISOString();
  const summary = summarizeLeads(
    leadRows.filter(l => l.first_message_at >= covered).map(l => ({
      channel: l.channel as LeadChannel, source: l.source as LeadSource, adExternalId: l.ad_external_id,
      outcome: l.outcome as LeadOutcome | null, firstMessageAt: l.first_message_at, firstReplyAt: l.first_reply_at,
    })),
    [...totals.values()],
  );
  const adChoices = [...spendInPeriod.entries()].filter(([, spend]) => spend > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 50).map(([externalId]) => ({ externalId, name: names.get(externalId) ?? null }));

  return {
    connection: connection ? { displayPhone: connection.display_phone, isTest: connection.is_test, connectedAt: connection.connected_at, syncFailed: connection.sync_error !== null } : null,
    period: input.period,
    periodStart,
    coveredFrom,
    leads,
    summary,
    adChoices,
  };
}

export class LeadError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'INVALID') { super(code); }
}

/** Owner/admin answer for one lead; `null` clears it back to "not marked". */
export async function setLeadOutcome(client: Client, input: { businessId: string; leadId: string; outcome: LeadOutcome | null; userId: string }) {
  const { data, error } = await client.from('leads')
    .update({ outcome: input.outcome, outcome_at: input.outcome ? new Date().toISOString() : null, outcome_by: input.outcome ? input.userId : null })
    .eq('id', input.leadId).eq('business_id', input.businessId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new LeadError('NOT_FOUND');
}

/** A phone call the owner adds by hand, optionally tagged to one of the selected account's ads. */
export async function addCallLead(client: Client, input: { businessId: string; adAccountId: string; adExternalId: string | null; outcome: LeadOutcome | null; userId: string; now?: Date }) {
  if (input.adExternalId !== null) {
    if (!/^\d{1,30}$/.test(input.adExternalId)) throw new LeadError('INVALID');
    const { data, error } = await client.from('ad_entities').select('id')
      .eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId).eq('entity_level', 'ad')
      .eq('external_id', input.adExternalId).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new LeadError('INVALID');
  }
  const at = (input.now ?? new Date()).toISOString();
  const { error } = await client.from('leads').insert({
    business_id: input.businessId, channel: 'call', source: input.adExternalId ? 'ad' : 'manual',
    ad_external_id: input.adExternalId, first_message_at: at, last_message_at: at,
    outcome: input.outcome, outcome_at: input.outcome ? at : null, outcome_by: input.outcome ? input.userId : null,
  });
  if (error) throw error;
}
