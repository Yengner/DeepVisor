import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { parseMetaSignedRequest } = await import('./signedRequest');

const SECRET = 'app-secret';
const b64url = (value: Buffer | string) => Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** Built the way Meta's docs describe: base64url(HMAC-SHA256(encodedPayload)) + '.' + encodedPayload. */
function signed(payload: Record<string, unknown>, secret = SECRET) {
  const encoded = b64url(JSON.stringify(payload));
  return `${b64url(createHmac('sha256', secret).update(encoded).digest())}.${encoded}`;
}

describe('parseMetaSignedRequest', () => {
  it('returns the app-scoped user id of a correctly signed request', () => {
    expect(parseMetaSignedRequest(signed({ algorithm: 'HMAC-SHA256', user_id: '218471', issued_at: 1291836800 }), SECRET)).toEqual({ userId: '218471' });
  });
  it('rejects a request signed with another secret or with a changed payload', () => {
    expect(parseMetaSignedRequest(signed({ algorithm: 'HMAC-SHA256', user_id: '1' }, 'other'), SECRET)).toBeNull();
    const [signature] = signed({ algorithm: 'HMAC-SHA256', user_id: '1' }).split('.');
    expect(parseMetaSignedRequest(`${signature}.${b64url(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '2' }))}`, SECRET)).toBeNull();
  });
  it('rejects malformed input, other algorithms, bad user ids and a missing secret', () => {
    for (const raw of [undefined, '', 'abc', 'a.b.c', `${'x'.repeat(5000)}.y`]) expect(parseMetaSignedRequest(raw, SECRET)).toBeNull();
    expect(parseMetaSignedRequest(signed({ algorithm: 'HMAC-SHA1', user_id: '1' }), SECRET)).toBeNull();
    expect(parseMetaSignedRequest(signed({ algorithm: 'HMAC-SHA256', user_id: 'abc' }), SECRET)).toBeNull();
    expect(parseMetaSignedRequest(signed({ algorithm: 'HMAC-SHA256', user_id: '1' }), undefined)).toBeNull();
  });
});
