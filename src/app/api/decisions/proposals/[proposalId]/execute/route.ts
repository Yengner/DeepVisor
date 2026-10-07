import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { executeMetaProposal } from '@/lib/server/advertising/executeMetaProposal';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  // Cookie-authenticated mutation: require a same-origin request, not a cross-site form.
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { proposalId } = await params;
  if (!z.string().uuid().safeParse(proposalId).success) return NextResponse.json({ error: 'Invalid proposal' }, { status: 400 });
  const { businessId, role } = await getRequiredAppContext();
  if (!['owner', 'admin'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json(await executeMetaProposal(createAdminClient(), { businessId, role, proposalId }));
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json({ error: 'Execution was not confirmed. Check the execution audit before any further action.' }, { status: 409 });
  }
}
