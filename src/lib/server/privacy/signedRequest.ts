import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta's `signed_request` (data deletion and deauthorize callbacks): `<signature>.<payload>`, both
 * base64url, where the signature is HMAC-SHA256 of the encoded payload with the app secret.
 * Returns the app-scoped user id, or null for anything unsigned, tampered or malformed.
 */
const base64url = (value: string) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function parseMetaSignedRequest(raw: unknown, secret: string | undefined): { userId: string } | null {
  if (!secret || typeof raw !== 'string' || raw.length > 4096) return null;
  const [encodedSignature, encodedPayload, extra] = raw.split('.');
  if (!encodedSignature || !encodedPayload || extra !== undefined) return null;
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(encodedSignature) || !/^[A-Za-z0-9_-]+={0,2}$/.test(encodedPayload)) return null;
  const expected = createHmac('sha256', secret).update(encodedPayload).digest();
  const signature = base64url(encodedSignature);
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  let payload: { algorithm?: unknown; user_id?: unknown };
  try { payload = JSON.parse(base64url(encodedPayload).toString('utf8')); } catch { return null; }
  if (typeof payload.algorithm !== 'string' || payload.algorithm.toUpperCase() !== 'HMAC-SHA256') return null;
  const userId = typeof payload.user_id === 'string' || typeof payload.user_id === 'number' ? String(payload.user_id) : '';
  return /^\d{1,30}$/.test(userId) ? { userId } : null;
}
