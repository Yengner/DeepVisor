import { createSupabaseClient } from "@/lib/server/supabase/server";
import { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType || 'signup';

    if (!token_hash || !type) {
        return NextResponse.redirect('/login?error=missing_verification_params');
    }

    const supabase = await createSupabaseClient();

    const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
    })

    if (error) {
        return NextResponse.redirect(new URL('/login?error=verification_failed', request.url));
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
}
