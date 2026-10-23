import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const project = 'gkdyyjqepzayjdpvqnja';
export const tag = 'deepvisor-meta-phase2';
export const statePath = new URL('../../.env.beta-phase5.json', import.meta.url);
export function guard() {
  if (process.env.DEEPVISOR_META_SIMULATION !== project || process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) throw new Error('Explicit development project opt-in required');
}
export function adminClient() {
  guard();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function state() {
  guard();
  try { return JSON.parse(await readFile(statePath, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const run = randomBytes(5).toString('hex');
    const data = { run, users: ['a'].map(key => ({ key, email: `deepvisor-phase5-${run}-${key}@example.test`, password: randomBytes(24).toString('base64url') + '!aA9' })) };
    await save(data); return data;
  }
}
export async function save(data) { await writeFile(statePath, JSON.stringify(data, null, 2), { mode: 0o600 }); }
