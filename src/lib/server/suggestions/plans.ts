import 'server-only';
import type { AssistantAccess } from '@/lib/server/intelligence/assistant/access';
import type { RestartSource } from './rerun';

/**
 * Saved "run this ad again" plans (`ad_set_plans`): one per ad set, kept in DeepVisor only.
 * Saving again updates the same row, so a future approved Meta write can change that same ad set
 * instead of creating copies. Nothing here talks to Meta.
 */
export type SavedPlan = {
  id: string;
  adSetId: string;
  dailyBudget: number;
  days: number;
  startDay: string;
  endDay: string;
  version: number;
  updatedAt: string;
};

type Scope = Pick<AssistantAccess, 'db' | 'businessId' | 'account' | 'userId'>;

const COLUMNS = 'id, adset_external_id, daily_budget, days, start_day, end_day, version, updated_at';
type Row = { id: string; adset_external_id: string; daily_budget: number | string; days: number; start_day: string; end_day: string; version: number; updated_at: string };
const toPlan = (row: Row): SavedPlan => ({
  id: row.id, adSetId: row.adset_external_id, dailyBudget: Number(row.daily_budget), days: row.days,
  startDay: row.start_day, endDay: row.end_day, version: row.version, updatedAt: row.updated_at,
});

export class PlanConflictError extends Error {}

export async function getSavedPlan(scope: Pick<Scope, 'db' | 'businessId' | 'account'>, adSetId: string): Promise<SavedPlan | null> {
  const { data, error } = await scope.db.from('ad_set_plans').select(COLUMNS)
    .eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('adset_external_id', adSetId).maybeSingle();
  if (error) throw error;
  return data ? toPlan(data as Row) : null;
}

/**
 * Creates the ad set's plan or updates the one it has. `expectedVersion` (the version the owner
 * was editing) stops a stale page from overwriting a newer save; omit it for a first save.
 */
export async function savePlan(scope: Scope, input: {
  source: RestartSource; currency: string; dailyBudget: number; days: number; startDay: string; endDay: string; expectedVersion: number | null;
}): Promise<SavedPlan> {
  const existing = await getSavedPlan(scope, input.source.adSetId);
  const now = new Date().toISOString();
  const fields = {
    campaign_external_id: input.source.campaignId, adset_name: input.source.name, currency_code: input.currency,
    daily_budget: input.dailyBudget, days: input.days, start_day: input.startDay, end_day: input.endDay,
    updated_by_user_id: scope.userId, updated_at: now,
  };
  if (existing) {
    if (input.expectedVersion !== null && input.expectedVersion !== existing.version) throw new PlanConflictError('Plan changed elsewhere');
    const { data, error } = await scope.db.from('ad_set_plans').update({ ...fields, version: existing.version + 1 })
      .eq('id', existing.id).eq('version', existing.version).select(COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) throw new PlanConflictError('Plan changed elsewhere');
    return toPlan(data as Row);
  }
  const { data, error } = await scope.db.from('ad_set_plans').insert({
    ...fields, business_id: scope.businessId, ad_account_id: scope.account.id, adset_external_id: input.source.adSetId,
    created_by_user_id: scope.userId, created_at: now,
  }).select(COLUMNS).single();
  // Two saves at once: the unique (account, ad set) key lets only one create it.
  if (error?.code === '23505') throw new PlanConflictError('Plan created elsewhere');
  if (error) throw error;
  return toPlan(data as Row);
}

export async function deletePlan(scope: Pick<Scope, 'db' | 'businessId' | 'account'>, adSetId: string): Promise<boolean> {
  const { data, error } = await scope.db.from('ad_set_plans').delete()
    .eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('adset_external_id', adSetId).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
