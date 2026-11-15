import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { insightsScope, uuid } from '@/lib/server/insights/http';
import { markViewed } from '@/lib/server/insights/service';

/** Mark saved updates read when opened from history. Does not acknowledge or resolve anything. */
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === 'string' && uuid.test(id)).slice(0, 50) : [];
  if (!ids.length) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const scope = await insightsScope();
    if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ marked: await markViewed(scope, ids) });
  } catch (e) {
    unstable_rethrow(e);
    return NextResponse.json({ error: 'Unable to save' }, { status: 503 });
  }
}
