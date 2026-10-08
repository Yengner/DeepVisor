import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { performanceFingerprint } from './manualRefreshStatus';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
it('paginates account-scoped facts and detects changes without sync timestamps', async () => {
  let value = 1;
  const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const [key, method] of Object.entries(query)) if (key !== 'range') method.mockReturnValue(query);
  query.range.mockImplementation((from: number) => Promise.resolve({ data: from === 0 ? Array.from({length:500}, (_, i) => ({entity_id: String(i), spend: value})) : [], error: null }));
  const client = {from: () => query} as unknown as RepositoryClient;
  const first = await performanceFingerprint(client, 'selected', '2026-09-09', '2026-10-08');
  expect(await performanceFingerprint(client, 'selected', '2026-09-09', '2026-10-08')).toBe(first);
  value = 2;
  expect(await performanceFingerprint(client, 'selected', '2026-09-09', '2026-10-08')).not.toBe(first);
  expect(query.eq).toHaveBeenCalledWith('ad_account_id', 'selected');
  expect(query.range).toHaveBeenCalledWith(500,999);
  query.range.mockResolvedValue({data:null,error:new Error('database error')});
  await expect(performanceFingerprint(client, 'selected', '2026-09-09', '2026-10-08')).rejects.toThrow('database error');
});
