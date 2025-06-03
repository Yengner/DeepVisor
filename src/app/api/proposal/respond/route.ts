import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createSupabaseClient();
    const { token, action, notes } = (await request.json()) as {
        token: string;
        action: 'accept' | 'revision';
        notes?: string;
    };

    const { data: session, error: fetchError } = await supabase
        .from('proposal_sessions')
        .select('status')
        .eq('token', token)
        .single();

    if (fetchError || !session) {
        return NextResponse.json({ message: 'Invalid or expired link.' }, { status: 404 });
    }

    // 2) If already responded, return OK
    if (session.status !== 'sent') {
        return NextResponse.json({ message: 'Already responded.' });
    }

    // 3) Update status & responded_at (and revision_notes if applicable)
    const updates: any = {
        status: action === 'accept' ? 'accepted' : 'revision_requested',
        responded_at: new Date().toISOString(),
    };
    if (action === 'revision' && notes) {
        updates.revision_notes = notes;
    }

    const { error: updateError } = await supabase
        .from('proposal_sessions')
        .update(updates)
        .eq('token', token);

    if (updateError) {
        console.error('Supabase update error:', updateError);
        return NextResponse.json({ message: 'Failed to record response.' }, { status: 500 });
    }

    // 4) (Optional) Trigger any HubSpot or Slack notifications here if desired.

    return NextResponse.json({ message: 'Response recorded.' });
}
