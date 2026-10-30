import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { upsertAdEntities } from './upsertAdEntities';

it('uses database defaults in mixed existing/new batches and preserves IDs on repeat sync', async () => {
  const rows = new Map<string, Record<string, unknown>>([
    ['existing', {id:'existing-id',ad_account_id:'account',entity_level:'adset',external_id:'existing'}],
  ]);
  const client = createClient<Database>('https://database.test', 'test-key', {
    auth: {persistSession:false},
    global: {fetch: async (url, options) => {
      if (String(url).includes('/ad_accounts?')) {
        return Response.json([{id:'account',business_id:'business',platform_id:'meta'}]);
      }
      if (options?.method === 'POST') {
        const batch = JSON.parse(String(options.body)) as Record<string, unknown>[];
        // Model PostgREST's mixed-column bulk insert: omitted fields become
        // NULL unless missing=default is requested, even with a DB default.
        const defaults = new Headers(options.headers).get('Prefer')?.includes('missing=default');
        if (batch.some(row => !row.id) && !defaults) {
          return Response.json({message:'null value in column "id" violates not-null constraint'}, {status:400});
        }
        for (const row of batch) {
          rows.set(String(row.external_id), { ...row, id:row.id ?? 'generated-id' });
        }
        return new Response(null, {status:201});
      }
      return Response.json([...rows.values()]);
    }},
  });
  const inputs = ['existing','new'].map(externalId => ({
    adAccountId:'account',entityLevel:'adset' as const,externalId,
    syncedAt:'2026-10-29T00:00:00Z',
  }));
  const first = await upsertAdEntities(client, inputs);
  expect(first.map(row => row.id)).toEqual(['existing-id','generated-id']);
  const second = await upsertAdEntities(client, inputs);
  expect(second.map(row => row.id)).toEqual(first.map(row => row.id));
  expect(rows.size).toBe(2);
});
