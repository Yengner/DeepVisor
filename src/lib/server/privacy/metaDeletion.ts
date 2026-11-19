import 'server-only';
import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';

/**
 * Meta data deletion (see `supabase/migrations/*_meta_data_deletion.sql` for what is deleted and
 * kept). Two entry points: Meta's data deletion callback (a person removed DeepVisor in their
 * Facebook settings) and an owner/admin's "Delete Meta data" on Connections. Each request gets a
 * confirmation code the person can check on /data-deletion.
 */
type Db = SupabaseClient<Database>;
export type DeletionStatus = 'received' | 'completed' | 'no_data' | 'failed';
export type DeletionRequest = { code: string; status: DeletionStatus; connections: number };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 12 characters without look-alikes (no 0/O, 1/I). */
export function newConfirmationCode(): string {
  return Array.from({ length: 12 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}
export const isConfirmationCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Z0-9]{12}$/.test(value);

async function createRequest(db: Db, input: { source: 'meta_callback' | 'owner'; metaUserId?: string; businessId?: string }) {
  const code = newConfirmationCode();
  const { data, error } = await db.from('meta_data_deletion_requests').insert({
    confirmation_code: code, source: input.source, meta_user_id: input.metaUserId ?? null, business_id: input.businessId ?? null,
  }).select('id').single();
  if (error) throw error;
  return { id: data.id, code };
}

async function finish(db: Db, id: string, update: { status: DeletionStatus; connections: number; error?: string }) {
  const { error } = await db.from('meta_data_deletion_requests').update({
    status: update.status, connections: update.connections, error: update.error?.slice(0, 200) ?? null, completed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

async function deleteConnection(db: Db, businessId: string, integrationId: string) {
  const { error } = await db.rpc('delete_meta_connection_data', { p_business: businessId, p_integration: integrationId });
  if (error) throw error;
}

/**
 * Meta's callback: delete the Meta data of every DeepVisor connection this Meta user made. The
 * request is recorded first, so a failure still leaves a code Meta and the person can check.
 */
export async function deleteMetaDataForMetaUser(db: Db, metaUserId: string): Promise<DeletionRequest> {
  const request = await createRequest(db, { source: 'meta_callback', metaUserId });
  try {
    const { data: connections, error } = await db.from('platform_integrations').select('id, business_id, platforms!inner(key)')
      .eq('platforms.key', 'meta').eq('integration_details->>meta_user_id', metaUserId);
    if (error) throw error;
    for (const connection of connections ?? []) await deleteConnection(db, connection.business_id, connection.id);
    const count = connections?.length ?? 0;
    const status: DeletionStatus = count ? 'completed' : 'no_data';
    await finish(db, request.id, { status, connections: count });
    return { code: request.code, status, connections: count };
  } catch (error) {
    await finish(db, request.id, { status: 'failed', connections: 0, error: (error as { code?: string })?.code ?? 'delete_failed' }).catch(() => undefined);
    console.error('Meta data deletion failed', { code: (error as { code?: string })?.code });
    return { code: request.code, status: 'failed', connections: 0 };
  }
}

/** Owner/admin "Delete Meta data" for one connection of their own business (already authorized). */
export async function deleteMetaDataForConnection(db: Db, input: { businessId: string; integrationId: string }): Promise<DeletionRequest> {
  const request = await createRequest(db, { source: 'owner', businessId: input.businessId });
  try {
    await deleteConnection(db, input.businessId, input.integrationId);
    await finish(db, request.id, { status: 'completed', connections: 1 });
    return { code: request.code, status: 'completed', connections: 1 };
  } catch (error) {
    await finish(db, request.id, { status: 'failed', connections: 0, error: (error as { code?: string })?.code ?? 'delete_failed' }).catch(() => undefined);
    throw error;
  }
}

/** Public status lookup by confirmation code. Reveals only the status and dates. */
export async function deletionStatus(db: Db, code: string): Promise<{ status: DeletionStatus; requestedAt: string; completedAt: string | null } | null> {
  if (!isConfirmationCode(code)) return null;
  const { data, error } = await db.from('meta_data_deletion_requests').select('status, created_at, completed_at').eq('confirmation_code', code).maybeSingle();
  if (error) throw error;
  return data ? { status: data.status as DeletionStatus, requestedAt: data.created_at, completedAt: data.completed_at } : null;
}
