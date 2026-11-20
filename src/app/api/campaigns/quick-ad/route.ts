import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { createQuickAd } from '@/lib/server/quickAd/service';
import { optionalNumber, quickAdFailure, readJson } from './respond';

export const runtime = 'nodejs';

const Body = z.object({
  adAccountId: z.string().uuid(),
  /** From the upload link; the storage path is rebuilt from the signed-in scope, never sent. */
  mediaId: z.string().uuid(),
  type: z.string().max(100),
  name: z.string().max(500),
  note: z.string().max(2000).default(''),
  dailyBudget: optionalNumber,
  days: optionalNumber,
  idempotencyKey: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const read = await readJson(request);
    if ('response' in read) return read.response;
    const body = Body.parse(read.body);
    const scope = await authorizeSelectedMetaAccount(body.adAccountId);
    const result = await createQuickAd(scope, {
      media: { id: body.mediaId, type: body.type, name: body.name },
      note: body.note,
      request: { dailyBudget: body.dailyBudget, days: body.days },
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return quickAdFailure(error);
  }
}
