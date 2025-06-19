import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createSupabaseClient();
    const url = new URL(request.url);
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');

    if (!tokenHash || type !== 'email') {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?reason=invalid_token`);
    }

    // Verify the magic link token with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
    });

    if (error || !data) {
        console.error('Magic link verification failed:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?reason=verification_failed`);
    }

    // Redirect to the dashboard after successful verification
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`);
}