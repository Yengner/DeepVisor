import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createReportSavedView, listReportSavedViews } from '@/lib/server/repositories/reports/savedViews';
import { normalizeSavedViewName, normalizeSavedViewQuery } from '@/lib/shared/reports/savedViews';

export async function GET() {
  try {
    const { businessId, user } = await getRequiredAppContext();
    const views = await listReportSavedViews(createAdminClient(), { businessId, userId: user.id });
    return NextResponse.json({ success: true, views });
  } catch (error) {
    console.error('Failed to load saved report views:', error);
    return NextResponse.json({ success: false, error: 'Saved views could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { businessId, user } = await getRequiredAppContext();
  const body = await request.json().catch(() => null) as { name?: unknown; query?: unknown; preset?: unknown } | null;
  const name = normalizeSavedViewName(body?.name);
  const preset = body?.preset === 7 || body?.preset === 30 || body?.preset === 90 ? body.preset : null;
  const query = typeof body?.query === 'string' ? normalizeSavedViewQuery(body.query, preset) : null;
  if (!name || query == null || query.length > 2000) {
    return NextResponse.json({ success: false, error: 'Give the view a name of 1–80 characters.' }, { status: 400 });
  }
  try {
    const view = await createReportSavedView(createAdminClient(), { businessId, userId: user.id, name, query });
    return NextResponse.json({ success: true, view });
  } catch (error) {
    console.error('Failed to save report view:', error);
    const message = error instanceof Error && error.message.startsWith('A business can keep') ? error.message : 'The view could not be saved.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
