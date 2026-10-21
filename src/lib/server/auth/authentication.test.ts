import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ client: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), getUser: vi.fn() } }, redirect: vi.fn() }));
vi.mock('../supabase/server', () => ({ createSupabaseClient: async () => mocks.client, createServerClient: async () => mocks.client }));
vi.mock('./postAuthRedirect', () => ({ resolvePostAuthRedirectPath: mocks.redirect }));
import { handleLogin, handleSignOut, handleSignUp } from '../actions/user/auth';
import { GET as callback } from '@/app/api/auth/callback/route';
import { GET as verification } from '@/app/api/auth/verification/route';
import { fromSupabaseAuthError } from '../supabase/authError';
beforeEach(() => vi.resetAllMocks());
describe('Auth actions and callbacks', () => {
  it.each(['invalid_credentials','email_not_confirmed','session_expired','weak_password','email_exists'])('preserves %s failures', async code => {
    mocks.client.auth.signInWithPassword.mockResolvedValue({ error: { code, status: code === 'weak_password' ? 422 : 400 } });
    expect((await handleLogin('synthetic@example.test','invalid')).success).toBe(false);
  });
  it('handles signup, trims metadata, and relies on Auth for password validation', async () => {
    mocks.client.auth.signUp.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
    expect((await handleSignUp('test@example.test','password',' Name ')).success).toBe(true);
    expect(mocks.client.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { first_name:'Name',last_name:'' } } }));
  });
  it('surfaces logout failures instead of claiming success', async () => {
    mocks.client.auth.signOut.mockResolvedValue({ error: { code: 'request_timeout' } });
    expect((await handleSignOut()).success).toBe(false);
  });
  it('returns an absolute redirect for missing email verification parameters', async () => {
    const response = await verification(new Request('http://localhost:3011/api/auth/verification'));
    expect(response.headers.get('location')).toBe('http://localhost:3011/login?error=missing_verification_params');
  });
  it('rejects expired verification and redirects verified users to onboarding', async () => {
    mocks.client.auth.verifyOtp.mockResolvedValueOnce({ error:{code:'otp_expired'} });
    expect((await verification(new Request('http://localhost/api/auth/verification?token_hash=expired'))).headers.get('location')).toContain('verification_failed');
    mocks.client.auth.verifyOtp.mockResolvedValueOnce({ data:{user:{id:'new'}},error:null });
    mocks.redirect.mockResolvedValue('/onboarding');
    expect((await verification(new Request('http://localhost/api/auth/verification?token_hash=valid'))).headers.get('location')).toBe('http://localhost/onboarding');
  });
  it('handles Google provider rejection, missing code, and code exchange failure', async () => {
    for (const query of ['error=access_denied','','code=bad']) {
      mocks.client.auth.exchangeCodeForSession.mockResolvedValue({error:{message:'bad'}});
      expect((await callback(new NextRequest(`http://localhost/api/auth/callback?${query}`))).headers.get('location')).toContain('/sign-up?error=');
    }
  });
  it.each(['https://evil.test','//evil.test','/\\evil.test'])('ignores unsafe OAuth return path %s', async next => {
    mocks.client.auth.exchangeCodeForSession.mockResolvedValue({error:null});
    mocks.client.auth.getUser.mockResolvedValue({data:{user:{id:'new'}}});
    const response = await callback(new NextRequest(`http://localhost/api/auth/callback?code=valid&next=${encodeURIComponent(next)}`));
    expect(response.headers.get('location')).toBe('http://localhost/onboarding');
  });
  it('reports password policy failures specifically even with HTTP 422', () => {
    const result = fromSupabaseAuthError({code:'weak_password',status:422});
    expect(!result.success && result.error.userMessage).toContain('stronger');
  });
});
