import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { canManageBusiness } from '@/lib/shared/business/access';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { loadWhatsAppSetup, saveWhatsAppNumber } from '@/lib/server/whatsapp/service';
import { normalizeWhatsAppNumber } from '@/lib/shared/whatsapp/setup';
import { ErrorCode, fail, ok } from '@/lib/shared';

const forbidden = () => NextResponse.json(
  fail('Requires an owner or admin', ErrorCode.FORBIDDEN, { userMessage: 'Only an owner or admin can change this setup.' }),
  { status: 403 }
);

function failure(error: unknown, userMessage: string) {
  unstable_rethrow(error);
  console.error('WhatsApp setup failed', { message: error instanceof Error ? error.message : 'unknown' });
  return NextResponse.json(fail('WhatsApp setup failed', ErrorCode.UNKNOWN_ERROR, { userMessage }), { status: 500 });
}

/** Numbers found for the signed-in business's selected ad account. Reads only. */
export async function GET() {
  try {
    const { businessId, role } = await getRequiredAppContext(false);
    if (!canManageBusiness(role)) return forbidden();
    return NextResponse.json(ok(await loadWhatsAppSetup(businessId, role)));
  } catch (error) {
    return failure(error, 'We could not check WhatsApp right now.');
  }
}

/** Saves the chosen number, or `null` to not use WhatsApp. */
export async function POST(request: NextRequest) {
  try {
    const { businessId, role } = await getRequiredAppContext(false);
    if (!canManageBusiness(role)) return forbidden();
    const body = await request.json().catch(() => null);
    const number = normalizeWhatsAppNumber(body?.number);
    if (!body || !('number' in body) || (body.number !== null && !number)) {
      return NextResponse.json(
        fail('Invalid WhatsApp number', ErrorCode.VALIDATION_ERROR, { userMessage: 'Enter a valid WhatsApp number with country code.' }),
        { status: 400 }
      );
    }
    await saveWhatsAppNumber(businessId, number);
    return NextResponse.json(ok({ number }));
  } catch (error) {
    return failure(error, 'We could not save your WhatsApp number right now.');
  }
}
