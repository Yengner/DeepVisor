import { describe, expect, it } from 'vitest';
import { buildOAuthCallbackUrl } from './oauthCallback';

describe('Google OAuth callback origin', () => {
  it.each(['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://[::1]:3000'])('keeps %s local despite a production base URL', (origin) => {
    const url = new URL(buildOAuthCallbackUrl(origin, 'login', 'https://deepvisor.example/'));
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe('/api/auth/callback');
    expect(url.searchParams.get('next')).toBe('/dashboard');
    expect(url.searchParams.get('auth_page')).toBe('login');
  });
  it('preserves production configuration and signup routing', () => {
    const url = new URL(buildOAuthCallbackUrl('https://app.example', 'signup', 'https://deepvisor.example/'));
    expect(url.origin).toBe('https://deepvisor.example');
    expect(url.searchParams.get('auth_page')).toBe('signup');
  });
  it('uses the current origin when no base URL is configured', () => {
    expect(new URL(buildOAuthCallbackUrl('https://app.example', 'login')).origin).toBe('https://app.example');
  });
});
