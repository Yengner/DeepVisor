import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { deleteReportSavedView } from '@/lib/server/repositories/reports/savedViews';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { businessId, user } = await getRequiredAppContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: 'Unknown view.' }, { status: 400 });
  try {
    const deleted = await deleteReportSavedView(createAdminClient(), { businessId, userId: user.id, id });
    return deleted
      ? NextResponse.json({ success: true })
      : NextResponse.json({ success: false, error: 'Only the person who saved a view can delete it.' }, { status: 404 });
  } catch (error) {
    console.error('Failed to delete report view:', error);
    return NextResponse.json({ success: false, error: 'The view could not be deleted.' }, { status: 500 });
  }
}
