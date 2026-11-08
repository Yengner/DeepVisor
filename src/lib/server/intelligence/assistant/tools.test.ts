import { it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock('./access', () => ({ authorizeAssistant: mocks.authorize, AssistantError: class extends Error {
    } }));
import { readAssistantTool, toolNames } from './tools';
function setup() {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit'])
        chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'parent' }, error: null });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    const db = { from: vi.fn(() => chain) };
    const scope = { businessId: 'business', userId: 'user', account: { id: 'account', currency_code: 'USD', timezone: 'UTC' }, integration: { status: 'connected' }, db };
    mocks.authorize.mockResolvedValue(scope);
    return { scope, db, chain };
}
beforeEach(() => vi.clearAllMocks());
it.each(toolNames)('%s independently authorizes account scope before every read', async (name) => {
    const { scope } = setup();
    await readAssistantTool(name, { campaignId: 'campaign', objective: null, optimizationGoal: null }, scope as never);
    expect(mocks.authorize).toHaveBeenCalledWith('account');
    await readAssistantTool(name, { campaignId: 'campaign', objective: null, optimizationGoal: null }, scope as never);
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
});
it('rejects changed tenant/user before database reads and rejects unknown tools/arguments', async () => {
    const { scope, db } = setup();
    mocks.authorize.mockResolvedValue({ ...scope, businessId: 'other' });
    await expect(readAssistantTool('getBusinessProfile', {}, scope as never)).rejects.toThrow('access changed');
    expect(db.from).not.toHaveBeenCalled();
    mocks.authorize.mockResolvedValue(scope);
    await expect(readAssistantTool('executeSQL', { campaignId: null, objective: null, optimizationGoal: null }, scope as never)).rejects.toThrow('Unknown');
    await expect(readAssistantTool('getBusinessProfile', { sql: 'drop table' }, scope as never)).rejects.toThrow();
});
it('scopes profile, creative and campaign queries explicitly', async () => {
    const { scope, chain } = setup();
    await readAssistantTool('getCreativeHistory', { campaignId: null, objective: null, optimizationGoal: null }, scope as never);
    expect(chain.eq).toHaveBeenCalledWith('business_id', 'business');
    expect(chain.eq).toHaveBeenCalledWith('ad_account_id', 'account');
});
