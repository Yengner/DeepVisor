import { NextResponse, type NextRequest } from 'next/server';

/** The key a worker or operator sent: `x-internal-api-key`, or an `Authorization: Bearer` token. */
function requestApiKey(request: NextRequest): string | null {
  const header = request.headers.get('x-internal-api-key');
  if (header) return header;
  const [scheme, token] = request.headers.get('authorization')?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Guards internal worker and operator routes, which the session proxy does not cover.
 * Fails closed: with no `INTERNAL_API_KEY` configured, every request is refused.
 * Returns the refusal to send, or null when the caller is authorized.
 */
export function refuseWithoutInternalApiKey(request: NextRequest): NextResponse | null {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return NextResponse.json({ success: false, error: 'INTERNAL_API_KEY is not configured' }, { status: 500 });
  }
  const received = requestApiKey(request);
  if (!received || received !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
