import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';

export async function DELETE(req: NextRequest) {
    const { userId, campaignId } = await req.json();

    if (!userId || !campaignId) {
        return NextResponse.json({ error: 'Missing userId or campaignId' }, { status: 400 });
    }

    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from('platform_integrations')
        .select('access_token')
        .eq('user_id', userId)
        .eq('platform_name', 'meta')
        .single();

    const accessToken = data?.access_token;

    if (error || !data?.access_token) {
        return NextResponse.json({ error: 'Failed to retrieve access token' }, { status: 500 });
    }

    try {
        const response = await fetch(
            `${process.env.FACEBOOK_GRAPH_API_BASE_URL}/${campaignId}`,
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_token: accessToken,
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: err }, { status: response.status });
        }

        const result = await response.json();
        return NextResponse.json(result, { status: 200 });
    } catch (err) {
        console.error('Meta deletion error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
