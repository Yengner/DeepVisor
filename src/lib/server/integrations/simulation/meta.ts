import 'server-only';
import type { User } from '@supabase/supabase-js';

export const SIMULATION_TAG = 'deepvisor-meta-phase2';
const PREFIX = `${SIMULATION_TAG}:`;
const PROJECT = 'gkdyyjqepzayjdpvqnja';
export const SIMULATION_DAY = '2026-10-20';
export const scenarios = ['single', 'multiple', 'none', 'permissions', 'expired', 'connection_failure', 'rate_limit', 'timeout', 'partial'] as const;
export type Simulation = { businessId: string; scenario: typeof scenarios[number]; revision: number; anchorDay?: string };

export function assertSimulationEnabled(): void {
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
      process.env.DEEPVISOR_META_SIMULATION !== PROJECT ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${PROJECT}.supabase.co`) {
    throw new Error('Meta simulation is disabled');
  }
}

export function simulationForUser(user: User, businessId: string): Simulation | null {
  const designation = user.app_metadata?.[SIMULATION_TAG];
  if (!designation) return null;
  assertSimulationEnabled();
  if (!scenarios.includes(designation.scenario) || !Number.isInteger(designation.revision ?? 0)) {
    throw new Error('Invalid server-managed simulation designation');
  }
  return { businessId, scenario: designation.scenario, revision: designation.revision ?? 0, ...(designation.anchorDay ? { anchorDay: designation.anchorDay } : {}) };
}

export function simulationToken(simulation: Simulation): string {
  assertSimulationEnabled();
  return PREFIX + JSON.stringify(simulation);
}

export function readSimulation(token: string): Simulation | null {
  if (!token.startsWith(PREFIX)) return null;
  assertSimulationEnabled();
  const value = JSON.parse(token.slice(PREFIX.length));
  if (!/^[a-f0-9-]{36}$/.test(value.businessId) || !scenarios.includes(value.scenario) ||
      !Number.isInteger(value.revision) || value.revision < 0 || value.revision > 10) {
    throw new Error('Invalid simulation configuration');
  }
  if (value.anchorDay && (!/^2026-\d{2}-\d{2}$/.test(value.anchorDay) || new Date(`${value.anchorDay}T00:00:00Z`).toISOString().slice(0,10) !== value.anchorDay)) throw new Error('Invalid simulation clock');
  return value;
}

export function simulationAccounts(simulation: Simulation) {
  if (simulation.scenario === 'none') return [];
  return Array.from({ length: simulation.scenario === 'multiple' ? 2 : 1 }, (_, i) => ({
    externalAccountId: `act_dvsim_${simulation.businessId.replaceAll('-', '')}_${i + 1}`,
    name: `[SIMULATED] Salon account ${i + 1}`, status: 'active', currencyCode: 'USD', timezone: 'America/New_York',
  }));
}

function providerError(simulation: Simulation) {
  const messages: Partial<Record<Simulation['scenario'], string>> = {
    permissions: 'Missing ads_read permission', expired: 'Meta credentials expired; reconnect',
    connection_failure: 'Simulated Meta connection failed', rate_limit: 'Meta rate limit', timeout: 'Meta request timed out',
  };
  if (messages[simulation.scenario]) throw new Error(messages[simulation.scenario]);
}

export function validateSimulation(simulation: Simulation) { providerError(simulation); }

// The only simulated boundary is the provider response. Normalizers, writers, jobs and RLS remain real.
export function simulatedMetaResponse(token: string, path: string, params: Record<string, unknown> = {}): unknown | null {
  const simulation = readSimulation(token);
  if (!simulation) {
    if (path.includes('dvsim_')) throw new Error('Synthetic IDs cannot be sent to Meta');
    return null;
  }
  providerError(simulation);
  const account = simulationAccounts(simulation).find(a => path === a.externalAccountId || path.startsWith(`${a.externalAccountId}/`) || path.startsWith(`${a.externalAccountId}_`));
  if (!account) throw new Error('Simulated account is outside this business');
  const id = account.externalAccountId;
  const multiplier = id.endsWith('_2') ? 2 : 1;
  const campaign = `${id}_campaign`;
  const setIds = [1, 2].map(i => `${id}_set${i}`);
  const created_time = '2026-07-23T00:00:00Z';
  const status = (i: number) => i === 0 && simulation.revision < 2 ? 'ACTIVE' : 'PAUSED';
  const creatives = setIds.flatMap((set, i) => [1, 2].map(n => ({
    id: `${set}_creative${n}`, name: `[SIMULATED] ${i ? 'Facial' : 'Hair color'} revision ${simulation.revision}`,
    object_type: 'PHOTO', image_url: `https://${PROJECT}.supabase.co/storage/v1/object/public/business-media/beta-fixtures/deepvisor-beta-v1/${i ? 'facial' : 'hair-color'}.svg`,
    object_story_spec: { link_data: { name: 'Salon appointment', message: 'Synthetic advertisement for beta testing', link: 'https://example.test/booking' } },
  })));
  if (path.endsWith('/campaigns')) return { data: [{ id: campaign, name: '[SIMULATED] Salon services', status: 'ACTIVE', effective_status: 'ACTIVE', objective: 'OUTCOME_LEADS', created_time }] };
  if (path.endsWith('/adsets')) return { data: setIds.map((id, i) => ({ id, campaign_id: campaign, name: `[SIMULATED] ${i ? 'Historical facial' : 'Hair color'}`, status: status(i), effective_status: status(i), daily_budget: '5000', optimization_goal: 'LEAD_GENERATION', created_time })) };
  if (path.endsWith('/ads')) return { data: setIds.flatMap((set, i) => [1, 2].map(n => ({ id: `${set}_ad${n}`, adset_id: set, campaign_id: campaign, creative: { id: `${set}_creative${n}` }, name: `[SIMULATED] Ad ${i + 1}.${n}`, status: status(i), effective_status: status(i), created_time }))) };
  if (path.endsWith('/adcreatives')) return { data: creatives };
  const creative = creatives.find(c => c.id === path);
  if (creative) return creative;
  if (path === id) return { id, name: account.name, currency: 'USD', timezone_name: account.timezone, account_status: 1 };
  if (!path.endsWith('/insights')) throw new Error(`Unsupported simulated Meta path: ${path}`);
  if (simulation.scenario === 'partial') throw new Error('Simulated performance failure after dimensions');
  const anchorDay = simulation.anchorDay ?? SIMULATION_DAY;
  const range = JSON.parse(String(params.time_range ?? '{}'));
  const since = range.since ?? '2026-07-23';
  const until = range.until ?? anchorDay;
  const level = String(params.level ?? 'account');
  const breakdown = String(params.breakdowns ?? '');
  const hourly = breakdown.includes('hourly_stats');
  const daily = params.time_increment === '1' || params.time_increment === 1;
  const rows: Record<string, unknown>[] = [];
  const grouped = new Map<string, { spend: number; impressions: number; clicks: number; leads: number; date: string; entity: Record<string, string> }>();
  for (let d = new Date('2026-07-23T00:00:00Z'); d.toISOString().slice(0, 10) <= anchorDay; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day < since || day > until || (hourly && day < '2026-10-14')) continue;
    setIds.forEach((set, i) => {
      if (i === 1 && day > '2026-10-10') return;
      const spend = day === anchorDay ? 0 : (i ? 20 : 40) + (day === '2026-10-19' ? simulation.revision * 4 : 0);
      const leads = spend === 0 ? 0 : i ? 2 : 4 + (day === '2026-10-19' ? simulation.revision : 0);
      for (const n of [1, 2]) {
        const entity: Record<string, string> = level === 'ad' ? { campaign_id: campaign, adset_id: set, ad_id: `${set}_ad${n}` } : level === 'adset' ? { campaign_id: campaign, adset_id: set } : level === 'campaign' ? { campaign_id: campaign } : {};
        const key = JSON.stringify([entity, daily || hourly ? day : 'summary']);
        const current = grouped.get(key) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0, date: day, entity };
        current.spend += spend / 2 * multiplier; current.impressions += spend * 50 * multiplier; current.clicks += spend * multiplier; current.leads += (n === 1 ? Math.ceil(leads / 2) : Math.floor(leads / 2)) * multiplier;
        grouped.set(key, current);
      }
    });
  }
  for (const value of grouped.values()) {
    const dims: Record<string, string> = { age: '25-34', gender: 'female', country: 'US', region: 'Florida', publisher_platform: 'facebook', platform_position: 'feed', impression_device: 'iphone', device_platform: 'mobile', dma: '539' };
    const fields = Object.fromEntries(breakdown.split(',').filter(Boolean).map(key => [key, hourly ? '10:00:00 - 10:59:59' : dims[key]]));
    rows.push({ ...value.entity, ...fields, date_start: daily || hourly ? value.date : since, date_stop: daily || hourly ? value.date : until,
      account_currency: 'USD', spend: String(value.spend), impressions: String(value.impressions), clicks: String(value.clicks), inline_link_clicks: String(value.clicks / 2),
      // One stable synthetic cohort; summary reach is never a sum of daily uniques.
      reach: String(Math.min(value.impressions, 1500)), actions: [{ action_type: 'lead', value: String(value.leads) }],
      ctr: String(value.impressions ? value.clicks / value.impressions * 100 : 0), cpc: String(value.clicks ? value.spend / value.clicks : 0), cpm: String(value.impressions ? value.spend / value.impressions * 1000 : 0),
    });
  }
  return { data: rows };
}
