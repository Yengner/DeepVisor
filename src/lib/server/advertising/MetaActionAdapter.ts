import 'server-only';
import { z } from 'zod';
import type { ProposedAction } from '../decisions/policy/types';
import { AdvertisingError, metaStateSchema, resolveBudget, type AdvertisingState, type AdvertisingPlatformAdapter, type AccountBudgetState } from './types';

const fields = 'id,account_id,status,effective_status,daily_budget,lifetime_budget,updated_time';

/** No generic mutation API, write retries, redirects, or credential-bearing URLs. */
export class MetaActionAdapter implements AdvertisingPlatformAdapter {
  readonly resolveBudget = resolveBudget;
  constructor(private readonly config: { accessToken: string; accountId: string; adsetId: string; liveEnabled: boolean }, private readonly transport: typeof fetch = fetch) {
    if (!/^\d+$/.test(config.adsetId) || !/^(act_)?\d+$/.test(config.accountId) || !config.accessToken) throw new AdvertisingError('INVALID_META_CONFIGURATION');
  }

  private async request(path: string, params: Record<string, string>, method: 'GET' | 'POST' = 'GET'): Promise<unknown> {
    if (!this.config.liveEnabled) throw new AdvertisingError('EXECUTION_DISABLED');
    const url = new URL(`https://graph.facebook.com/v24.0/${path}`);
    if (method === 'GET') url.search = new URLSearchParams(params).toString();
    try {
      const response = await this.transport(url, {
        method, headers: { Authorization: `Bearer ${this.config.accessToken}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: method === 'POST' ? new URLSearchParams(params).toString() : undefined,
        signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || body?.error) {
        // Meta messages can echo request data. Retain diagnostic codes, never arbitrary bodies.
        const metadata: Record<string, string | number | boolean> = { httpStatus: response.status };
        for (const key of ['code', 'error_subcode', 'is_transient', 'fbtrace_id', 'type']) {
          const value = body?.error?.[key];
          if (typeof value === 'number' || typeof value === 'boolean' || (typeof value === 'string' && /^[\w.-]{1,100}$/.test(value))) metadata[key] = value;
        }
        throw new AdvertisingError('META_API_ERROR', metadata);
      }
      return body;
    } catch (error) {
      if (error instanceof AdvertisingError) throw error;
      throw new AdvertisingError('META_TRANSPORT_OR_RESPONSE_ERROR');
    }
  }

  async read(): Promise<AdvertisingState> {
    const adset = metaStateSchema.shape.adset.safeParse(await this.request(this.config.adsetId, { fields: `${fields},campaign_id,is_budget_schedule_enabled` }));
    if (!adset.success) throw new AdvertisingError('MALFORMED_META_STATE');
    const accountId = this.config.accountId.replace(/^act_/, '');
    if (adset.data.id !== this.config.adsetId || adset.data.account_id !== accountId) throw new AdvertisingError('META_SCOPE_MISMATCH');
    const campaign = await this.request(adset.data.campaign_id, { fields });
    const account = await this.request(`act_${accountId}`, { fields: 'id,account_id,account_status,currency,timezone_name' });
    const state = metaStateSchema.safeParse({ adset: adset.data, campaign, account });
    if (!state.success) throw new AdvertisingError('MALFORMED_META_STATE');
    if (state.data.campaign.id !== adset.data.campaign_id || state.data.campaign.account_id !== accountId || state.data.account.account_id !== accountId || state.data.account.id !== `act_${accountId}`) throw new AdvertisingError('META_SCOPE_MISMATCH');
    return state.data;
  }

  async apply(action: ProposedAction, before: AdvertisingState): Promise<void> {
    if (before.adset.id !== this.config.adsetId || before.account.account_id !== this.config.accountId.replace(/^act_/, '')) throw new AdvertisingError('META_SCOPE_MISMATCH');
    if (before.account.account_status !== 1 || before.adset.status !== 'ACTIVE' || before.adset.effective_status !== 'ACTIVE' || before.campaign.status !== 'ACTIVE' || before.campaign.effective_status !== 'ACTIVE') throw new AdvertisingError('META_NOT_ACTIVE');
    let params: Record<string, string>;
    if (action.type === 'REDUCE_BUDGET') {
      const budget = resolveBudget(before);
      // Existing policies assess one ad set, not every sibling sharing a campaign budget.
      if (budget.owner !== 'adset') throw new AdvertisingError('SHARED_BUDGET');
      if (!Number.isSafeInteger(action.targetBudgetMinor) || action.targetBudgetMinor <= 0 || action.targetBudgetMinor >= budget.amountMinor) throw new AdvertisingError('NOT_A_BUDGET_REDUCTION');
      params = { [`${budget.period}_budget`]: String(action.targetBudgetMinor) };
    } else if (action.type === 'PAUSE_DELIVERY_UNIT') params = { status: 'PAUSED' };
    else throw new AdvertisingError('UNSUPPORTED_ACTION');
    const response = await this.request(this.config.adsetId, params, 'POST');
    if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true) throw new AdvertisingError('UNCONFIRMED_META_WRITE');
  }

  /** Full configured daily allocation, never a partial page or lifetime/daily mixture. */
  async readAccountBudget(): Promise<AccountBudgetState> {
    const accountId = this.config.accountId.replace(/^act_/, '');
    const list = async (edge: 'campaigns' | 'adsets') => {
      const rows: unknown[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const response = z.object({ data: z.array(z.unknown()), paging: z.object({
          next: z.string().optional(), cursors: z.object({ after: z.string().optional() }).optional(),
        }).optional() }).safeParse(await this.request(`act_${accountId}/${edge}`, {
          fields: edge === 'campaigns' ? fields : `${fields},campaign_id,is_budget_schedule_enabled`,
          limit: '100', ...(cursor ? { after: cursor } : {}),
        }));
        if (!response.success) throw new AdvertisingError('INCOMPLETE_ACCOUNT_BUDGET');
        rows.push(...response.data.data);
        if (!response.data.paging?.next) return rows;
        cursor = response.data.paging.cursors?.after;
        if (!cursor || cursors.has(cursor)) throw new AdvertisingError('INCOMPLETE_ACCOUNT_BUDGET');
        cursors.add(cursor);
      }
      throw new AdvertisingError('ACCOUNT_BUDGET_TOO_LARGE');
    };
    const campaigns = z.array(metaStateSchema.shape.campaign).parse(await list('campaigns')).sort((a,b)=>a.id.localeCompare(b.id));
    const adsets = z.array(metaStateSchema.shape.adset).parse(await list('adsets')).sort((a,b)=>a.id.localeCompare(b.id));
    for (const rows of [campaigns, adsets]) {
      if (new Set(rows.map(row=>row.id)).size !== rows.length || rows.some(row=>row.account_id !== accountId)) throw new AdvertisingError('ACCOUNT_BUDGET_SCOPE');
    }
    const campaignById = new Map(campaigns.map(row=>[row.id,row]));
    const inactive = ['PAUSED','ARCHIVED','DELETED'];
    let total = 0;
    for (const campaign of campaigns) {
      if (inactive.includes(campaign.status)) continue;
      if (campaign.status !== 'ACTIVE' || Number(campaign.lifetime_budget ?? 0) > 0) throw new AdvertisingError('UNSUPPORTED_ACCOUNT_BUDGET');
      total += Number(campaign.daily_budget ?? 0);
    }
    for (const adset of adsets) {
      const campaign = campaignById.get(adset.campaign_id);
      if (!campaign) throw new AdvertisingError('INCOMPLETE_ACCOUNT_BUDGET');
      if (inactive.includes(adset.status) || inactive.includes(campaign.status)) continue;
      if (adset.status !== 'ACTIVE' || adset.is_budget_schedule_enabled || Number(adset.lifetime_budget ?? 0) > 0) throw new AdvertisingError('UNSUPPORTED_ACCOUNT_BUDGET');
      const amount = Number(adset.daily_budget ?? 0);
      if (Number(campaign.daily_budget ?? 0) > 0) {
        if (amount > 0) throw new AdvertisingError('AMBIGUOUS_BUDGET_OWNER');
      } else {
        if (amount <= 0) throw new AdvertisingError('UNSUPPORTED_ACCOUNT_BUDGET');
        total += amount;
      }
    }
    if (!Number.isSafeInteger(total) || total <= 0) throw new AdvertisingError('INVALID_ACCOUNT_BUDGET');
    return { accountId, totalDailyBudgetMinor: total, campaigns, adsets };
  }
}
