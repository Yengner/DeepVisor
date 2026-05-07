import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';

type ReportArchiveClient = SupabaseClient<Database>;

export const REPORT_ARCHIVE_BUCKET =
  process.env.REPORT_ARCHIVE_BUCKET || 'report-archive-pdfs';

function safePathSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  );
}

async function ensureReportArchiveBucket(supabase: ReportArchiveClient): Promise<void> {
  const { error: getError } = await supabase.storage.getBucket(REPORT_ARCHIVE_BUCKET);

  if (!getError) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(REPORT_ARCHIVE_BUCKET, {
    public: false,
    allowedMimeTypes: ['application/pdf'],
    fileSizeLimit: 20 * 1024 * 1024,
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }
}

export function buildArchivedReportStoragePath(input: {
  businessId: string;
  queueItemId: string;
  dateTo: string;
  fileName: string;
}): string {
  return [
    safePathSegment(input.businessId),
    safePathSegment(input.dateTo),
    safePathSegment(input.queueItemId),
    safePathSegment(input.fileName),
  ].join('/');
}

export async function uploadArchivedReportPdf(
  supabase: ReportArchiveClient,
  input: {
    businessId: string;
    queueItemId: string;
    dateTo: string;
    fileName: string;
    buffer: Buffer;
  }
): Promise<{
  bucket: string;
  path: string;
  sizeBytes: number;
}> {
  await ensureReportArchiveBucket(supabase);

  const path = buildArchivedReportStoragePath(input);
  const { error } = await supabase.storage
    .from(REPORT_ARCHIVE_BUCKET)
    .upload(path, input.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return {
    bucket: REPORT_ARCHIVE_BUCKET,
    path,
    sizeBytes: input.buffer.byteLength,
  };
}

export async function downloadArchivedReportPdf(
  supabase: ReportArchiveClient,
  input: {
    bucket: string;
    path: string;
  }
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(input.bucket).download(input.path);

  if (error || !data) {
    throw error ?? new Error('Archived report PDF was not found');
  }

  return data;
}
