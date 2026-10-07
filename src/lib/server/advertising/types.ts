import { z } from 'zod';
import type { ProposedAction } from '../decisions/policy/types';

const id = z.string().regex(/^\d+$/);
const budget = z.string().regex(/^\d+$/).refine((s) => Number.isSafeInteger(Number(s)));
const delivery = z.object({
  id, account_id: id, status: z.string(), effective_status: z.string(),
  daily_budget: budget.optional(), lifetime_budget: budget.optional(), updated_time: z.string(),
});
export const metaStateSchema = z.object({
  adset: delivery.extend({ campaign_id: id, is_budget_schedule_enabled: z.boolean() }),
  campaign: delivery,
  account: z.object({ id: z.string().regex(/^act_\d+$/), account_id: id, account_status: z.number().int(), currency: z.string().regex(/^[A-Z]{3}$/), timezone_name: z.string().min(1) }),
});
export type AdvertisingState = z.infer<typeof metaStateSchema>;
export interface BudgetCapability {
  owner: 'adset' | 'campaign'; ownerId: string; period: 'daily' | 'lifetime'; amountMinor: number;
}
export interface AdvertisingPlatformAdapter {
  read(): Promise<AdvertisingState>;
  resolveBudget(state: AdvertisingState): BudgetCapability;
  apply(action: ProposedAction, before: AdvertisingState): Promise<void>;
  readAccountBudget?(): Promise<AccountBudgetState>;
}

export interface AccountBudgetState {
  accountId: string;
  totalDailyBudgetMinor: number;
  campaigns: AdvertisingState['campaign'][];
  adsets: AdvertisingState['adset'][];
}

export class AdvertisingError extends Error {
  constructor(public readonly code: string, public readonly metadata: Record<string, string | number | boolean> = {}) {
    super(code); this.name = 'AdvertisingError';
  }
}

export function resolveBudget(state: AdvertisingState): BudgetCapability {
  const candidates: BudgetCapability[] = [];
  for (const owner of ['campaign', 'adset'] as const) {
    for (const period of ['daily', 'lifetime'] as const) {
      const amountMinor = Number(state[owner][`${period}_budget`] ?? 0);
      if (amountMinor > 0) candidates.push({ owner, ownerId: state[owner].id, period, amountMinor });
    }
  }
  if (candidates.length !== 1) throw new AdvertisingError('AMBIGUOUS_BUDGET_OWNER');
  if (state.adset.is_budget_schedule_enabled) throw new AdvertisingError('SCHEDULED_BUDGET_UNSUPPORTED');
  return candidates[0];
}
