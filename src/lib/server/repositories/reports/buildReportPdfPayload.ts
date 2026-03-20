import 'server-only';

import { buildReportPayload } from './buildReportPayload';
import type { ReportQueryInput } from '@/lib/server/reports/types';

export async function buildReportPdfPayload(query: ReportQueryInput) {
  return buildReportPayload(query);
}
