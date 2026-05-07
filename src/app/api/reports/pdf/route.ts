import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { parseReportQueryInput } from '@/lib/server/reports/query';
import { renderReportPdfBuffer } from '@/lib/server/reports/pdf/renderReportPdf';

export const runtime = 'nodejs';

function isTruthySearchParam(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const query = parseReportQueryInput(
      context.businessId,
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const { buffer, fileName } = await renderReportPdfBuffer({
      query,
      organizationName: context.organizationName,
      demo: isTruthySearchParam(request.nextUrl.searchParams.get('demo')),
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Failed to export report PDF:', error);

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to export report PDF',
      },
      { status: 500 }
    );
  }
}
