import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { downloadArchivedReportPdf } from '@/lib/server/reports/pdf/archiveStorage';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { asRecord } from '@/lib/shared';

export const runtime = 'nodejs';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getArchivedReportRef(payloadJson: unknown): {
  bucket: string;
  path: string;
  fileName: string;
} | null {
  const payload = asRecord(payloadJson);
  const execution = asRecord(payload.execution);
  const action = asRecord(execution.action);
  const bucket = asString(action.storageBucket);
  const path = asString(action.storagePath);

  if (action.type !== 'report_pdf' || !bucket || !path) {
    return null;
  }

  return {
    bucket,
    path,
    fileName: asString(action.fileName) ?? 'report.pdf',
  };
}

function shouldDownload(request: Request): boolean {
  const url = new URL(request.url);
  const value = url.searchParams.get('download');

  return value === '1' || value === 'true' || value === 'yes';
}

export async function GET(
  request: Request,
  context: { params: Promise<{ queueItemId: string }> }
) {
  try {
    const { queueItemId } = await context.params;
    const { businessId } = await getRequiredAppContext();
    const adminSupabase = createAdminClient();
    const { data: queueItem, error } = await adminSupabase
      .from('calendar_queue_items')
      .select('id, business_id, item_type, status, payload_json')
      .eq('id', queueItemId)
      .eq('business_id', businessId)
      .eq('item_type', 'review_report')
      .eq('status', 'completed')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!queueItem) {
      return NextResponse.json({ error: 'Archived report not found' }, { status: 404 });
    }

    const reportRef = getArchivedReportRef(queueItem.payload_json);

    if (!reportRef) {
      return NextResponse.json(
        { error: 'Archived report PDF is not stored yet' },
        { status: 404 }
      );
    }

    const blob = await downloadArchivedReportPdf(adminSupabase, reportRef);
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${
          shouldDownload(request) ? 'attachment' : 'inline'
        }; filename="${reportRef.fileName}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Failed to download archived report PDF:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to download archived report PDF',
      },
      { status: 500 }
    );
  }
}
