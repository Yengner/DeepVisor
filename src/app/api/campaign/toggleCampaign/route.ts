import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { userId, campaignId, newStatus } = await req.json();

    if (!campaignId || !userId) {
        return NextResponse.json({ error: 'Missing campaignId or userId' }, { status: 400 });
    }

    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from('platform_integrations')
        .select('access_token')
        .eq('user_id', userId)
        .eq('platform_name', 'meta') // Assuming 'meta' is the platform name | Will change this once we have more than just meta
        .single();

    const accessToken = data?.access_token;

    if (error || !data?.access_token) {
        return NextResponse.json({ error: 'Failed to retrieve access token' }, { status: 500 });
    }

    const fbStatus = newStatus ? 'ACTIVE' : 'PAUSED';
    const url = `${process.env.FACEBOOK_GRAPH_API_BASE_URL}/${campaignId}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: fbStatus,
                access_token: accessToken,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: errorText || 'Failed to chnage state of campaign' },
                { status: response.status }
            );
        }

        let result;
        try {
            result = await response.json();
        } catch {
            result = {};
        }

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('Error chnaging status of campaign:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
