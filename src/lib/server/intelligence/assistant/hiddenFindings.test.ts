import { expect, it, vi } from 'vitest';

const from = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('./access', async original => ({
  ...(await original<typeof import('./access')>()),
  authorizeAssistant: async () => ({ businessId: 'business', userId: 'user', account: { id: 'account' }, db: { from, schema: () => ({ from }) } }),
}));
import { analyticsNames, analyticsTools } from './analytics';
import { assistantTools, readAssistantTool } from './tools';

it('neither offers nor serves stored findings while they are hidden', async () => {
  expect(analyticsNames).not.toContain('getStoredFindings');
  expect(analyticsTools).toHaveLength(analyticsNames.length);
  expect(assistantTools.map(tool => (tool as { name?: string }).name)).not.toContain('getStoredFindings');
  // Asked for anyway by an authorized person, it is an unknown tool and nothing is read.
  const scope = { businessId: 'business', userId: 'user', account: { id: 'account' } } as Parameters<typeof readAssistantTool>[2];
  const validArguments = { campaignId: null, objective: null, optimizationGoal: null };
  await expect(readAssistantTool('getStoredFindings', validArguments, scope, new Map())).rejects.toThrow('Unknown assistant tool.');
  expect(from).not.toHaveBeenCalled();
});
