import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { deleteMetaDataForConnection, deleteMetaDataForMetaUser, deletionStatus, isConfirmationCode, newConfirmationCode } = await import('./metaDeletion');

/** Fake Supabase: records inserts/updates/RPCs; `connections` is what the Meta-user lookup returns. */
function fakeDb(options: { connections?: Array<{ id: string; business_id: string }>; rpcError?: { code: string } } = {}) {
  const log: Array<{ op: string; table?: string; values?: unknown; args?: unknown }> = [];
  const from = (table: string) => {
    let op = 'select', values: unknown;
    const chain = {
      select: () => chain, eq: () => chain,
      insert: (v: unknown) => { op = 'insert'; values = v; return chain; },
      update: (v: unknown) => { op = 'update'; values = v; return chain; },
      single: async () => { log.push({ op, table, values }); return { data: { id: 'request-1' }, error: null }; },
      maybeSingle: async () => ({ data: { status: 'completed', created_at: '2026-11-19T10:00:00Z', completed_at: '2026-11-19T10:00:01Z' }, error: null }),
      then: (resolve: (v: unknown) => void) => {
        log.push({ op, table, values });
        resolve(op === 'select' ? { data: options.connections ?? [], error: null } : { data: null, error: null });
      },
    };
    return chain;
  };
  const rpc = vi.fn(async (name: string, args: unknown) => { log.push({ op: 'rpc', args: { name, ...args as object } }); return { data: { rows: 3 }, error: options.rpcError ?? null }; });
  return { db: { from, rpc } as never, log, rpc };
}

describe('confirmation codes', () => {
  it('are 12 characters without look-alikes', () => {
    const code = newConfirmationCode();
    expect(isConfirmationCode(code)).toBe(true);
    expect(code).not.toMatch(/[01IO]/);
    expect(isConfirmationCode('abc')).toBe(false);
  });
});

describe('deleteMetaDataForMetaUser (Meta callback)', () => {
  it('deletes every connection that Meta user made and records the request as completed', async () => {
    const { db, log, rpc } = fakeDb({ connections: [{ id: 'i1', business_id: 'b1' }, { id: 'i2', business_id: 'b2' }] });
    const result = await deleteMetaDataForMetaUser(db, '218471');
    expect(result).toMatchObject({ status: 'completed', connections: 2 });
    expect(rpc.mock.calls.map(c => c[1])).toEqual([{ p_business: 'b1', p_integration: 'i1' }, { p_business: 'b2', p_integration: 'i2' }]);
    expect(log.find(l => l.op === 'insert')).toMatchObject({ table: 'meta_data_deletion_requests', values: { source: 'meta_callback', meta_user_id: '218471', confirmation_code: result.code } });
    expect(log.filter(l => l.op === 'update').at(-1)).toMatchObject({ values: { status: 'completed', connections: 2 } });
  });

  it('answers "no data" when DeepVisor has nothing from that Meta user', async () => {
    const { db, rpc } = fakeDb();
    expect(await deleteMetaDataForMetaUser(db, '1')).toMatchObject({ status: 'no_data', connections: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('still gives Meta a code when deletion fails, and records the failure without details', async () => {
    const { db, log } = fakeDb({ connections: [{ id: 'i1', business_id: 'b1' }], rpcError: { code: '23503' } });
    const result = await deleteMetaDataForMetaUser(db, '1');
    expect(result.status).toBe('failed');
    expect(isConfirmationCode(result.code)).toBe(true);
    expect(log.filter(l => l.op === 'update').at(-1)).toMatchObject({ values: { status: 'failed', error: '23503' } });
  });
});

describe('deleteMetaDataForConnection (owner)', () => {
  it('deletes one connection of the given business', async () => {
    const { db, rpc } = fakeDb();
    expect(await deleteMetaDataForConnection(db, { businessId: 'b1', integrationId: 'i1' })).toMatchObject({ status: 'completed', connections: 1 });
    expect(rpc).toHaveBeenCalledWith('delete_meta_connection_data', { p_business: 'b1', p_integration: 'i1' });
  });
  it('records the failure and lets the caller report it', async () => {
    const { db, log } = fakeDb({ rpcError: { code: 'P0002' } });
    await expect(deleteMetaDataForConnection(db, { businessId: 'b1', integrationId: 'i1' })).rejects.toMatchObject({ code: 'P0002' });
    expect(log.filter(l => l.op === 'update').at(-1)).toMatchObject({ values: { status: 'failed' } });
  });
});

describe('deletionStatus', () => {
  it('only looks up well-formed codes', async () => {
    const { db } = fakeDb();
    expect(await deletionStatus(db, 'nope')).toBeNull();
    expect(await deletionStatus(db, 'ABCDEFGHJKLM')).toMatchObject({ status: 'completed' });
  });
});
