import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync_user_ad_data`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Using the anon key here; adjust according to your security requirements.
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: errorText || 'Failed to refresh campaigns data' },
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
        console.error('Error refreshing campaigns data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
