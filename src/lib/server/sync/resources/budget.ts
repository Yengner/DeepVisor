import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RepositoryClient } from '@/lib/server/repositories/utils';

export class ResourceDeferred extends Error {
  constructor(readonly reason: string, readonly retrySeconds = 60) { super(reason); this.name = 'ResourceDeferred'; }
}
type ReadContext = { db: RepositoryClient; accountId: string; signal: AbortSignal; requests: number; maxRequests: number };
const context = new AsyncLocalStorage<ReadContext>();
export function withResourceBudget<T>(db: RepositoryClient, accountId: string, operation: () => Promise<T>, options = {timeoutMs:180_000,maxRequests:200}) {
  return context.run({ db, accountId, signal: AbortSignal.timeout(options.timeoutMs), requests: 0, maxRequests:options.maxRequests }, operation);
}
export function resourceSignal() { return context.getStore()?.signal; }
export function usagePercent(value: string | null): number | null {
  if (!value) return null;
  try {
    const percentages: number[] = [];
    const walk = (v: unknown) => {
      if (!v || typeof v !== 'object') return;
      for (const [key, item] of Object.entries(v)) {
        if (['call_count', 'total_cputime', 'total_time', 'acc_id_util_pct'].includes(key) && typeof item === 'number' && Number.isFinite(item)) percentages.push(item);
        else if (typeof item === 'object') walk(item);
      }
    };
    walk(JSON.parse(value));
    return percentages.length ? Math.max(...percentages) : null;
  } catch { return null; }
}
export function retrySeconds(value: string | null, now = Date.now()) {
  if (!value) return 60;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.min(86400, Math.ceil(seconds))) : 60;
}
/** One shared admission per HTTP request, including pages/retries; no raw headers or tokens stored. */
export async function budgetedRead(operation: (signal?: AbortSignal) => Promise<Response>) {
  const state = context.getStore();
  if (!state) return operation();
  state.signal.throwIfAborted();
  if (++state.requests > state.maxRequests) throw new ResourceDeferred('request_budget', 300);
  const admission = await state.db.rpc('admit_meta_read', { p_account: state.accountId });
  if (admission.error) throw new ResourceDeferred('budget_unavailable');
  if (!admission.data) throw new ResourceDeferred('provider_cooldown', 300);
  let response: Response | undefined;
  try { response = await operation(state.signal); return response; }
  finally {
    const result = await state.db.rpc('finish_meta_read', {
      p_lease: admission.data, p_account: state.accountId,
      p_app_usage: usagePercent(response?.headers.get('x-app-usage') ?? null) ?? undefined,
      p_account_usage: usagePercent(response?.headers.get('x-business-use-case-usage') ?? response?.headers.get('x-ad-account-usage') ?? null) ?? undefined,
      p_retry_seconds: response?.status === 429 ? retrySeconds(response.headers.get('retry-after')) : 0,
    });
    if (result.error) throw new ResourceDeferred('budget_unavailable');
  }
}
