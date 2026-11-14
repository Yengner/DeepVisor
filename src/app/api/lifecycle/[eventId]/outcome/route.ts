import { NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { lifecycleEnabled } from '@/lib/server/lifecycle/service';
import { loadLifecycleOutcome } from '@/lib/server/lifecycle/outcome';

const headers = { 'Cache-Control': 'private, no-store' };
/** Live before/after for a lifecycle event. Read-only; the saved brief stays immutable. */
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!lifecycleEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  const { eventId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: 'Invalid event' }, { status: 400, headers });
  try {
    const { businessId } = await getRequiredAppContext();
    const { selectedAdAccountId: account } = await resolveCurrentSelection(businessId);
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
    const outcome = await loadLifecycleOutcome(businessId, account, eventId);
    return NextResponse.json(outcome ?? { error: 'Not found' }, { status: outcome ? 200 : 404, headers });
  } catch (e) {
    unstable_rethrow(e);
    return NextResponse.json({ error: 'Before and after unavailable' }, { status: 503, headers });
  }
}
