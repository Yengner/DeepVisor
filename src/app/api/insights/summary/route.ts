import { NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { insightsScope } from '@/lib/server/insights/http';
import { unreadSummary } from '@/lib/server/insights/service';

const headers = { 'Cache-Control': 'private, no-store' };
/** Read-only counts for the Overview entry point. Never prepares or claims a presentation. */
export async function GET() {
  try {
    const scope = await insightsScope();
    if (!scope) return NextResponse.json({ unread: 0, openIssues: 0, latest: null }, { headers });
    return NextResponse.json(await unreadSummary(scope), { headers });
  } catch (e) {
    unstable_rethrow(e);
    return NextResponse.json({ error: 'Updates are temporarily unavailable' }, { status: 503, headers });
  }
}
