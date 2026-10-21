import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { simulatedMetaResponse, simulationToken, simulationAccounts, simulationForUser, type Simulation } from './meta';
import { fetchMetaCollection } from '../../sync/meta/client';
const config: Simulation = { businessId: 'a0000000-0000-4000-8000-000000000001', scenario: 'multiple', revision: 0 };
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DEEPVISOR_META_SIMULATION', 'gkdyyjqepzayjdpvqnja');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://gkdyyjqepzayjdpvqnja.supabase.co');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('development Meta response adapter', () => {
  it('fails closed outside development, wrong project, or missing opt-in', () => {
    for (const [name, value] of [['NODE_ENV','production'], ['DEEPVISOR_META_SIMULATION',''], ['NEXT_PUBLIC_SUPABASE_URL','https://other.supabase.co']]) {
      const old = process.env[name]; vi.stubEnv(name,value);
      expect(() => simulationToken(config)).toThrow('disabled'); vi.stubEnv(name,old);
    }
  });
  it('uses only server managed app metadata, never user metadata', () => {
    expect(simulationForUser({ app_metadata: {}, user_metadata: { 'deepvisor-meta-phase2': config } } as never, config.businessId)).toBeNull();
  });
  it('never sends synthetic IDs or simulated credentials to live fetch', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
    const id = simulationAccounts(config)[0].externalAccountId;
    expect(await fetchMetaCollection({ path: `${id}/campaigns`, accessToken: simulationToken(config) })).toHaveLength(1);
    await expect(fetchMetaCollection({ path: `${id}/campaigns`, accessToken: 'real-token' })).rejects.toThrow('Synthetic IDs');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('enforces business/account scope', () => {
    expect(() => simulatedMetaResponse(simulationToken(config), 'act_dvsim_other/campaigns')).toThrow('outside');
  });
  it('returns coherent entity totals and controlled historical corrections', () => {
    const path = `${simulationAccounts(config)[0].externalAccountId}/insights`;
    const params = { time_range: JSON.stringify({ since:'2026-10-13', until:'2026-10-19' }), time_increment:'1' };
    const totals = (level: string, revision = 0) => {
      const response = simulatedMetaResponse(simulationToken({ ...config, revision }),path,{ ...params,level }) as { data: { spend: string; impressions: string; actions: {value: string}[] }[] };
      return response.data.reduce((a,r)=>[a[0]+Number(r.spend),a[1]+Number(r.impressions),a[2]+Number(r.actions[0].value)],[0,0,0]);
    };
    for (const level of ['account','campaign','adset','ad']) expect(totals(level)).toEqual([280,28000,28]);
    expect(totals('adset',1)).toEqual([284,28400,29]);
    expect(totals('ad',1)).toEqual([284,28400,29]);
    const ads = simulatedMetaResponse(simulationToken({ ...config, revision: 1 }),path,{...params,level:'ad'}) as {data:{actions:{value:string}[]}[]};
    expect(ads.data.every(r=>Number.isInteger(Number(r.actions[0].value)))).toBe(true);
  });
  it.each(['permissions','expired','connection_failure','rate_limit','timeout'] as const)('simulates %s without network', scenario => {
    expect(() => simulatedMetaResponse(simulationToken({ ...config, scenario }), 'any')).toThrow();
  });
  it('supports one, multiple and zero accounts', () => {
    expect(simulationAccounts({ ...config,scenario:'single' })).toHaveLength(1);
    expect(simulationAccounts(config)).toHaveLength(2);
    expect(simulationAccounts({ ...config,scenario:'none' })).toEqual([]);
  });
});
