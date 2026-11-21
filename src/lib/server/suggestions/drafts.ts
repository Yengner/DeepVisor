import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import type { AssistantAccess } from '@/lib/server/intelligence/assistant/access';
import type { SuggestionMedia } from '@/lib/shared/suggestions/idle';
import { adSetMedia } from './idle';

/**
 * What the owner has saved in DeepVisor for the selected ad account: run-again plans
 * (`ad_set_plans`, one per ad set) and new-ad drafts (`campaign_drafts` still in draft). Nothing
 * here is sent to Meta.
 */
export type DraftPlan = {
  id: string; adSetId: string; name: string; currency: string; dailyBudget: number; days: number;
  startDay: string; endDay: string; updatedAt: string; media: SuggestionMedia | null;
};
export type DraftAd = { id: string; title: string | null; updatedAt: string };

const LIMIT = 50;

/** How many drafts the account has, read with the person's own session (RLS); 0 when unreadable. */
export async function countDrafts(supabase: SupabaseClient<Database>, input: { businessId: string; adAccountId: string }): Promise<number> {
  const [plans, drafts] = await Promise.all([
    supabase.from('ad_set_plans').select('id', { count: 'exact', head: true }).eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId),
    supabase.from('campaign_drafts').select('id', { count: 'exact', head: true }).eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId).eq('status', 'draft'),
  ]);
  if (plans.error || drafts.error) {
    console.error('Draft count unavailable', { code: plans.error?.code ?? drafts.error?.code });
    return 0;
  }
  return (plans.count ?? 0) + (drafts.count ?? 0);
}

/** Every draft for the Drafts page, newest first, with each plan's ad picture when it can be found. */
export async function loadDrafts(scope: Pick<AssistantAccess, 'db' | 'businessId' | 'account'>): Promise<{ plans: DraftPlan[]; drafts: DraftAd[] }> {
  const [plans, drafts] = await Promise.all([
    scope.db.from('ad_set_plans').select('id, adset_external_id, adset_name, currency_code, daily_budget, days, start_day, end_day, updated_at')
      .eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).order('updated_at', { ascending: false }).limit(LIMIT),
    scope.db.from('campaign_drafts').select('id, title, updated_at')
      .eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('status', 'draft').order('updated_at', { ascending: false }).limit(LIMIT),
  ]);
  if (plans.error) throw plans.error;
  if (drafts.error) throw drafts.error;
  // A missing picture never hides a plan; the card shows a placeholder.
  const media = await Promise.all((plans.data ?? []).map(p =>
    adSetMedia(scope.db, { businessId: scope.businessId, accountId: scope.account.id }, p.adset_external_id).catch(() => null)));
  return {
    plans: (plans.data ?? []).map((p, i) => ({
      id: p.id, adSetId: p.adset_external_id, name: p.adset_name ?? p.adset_external_id, currency: p.currency_code,
      dailyBudget: Number(p.daily_budget), days: p.days, startDay: p.start_day, endDay: p.end_day, updatedAt: p.updated_at, media: media[i],
    })),
    drafts: (drafts.data ?? []).map(d => ({ id: d.id, title: d.title, updatedAt: d.updated_at })),
  };
}
