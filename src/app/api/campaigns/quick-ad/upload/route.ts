import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeAssistant } from '@/lib/server/intelligence/assistant/access';
import { prepareQuickAdUpload } from '@/lib/server/quickAd/service';
import { optionalNumber, quickAdFailure, readJson } from '../respond';

export const runtime = 'nodejs';

const Body = z.object({
  adAccountId: z.string().uuid(),
  type: z.string().max(100),
  size: z.number(),
  dailyBudget: optionalNumber,
  days: optionalNumber,
});

/** A one-time link to upload a Quick ad photo or video straight to private storage. */
export async function POST(request: NextRequest) {
  try {
    const read = await readJson(request);
    if ('response' in read) return read.response;
    const body = Body.parse(read.body);
    const scope = await authorizeAssistant(body.adAccountId);
    const data = await prepareQuickAdUpload(scope, {
      type: body.type,
      size: body.size,
      request: { dailyBudget: body.dailyBudget, days: body.days },
    });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return quickAdFailure(error);
  }
}
