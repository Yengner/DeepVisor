import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createSupabaseClient();
        const loggedIn = await getLoggedInUser();
        const userId = loggedIn?.id;

        const { data: pages, error } = await supabase
            .from('meta_pages')
            .select('page_id, name, instagram_account_id')
            .eq('user_id', userId);

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json({
                success: false,
                error: "Failed to retrieve Facebook pages"
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            pages: pages
        });

    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({
            success: false,
            error: "Internal server error"
        }, { status: 500 });
    }
}