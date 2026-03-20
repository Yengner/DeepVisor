import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';

export type RepositoryClient = SupabaseClient<Database>;

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(getKey(item), item);
  }

  return Array.from(map.values());
}

export function buildScopedExternalKey(scopeId: string, externalId: string): string {
  return `${scopeId}::${externalId}`;
}
