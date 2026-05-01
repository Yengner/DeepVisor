import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  dismissTrendFinding,
  toTrendFindingView,
} from '@/lib/server/intelligence/repositories/trendFindings';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  try {
    const { findingId } = await params;
    const { businessId } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const finding = await dismissTrendFinding(supabase, {
      businessId,
      findingId,
    });

    if (!finding) {
      return NextResponse.json(
        { success: false, error: 'Trend finding not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      finding: toTrendFindingView(finding),
    });
  } catch (error) {
    console.error('Failed to dismiss trend finding:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to dismiss finding.' },
      { status: 500 }
    );
  }
}
