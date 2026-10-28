import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  getUser: vi.fn(), updateUser: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn(),
  rpc: vi.fn(), deleteUser: vi.fn(), signOut: vi.fn(), revalidate: vi.fn(), cookieDelete: vi.fn(), admin: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [{ name: 'sb-project-auth-token' }, { name: 'ad_account_row_id' }, { name: 'unrelated' }], delete: m.cookieDelete }) }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: async () => ({
  auth: { getUser: m.getUser, updateUser: m.updateUser, signOut: m.signOut },
  from: () => ({ update: m.update }),
}) }));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: m.admin }));
import { deleteOwnAccount, requestOwnEmailChange, updateOwnProfile } from './settingsProfile';
const profile = { first_name: '  Ada ', last_name: 'Lovelace', phone_number: '' };
beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: 'self', email: 'old@example.com', last_sign_in_at: new Date().toISOString() } }, error: null });
  m.update.mockReturnValue({ eq: m.eq });
  m.eq.mockReturnValue({ select: () => ({ single: m.single }) });
  m.single.mockResolvedValue({ data: { id: 'self' }, error: null });
  m.admin.mockReturnValue({ rpc: m.rpc, auth: { admin: { deleteUser: m.deleteUser } } });
  m.rpc.mockResolvedValue({ error: null }); m.deleteUser.mockResolvedValue({ error: null });
  m.updateUser.mockResolvedValue({ data: { user: { email: 'old@example.com' } }, error: null });
  m.signOut.mockResolvedValue({ error: null });
});
it('updates only the verified user using an ordinary RLS client, normalizes fields and invalidates layout', async () => {
  expect((await updateOwnProfile(profile)).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith({ first_name: 'Ada', last_name: 'Lovelace', phone_number: null });
  expect(m.eq).toHaveBeenCalledWith('id', 'self');
  expect(m.admin).not.toHaveBeenCalled(); expect(m.revalidate).toHaveBeenCalledWith('/', 'layout');
});
it.each([{ ...profile, id: 'other' }, { ...profile, status: 'admin' }, { ...profile, first_name: ' ' }, { ...profile, phone_number: '<bad>' }])('rejects invalid or privileged profile fields', async input => {
  expect((await updateOwnProfile(input)).success).toBe(false); expect(m.update).not.toHaveBeenCalled();
});
it('rejects unauthenticated requests, failed saves and missing profile rows', async () => {
  m.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await updateOwnProfile(profile)).success).toBe(false); expect(m.update).not.toHaveBeenCalled();
  m.single.mockResolvedValueOnce({ error: { message: 'private database error' } });
  expect(await updateOwnProfile(profile)).toEqual({ success: false, message: 'Your profile could not be saved. Please try again.' });
});
it('requests email verification through Auth without writing an unverified profile email', async () => {
  const result = await requestOwnEmailChange('new@example.com');
  expect(result.success).toBe(true); expect(result.message).toContain('confirmation');
  expect(m.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' }); expect(m.update).not.toHaveBeenCalled();
});
it.each(['invalid', 'old@example.com'])('rejects invalid or unchanged email %s', async email => {
  expect((await requestOwnEmailChange(email)).success).toBe(false); expect(m.updateUser).not.toHaveBeenCalled();
});
it('fails closed for expired/old authentication before sensitive operations', async () => {
  m.getUser.mockResolvedValue({ data: { user: { id: 'self', last_sign_in_at: '2000-01-01' } }, error: null });
  expect((await deleteOwnAccount('DELETE')).success).toBe(false);
  expect((await requestOwnEmailChange('new@example.com')).success).toBe(false);
  expect(m.admin).not.toHaveBeenCalled(); expect(m.updateUser).not.toHaveBeenCalled();
});
it('requires exact deletion confirmation', async () => {
  expect((await deleteOwnAccount({ id: 'victim', confirmation: 'DELETE' })).success).toBe(false);
  expect((await deleteOwnAccount('delete')).success).toBe(false); expect(m.admin).not.toHaveBeenCalled();
});
it('uses official hard-deletion of the authenticated user and clears only relevant cookies after success', async () => {
  expect((await deleteOwnAccount('DELETE')).success).toBe(true);
  expect(m.rpc).toHaveBeenCalledWith('assert_account_deletable', { p_user: 'self' });
  expect(m.deleteUser).toHaveBeenCalledWith('self', false); expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(m.cookieDelete.mock.calls).toEqual([['sb-project-auth-token'], ['ad_account_row_id']]);
});
it.each(['ACCOUNT_DELETE_LAST_OWNER', 'ACCOUNT_DELETE_BUSY', 'ACCOUNT_DELETE_STORAGE'])('does not delete when guard rejects %s', async message => {
  m.rpc.mockResolvedValueOnce({ error: { message } });
  expect((await deleteOwnAccount('DELETE')).success).toBe(false); expect(m.deleteUser).not.toHaveBeenCalled(); expect(m.signOut).not.toHaveBeenCalled();
});
it('does not report success or clear the session after Auth rejects deletion', async () => {
  m.deleteUser.mockResolvedValueOnce({ error: { message: 'internal' } });
  expect((await deleteOwnAccount('DELETE')).success).toBe(false); expect(m.signOut).not.toHaveBeenCalled(); expect(m.cookieDelete).not.toHaveBeenCalled();
});
it('still confirms deletion when subsequent local logout fails', async () => {
  m.signOut.mockRejectedValueOnce(new Error('session already gone'));
  expect((await deleteOwnAccount('DELETE')).success).toBe(true);
});
