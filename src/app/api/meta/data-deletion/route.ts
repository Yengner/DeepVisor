import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getBaseUrl } from '@/lib/server/integrations/service';
import { parseMetaSignedRequest } from '@/lib/server/privacy/signedRequest';
import { deleteMetaDataForMetaUser } from '@/lib/server/privacy/metaDeletion';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };

/**
 * Meta's Data Deletion Request Callback. Meta POSTs `signed_request` (form encoded) when a person
 * removes DeepVisor in their Facebook settings and asks for their data to be deleted. Only a
 * request signed with META_APP_SECRET is accepted. Responds with a status page and confirmation
 * code, as Meta requires.
 */
export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    const form = await request.formData();
    raw = form.get('signed_request');
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers });
  }
  const signed = parseMetaSignedRequest(raw, process.env.META_APP_SECRET);
  if (!signed) return NextResponse.json({ error: 'invalid_signature' }, { status: 400, headers });

  const result = await deleteMetaDataForMetaUser(createAdminClient(), signed.userId);
  const url = new URL('/data-deletion', getBaseUrl(request.url));
  url.searchParams.set('code', result.code);
  return NextResponse.json({ url: url.toString(), confirmation_code: result.code }, { headers });
}
