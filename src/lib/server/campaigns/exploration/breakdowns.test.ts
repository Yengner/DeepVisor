import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { loadAdSetBreakdowns } from './breakdowns';

function database(tables: Record<string, unknown[] | Error>) {
  const filters: Array<[string, string, unknown]> = [];
  const db = {
    from: (table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'order']) query[method] = () => query;
      for (const method of ['eq', 'gte', 'lte']) query[method] = (column: string, value: unknown) => { filters.push([table, `${method}:${column}`, value]); return query; };
      query.range = async (from: number) => {
        const rows = tables[table];
        return rows instanceof Error ? { data: null, error: rows } : { data: from === 0 ? rows : [], error: null };
      };
      return query;
    },
  };
  return { db: db as never, filters };
}
const input = { accountId: 'account-a', entityId: 'adset-a', since: '2026-11-19', until: '2026-11-25', currency: 'USD' };

it('reads only this account and ad set, with hours limited to the selected period', async () => {
  const { db, filters } = database({ ad_entity_performance_hourly: [], ad_audience_breakdowns_summary: [] });
  await loadAdSetBreakdowns(db, input);
  for (const table of ['ad_entity_performance_hourly', 'ad_audience_breakdowns_summary']) {
    expect(filters).toContainEqual([table, 'eq:ad_account_id', 'account-a']);
    expect(filters).toContainEqual([table, 'eq:entity_id', 'adset-a']);
  }
  expect(filters).toContainEqual(['ad_entity_performance_hourly', 'gte:day', '2026-11-19']);
  expect(filters).toContainEqual(['ad_entity_performance_hourly', 'lte:day', '2026-11-25']);
});

it('keeps missing results and other-currency spend unknown, and reports the audience range', async () => {
  const { db } = database({
    ad_entity_performance_hourly: [{ day: '2026-11-20', hour_of_day: 9, currency_code: 'EUR', spend: 5, impressions: 10, clicks: 1, inline_link_clicks: 0, leads: 1, messages: null, calls: 0 }],
    ad_audience_breakdowns_summary: [{ dimension_1_value: '25-34', dimension_2_value: 'female', first_day: '2026-01-02', last_day: '2026-11-25', currency_code: 'USD', spend: 12, impressions: 100, clicks: 4, leads: 1, messages: 2, calls: 0 }],
  });
  const result = await loadAdSetBreakdowns(db, input);
  expect(result.hourly![0]).toMatchObject({ spend: null, results: null, hourOfDay: 9 });
  expect(result.audience![0]).toMatchObject({ age: '25-34', gender: 'female', values: { spend: 12, conversion: 3 } });
  expect(result.audienceRange).toEqual({ since: '2026-01-02', until: '2026-11-25' });
});

it('reports a failed read as unavailable, not as empty', async () => {
  const { db } = database({ ad_entity_performance_hourly: new Error('down'), ad_audience_breakdowns_summary: [] });
  const result = await loadAdSetBreakdowns(db, input);
  expect(result.hourly).toBeNull();
  expect(result.audience).toEqual([]);
});
