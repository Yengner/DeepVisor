import { expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
vi.mock('server-only', () => ({}));
import { loadDecisionSurface } from './loadSurface';
it('scopes selected-account decisions before pagination and never loads businesswide findings', async () => {
  const urls: URL[] = [];
  const client = createClient<Database>('https://unit-test.supabase.co', 'test', { auth: { persistSession: false }, global: { fetch: async url => {
    const parsed = new URL(String(url)); urls.push(parsed);
    return new Response(JSON.stringify(parsed.pathname.endsWith('autonomy_policies') ? null : []), { headers: { 'Content-Type': 'application/json' } });
  } } });
  const result = await loadDecisionSurface(client, 'business-a', 2, 'account-a');
  expect(result.cards).toEqual([]);
  const query = urls.find(url => url.pathname.endsWith('decision_runs'))!;
  expect(query.searchParams.get('business_id')).toBe('eq.business-a');
  expect(query.searchParams.get('feature_snapshots.ad_account_id')).toBe('eq.account-a');
  expect(query.searchParams.get('select')).toContain('!inner');
  expect(query.searchParams.get('offset')).toBe('40');
  expect(query.searchParams.get('limit')).toBe('21');
  expect(urls.some(url => url.pathname.includes('trend_findings'))).toBe(false);
});
