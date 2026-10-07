export function buildOAuthCallbackUrl(origin: string, type: 'login' | 'signup', configuredBaseUrl?: string): string {
  const browserUrl = new URL(origin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(browserUrl.hostname);
  // PKCE cookies belong to the browser's host, including during local development.
  const callback = new URL('/api/auth/callback', local ? browserUrl.origin : configuredBaseUrl?.trim() || browserUrl.origin);
  callback.searchParams.set('next', '/dashboard');
  callback.searchParams.set('auth_page', type);
  return callback.toString();
}
