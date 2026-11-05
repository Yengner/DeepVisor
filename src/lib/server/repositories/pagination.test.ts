import { describe, expect, it, vi } from 'vitest';
import { allPages, readAllPages, readPagesByIds } from './pagination';

describe('repository pagination contracts', () => {
  it.each([0, 499, 500, 501, 1000])('returns all %i rows in stable order', async count => {
    const rows = Array.from({ length: count }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(await allPages(query)).toEqual(rows);
    expect(query.mock.calls).toEqual(Array.from({ length: Math.floor(count / 500) + 1 }, (_, i) => [i * 500, i * 500 + 499]));
  });

  it('preserves strict and legacy null-data behavior', async () => {
    const query = async (from: number) => ({ data: from ? null : Array<number>(500).fill(1), error: null });
    expect(await readAllPages(query)).toHaveLength(500);
    await expect(allPages(query)).rejects.toThrow('Overview data unavailable');
  });

  it('propagates errors after successful pages without returning partial data', async () => {
    const error = { code: 'unavailable' };
    for (const read of [readAllPages, allPages]) {
      await expect(read(async from => ({ data: from ? null : Array<number>(500).fill(1), error: from ? error : null }))).rejects.toBe(error);
    }
  });

  it('does not query an empty ID scope and traverses every page of each ID batch', async () => {
    const ids = Array.from({ length: 101 }, (_, id) => String(id));
    const query = vi.fn(async (batch: string[], from: number) => ({ data: from ? [batch[0]] : Array<string>(500).fill(batch[0]), error: null }));
    expect(await readPagesByIds([], query)).toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(await readPagesByIds(ids, query)).toEqual([...Array<string>(501).fill('0'), ...Array<string>(501).fill('100')]);
    expect(query.mock.calls.map(([batch, from]) => [batch.length, from])).toEqual([[100, 0], [100, 500], [1, 0], [1, 500]]);
  });
});
