import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { refuseWithoutInternalApiKey } from './internalApiKey';

const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as NextRequest;

describe('internal route key', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('refuses every request when no key is configured, even an empty match', async () => {
    vi.stubEnv('INTERNAL_API_KEY', '');
    const refusal = refuseWithoutInternalApiKey(request({ 'x-internal-api-key': '' }));
    expect(refusal?.status).toBe(500);
    await expect(refusal?.json()).resolves.toEqual({ success: false, error: 'INTERNAL_API_KEY is not configured' });
  });

  it.each<[string, Record<string, string>]>([
    ['no headers', {}],
    ['a wrong key', { 'x-internal-api-key': 'wrong' }],
    ['a wrong bearer token', { authorization: 'Bearer wrong' }],
    ['another auth scheme', { authorization: 'Basic secret' }],
    ['an empty bearer token', { authorization: 'Bearer ' }],
    ['a wrong header beside a right bearer token', { 'x-internal-api-key': 'wrong', authorization: 'Bearer secret' }],
  ])('refuses %s', async (_label, headers) => {
    vi.stubEnv('INTERNAL_API_KEY', 'secret');
    const refusal = refuseWithoutInternalApiKey(request(headers));
    expect(refusal?.status).toBe(401);
    await expect(refusal?.json()).resolves.toEqual({ success: false, error: 'Unauthorized' });
  });

  it.each<[string, Record<string, string>]>([
    ['the key header', { 'x-internal-api-key': 'secret' }],
    ['a bearer token', { authorization: 'Bearer secret' }],
    ['a lowercase scheme', { authorization: 'bearer secret' }],
  ])('accepts %s', (_label, headers) => {
    vi.stubEnv('INTERNAL_API_KEY', 'secret');
    expect(refuseWithoutInternalApiKey(request(headers))).toBeNull();
  });
});
