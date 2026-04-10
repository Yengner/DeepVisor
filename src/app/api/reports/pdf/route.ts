import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { buildDemoReportPayload } from '@/lib/server/reports/demo';
import { parseReportQueryInput } from '@/lib/server/reports/query';
import { buildReportPdfPayload } from '@/lib/server/repositories/reports/buildReportPdfPayload';
import { ReportPdfDocument } from '@/lib/server/reports/pdf/ReportPdfDocument';

export const runtime = 'nodejs';

function toFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

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
    const payload = isTruthySearchParam(request.nextUrl.searchParams.get('demo'))
      ? buildDemoReportPayload(query, context.organizationName)
      : await buildReportPdfPayload(query);
    const document = React.createElement(
      ReportPdfDocument,
      { payload }
    ) as unknown as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(document);
    const fileName = `${toFileName(payload.export.title)}-report.pdf`;

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
