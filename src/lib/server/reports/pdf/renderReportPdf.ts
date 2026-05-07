import 'server-only';

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { createAdminClient } from '@/lib/server/supabase/admin';
import { buildDemoReportPayload } from '@/lib/server/reports/demo';
import type { ReportPayload, ReportQueryInput } from '@/lib/server/reports/types';
import { buildReportPdfPayload } from '@/lib/server/repositories/reports/buildReportPdfPayload';
import { ReportPdfDocument } from './ReportPdfDocument';

export function toReportFileName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  );
}

export async function renderReportPdfBuffer(input: {
  query: ReportQueryInput;
  organizationName: string;
  demo?: boolean;
  supabase?: ReturnType<typeof createAdminClient>;
}): Promise<{
  buffer: Buffer;
  payload: ReportPayload;
  fileName: string;
}> {
  const payload = input.demo
    ? buildDemoReportPayload(input.query, input.organizationName)
    : await buildReportPdfPayload(input.query, input.supabase);
  const document = React.createElement(
    ReportPdfDocument,
    { payload }
  ) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(document);

  return {
    buffer,
    payload,
    fileName: `${toReportFileName(payload.export.title)}-report.pdf`,
  };
}
