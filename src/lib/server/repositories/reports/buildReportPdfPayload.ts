import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { buildReportPayload } from './buildReportPayload';
import type { ReportQueryInput } from '@/lib/server/reports/types';

export async function buildReportPdfPayload(
  query: ReportQueryInput,
  supabase?: SupabaseClient<Database>
) {
  return buildReportPayload(query, supabase);
}
