/**
 * Pure rules for telling whether Meta still accepts a saved login. No I/O here: the daily check
 * (`connectionHealth.ts`) and the sync error path both use these.
 */

/** How often a saved Meta login is checked. */
export const TOKEN_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** A login that expires within this many days gets a warning. */
export const EXPIRY_WARNING_DAYS = 7;
/** Stored in `integration_details` by the daily check. */
export const TOKEN_CHECKED_AT_KEY = 'token_checked_at';

export type TokenCheck = 'ok' | 'rejected' | 'unknown';

/**
 * Meta's "this login no longer works" codes: 190 invalid or expired token, 102 session invalid,
 * 463/467 expired or invalid session. Rate limits and outages are not in this list: they say
 * nothing about the login.
 */
const LOGIN_CODES = new Set([102, 190, 463, 467]);

/** The answer to a `/me` request. Anything other than a clear login rejection is `unknown`. */
export function classifyTokenResponse(status: number, body: unknown): TokenCheck {
  if (status >= 200 && status < 300) return 'ok';
  const error = body && typeof body === 'object' ? (body as { error?: { code?: unknown; error_subcode?: unknown } }).error : undefined;
  const code = typeof error?.code === 'number' ? error.code : null;
  const subcode = typeof error?.error_subcode === 'number' ? error.error_subcode : null;
  return (code !== null && LOGIN_CODES.has(code)) || (subcode !== null && LOGIN_CODES.has(subcode)) ? 'rejected' : 'unknown';
}

/**
 * True when a failed sync's error message says Meta rejected the login. The sync client writes
 * Meta's code into the message as `code=190` (see `sync/meta/client.ts`).
 */
export function isLoginRejectedMessage(message: string): boolean {
  const match = /\b(?:code|subcode)=(\d+)/g;
  for (const found of message.matchAll(match)) if (LOGIN_CODES.has(Number(found[1]))) return true;
  return false;
}

/** True when the saved login hasn't been checked in the last day. */
export function tokenCheckDue(lastCheckedAt: unknown, now: Date): boolean {
  const time = typeof lastCheckedAt === 'string' ? Date.parse(lastCheckedAt) : NaN;
  return !Number.isFinite(time) || now.getTime() - time >= TOKEN_CHECK_INTERVAL_MS;
}

/** Whole days until the login expires (0 = today), or null when it has no known expiry or has passed. */
export function expiryDaysLeft(expiresAt: string | null | undefined, now: Date): number | null {
  const time = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(time) || time <= now.getTime()) return null;
  return Math.floor((time - now.getTime()) / 86_400_000);
}

export type LoginState = 'ok' | 'expiring' | 'signInNeeded' | 'unchecked';

/**
 * What to say about a saved login on screen. `signInNeeded` comes from the connection status
 * (set by the daily check or a sync Meta rejected) or a passed expiry; `unchecked` means no daily
 * check has answered yet, which is never shown as working.
 */
export function loginState(input: { status: string; checkedAt: unknown; expiresAt: string | null; now: Date }): { state: LoginState; daysLeft: number | null } {
  const expires = input.expiresAt ? Date.parse(input.expiresAt) : NaN;
  if (input.status === 'needs_reauth' || (Number.isFinite(expires) && expires <= input.now.getTime())) return { state: 'signInNeeded', daysLeft: null };
  const warning = expiryWarning(input.expiresAt, input.now);
  if (warning) return { state: 'expiring', daysLeft: warning.days };
  if (typeof input.checkedAt !== 'string' || !Number.isFinite(Date.parse(input.checkedAt))) return { state: 'unchecked', daysLeft: null };
  return { state: 'ok', daysLeft: expiryDaysLeft(input.expiresAt, input.now) };
}

/** The warning to show for a login that still works, or null when there's nothing to say yet. */
export function expiryWarning(expiresAt: string | null | undefined, now: Date): { days: number } | null {
  const days = expiryDaysLeft(expiresAt, now);
  return days !== null && days < EXPIRY_WARNING_DAYS ? { days } : null;
}
