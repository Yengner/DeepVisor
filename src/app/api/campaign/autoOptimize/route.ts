import { createSupabaseClient } from '@/lib/utils/supabase/clients/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { campaignId, autoOptimize } = await req.json()

    if (!campaignId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = await createSupabaseClient()
    const { error } = await supabase
        .from('campaigns')
        .update({ auto_optimize: autoOptimize })
        .match({ campaign_id: campaignId })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Kick off the supabase Edge function to optimize the campaign
    // const { error: edgeError } = await supabase.functions.invoke('optimize_campaign', {
    //     body: {
    //         campaignId: campaignId,
    //         autoOptimize: autoOptimize,
    //     },
    // })

    return NextResponse.json({ success: true })
}
