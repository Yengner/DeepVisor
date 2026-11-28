import { describe, expect, it } from 'vitest';
import { classifyTokenResponse, expiryDaysLeft, expiryWarning, isLoginRejectedMessage, loginState, tokenCheckDue } from './metaLogin';

const now = new Date('2026-11-27T12:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe('classifyTokenResponse', () => {
  it('accepts a successful /me', () => expect(classifyTokenResponse(200, { id: '1' })).toBe('ok'));
  it('treats Meta login codes as a rejection', () => {
    expect(classifyTokenResponse(400, { error: { code: 190, type: 'OAuthException' } })).toBe('rejected');
    expect(classifyTokenResponse(400, { error: { code: 100, error_subcode: 463 } })).toBe('rejected');
  });
  it('never calls an outage, rate limit or unreadable body a rejection', () => {
    expect(classifyTokenResponse(500, {})).toBe('unknown');
    expect(classifyTokenResponse(400, { error: { code: 17 } })).toBe('unknown');
    expect(classifyTokenResponse(429, null)).toBe('unknown');
  });
});

describe('isLoginRejectedMessage', () => {
  it('reads the code the sync client writes into its errors', () => {
    expect(isLoginRejectedMessage('Error validating access token (type=OAuthException, code=190, subcode=460)')).toBe(true);
    expect(isLoginRejectedMessage('Session expired (code=100, subcode=463)')).toBe(true);
  });
  it('ignores other errors', () => {
    expect(isLoginRejectedMessage('User request limit reached (code=17)')).toBe(false);
    expect(isLoginRejectedMessage('fetch failed')).toBe(false);
    expect(isLoginRejectedMessage('account 1190 not found')).toBe(false);
  });
});

describe('tokenCheckDue', () => {
  it('is due when never checked, unreadable, or a day old', () => {
    expect(tokenCheckDue(undefined, now)).toBe(true);
    expect(tokenCheckDue('nonsense', now)).toBe(true);
    expect(tokenCheckDue(inDays(-1), now)).toBe(true);
  });
  it('waits within the day', () => expect(tokenCheckDue(inDays(-0.5), now)).toBe(false));
});

describe('expiry', () => {
  it('counts whole days left and ignores missing or past expiries', () => {
    expect(expiryDaysLeft(inDays(3.5), now)).toBe(3);
    expect(expiryDaysLeft(null, now)).toBeNull();
    expect(expiryDaysLeft(inDays(-1), now)).toBeNull();
  });
  it('warns only inside the last week', () => {
    expect(expiryWarning(inDays(6.9), now)).toEqual({ days: 6 });
    expect(expiryWarning(inDays(7), now)).toBeNull();
    expect(expiryWarning(inDays(0.2), now)).toEqual({ days: 0 });
  });
});

describe('loginState', () => {
  const base = { status: 'connected', checkedAt: inDays(-0.1), expiresAt: inDays(40), now };
  it('is ok only after a check answered', () => {
    expect(loginState(base)).toEqual({ state: 'ok', daysLeft: 40 });
    expect(loginState({ ...base, checkedAt: undefined }).state).toBe('unchecked');
  });
  it('asks to sign in when Meta rejected it or it expired', () => {
    expect(loginState({ ...base, status: 'needs_reauth' }).state).toBe('signInNeeded');
    expect(loginState({ ...base, expiresAt: inDays(-1) }).state).toBe('signInNeeded');
  });
  it('warns before expiry even when never checked', () => {
    expect(loginState({ ...base, checkedAt: undefined, expiresAt: inDays(2) })).toEqual({ state: 'expiring', daysLeft: 2 });
  });
});
