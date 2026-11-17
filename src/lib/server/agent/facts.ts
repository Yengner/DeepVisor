import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { allPages } from '@/lib/server/repositories/pagination';
import {
  budgetMinor,
  factsToAsk,
  historyFacts,
  isFactKey,
  parseFact,
  resolveFacts,
  type FactKey,
  type FactValue,
  type ResolvedFacts,
  type StoredFact,
} from '@/lib/shared/agent/facts';

/**
 * Persistence and loading for business advertising facts (public.business_ad_facts).
 * Callers pass an already-authorized business id (and ad account id for history); every query
 * filters by it. The admin client is used because members can only read and writes are
 * owner/admin-only, which the calling action enforces.
 */
type Client = SupabaseClient<Database>;

export class AdFactError extends Error {
  constructor(readonly code: 'INVALID_FACT' | 'ACCOUNT_NOT_FOUND') { super(code); }
}

export async function listStoredFacts(client: Client, businessId: string): Promise<StoredFact[]> {
  const { data, error } = await client.from('business_ad_facts')
    .select('fact_key, value, confirmed_at')
    .eq('business_id', businessId);
  if (error) throw error;
  return (data ?? []).flatMap(row => isFactKey(row.fact_key) ? [{ key: row.fact_key, value: row.value, confirmedAt: row.confirmed_at }] : []);
}

/** Validates and saves one owner answer; the confirmation time is the server's clock. */
export async function saveFact<K extends FactKey>(client: Client, input: { businessId: string; userId: string; key: K; value: unknown }): Promise<FactValue<K>> {
  const value = parseFact(input.key, input.value);
  if (!value) throw new AdFactError('INVALID_FACT');
  const { error } = await client.from('business_ad_facts').upsert({
    business_id: input.businessId,
    fact_key: input.key,
    value: value as Database['public']['Tables']['business_ad_facts']['Insert']['value'],
    confirmed_at: new Date().toISOString(),
    confirmed_by: input.userId,
  }, { onConflict: 'business_id,fact_key' });
  if (error) throw error;
  return value;
}

export async function clearFact(client: Client, input: { businessId: string; key: FactKey }): Promise<void> {
  const { error } = await client.from('business_ad_facts').delete().eq('business_id', input.businessId).eq('fact_key', input.key);
  if (error) throw error;
}

export type AdFactsView = {
  accountCurrency: string | null;
  facts: ResolvedFacts;
  toAsk: FactKey[];
};

/**
 * Owner answers plus what the selected ad account's saved ad sets show. A missing account
 * (none selected) still returns owner answers, with no history.
 */
export async function loadAdFacts(client: Client, input: { businessId: string; adAccountId: string | null; now?: string }): Promise<AdFactsView> {
  const stored = await listStoredFacts(client, input.businessId);
  let accountCurrency: string | null = null;
  let history = {};
  if (input.adAccountId) {
    const { data: account, error: accountError } = await client.from('ad_accounts')
      .select('id, currency_code').eq('id', input.adAccountId).eq('business_id', input.businessId).maybeSingle();
    if (accountError) throw accountError;
    if (!account) throw new AdFactError('ACCOUNT_NOT_FOUND');
    accountCurrency = account.currency_code && /^[A-Z]{3}$/.test(account.currency_code) ? account.currency_code : null;
    const entities = await allPages((from, to) => client.from('ad_entities')
      .select('id, entity_level, external_id, parent_external_id, created_time, raw')
      .eq('business_id', input.businessId)
      .eq('ad_account_id', input.adAccountId!)
      .in('entity_level', ['campaign', 'adset'])
      .order('id')
      .range(from, to));
    const raw = (value: unknown) => (value && typeof value === 'object' ? value as Record<string, unknown> : {});
    const campaignBudget = new Map((entities ?? []).filter(e => e.entity_level === 'campaign')
      .map(e => [e.external_id, budgetMinor(raw(e.raw).daily_budget)]));
    const text = (value: unknown) => (typeof value === 'string' ? value : null);
    history = historyFacts((entities ?? []).filter(e => e.entity_level === 'adset').map(e => ({
      createdTime: e.created_time,
      startTime: text(raw(e.raw).start_time),
      endTime: text(raw(e.raw).end_time),
      dailyBudgetMinor: budgetMinor(raw(e.raw).daily_budget) ?? (e.parent_external_id ? campaignBudget.get(e.parent_external_id) ?? null : null),
    })), accountCurrency);
  }
  const facts = resolveFacts({ stored, history, accountCurrency, now: input.now ?? new Date().toISOString() });
  return { accountCurrency, facts, toAsk: factsToAsk(facts) };
}
