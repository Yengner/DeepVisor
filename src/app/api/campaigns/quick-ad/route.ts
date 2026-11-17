import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { AssistantError, authorizeAssistant } from '@/lib/server/intelligence/assistant/access';
import { MAX_MEDIA_BYTES } from '@/lib/server/intelligence/assistant/media';
import { createQuickAd, QuickAdError } from '@/lib/server/quickAd/service';

export const runtime = 'nodejs';

function failed(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof QuickAdError) {
    return NextResponse.json({ success: false, error: error.message, code: error.code, missing: error.missing }, { status: error.status });
  }
  if (error instanceof AssistantError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Check the form and try again.' }, { status: 400 });
  console.error('Quick ad failed', { code: (error as { code?: string })?.code });
  return NextResponse.json({ success: false, error: 'Quick ad is unavailable right now.' }, { status: 503 });
}

const optionalNumber = z.preprocess(v => (v === null || v === '' ? null : Number(v)), z.number().finite().nullable());

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) {
      return NextResponse.json({ success: false, error: 'Invalid request origin.' }, { status: 403 });
    }
    const length = Number(request.headers.get('content-length'));
    if (!Number.isFinite(length) || length <= 0 || length > MAX_MEDIA_BYTES + 16_384) {
      return NextResponse.json({ success: false, error: 'Choose a file up to 4 MB.' }, { status: 413 });
    }
    const form = await request.formData();
    const scope = await authorizeAssistant(z.string().uuid().parse(form.get('adAccountId')));
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'Choose a photo or video first.' }, { status: 400 });
    const result = await createQuickAd(scope, {
      file: { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, name: file.name },
      note: z.string().max(2000).parse(form.get('note') ?? ''),
      request: { dailyBudget: optionalNumber.parse(form.get('dailyBudget')), days: optionalNumber.parse(form.get('days')) },
      idempotencyKey: z.string().uuid().parse(form.get('idempotencyKey')),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return failed(error);
  }
}
