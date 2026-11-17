import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { AssistantError } from '@/lib/server/intelligence/assistant/access';
import { QuickAdError } from '@/lib/server/quickAd/service';

/** Quick ad requests are small JSON bodies; the file itself goes straight to private storage. */
const MAX_BODY_BYTES = 16_384;

export const optionalNumber = z.preprocess(v => (v === null || v === '' || v === undefined ? null : Number(v)), z.number().finite().nullable());

/** Same-origin JSON body under the size cap, or a ready error response. */
export async function readJson(request: NextRequest): Promise<{ body: unknown } | { response: NextResponse }> {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return { response: NextResponse.json({ success: false, error: 'Invalid request origin.' }, { status: 403 }) };
  }
  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0 || length > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ success: false, error: 'Request too large.' }, { status: 413 }) };
  }
  return { body: await request.json() };
}

export function quickAdFailure(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof QuickAdError) {
    return NextResponse.json({ success: false, error: error.message, code: error.code, missing: error.missing }, { status: error.status });
  }
  if (error instanceof AssistantError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ success: false, error: 'Check the form and try again.', code: 'INVALID_INPUT' }, { status: 400 });
  }
  console.error('Quick ad failed', { code: (error as { code?: string })?.code });
  return NextResponse.json({ success: false, error: 'Quick ad is unavailable right now.' }, { status: 503 });
}
