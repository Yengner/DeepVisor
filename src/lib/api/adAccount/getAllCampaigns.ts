const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    };
    return new Date(dateStr).toLocaleDateString('en-US', options);
};


export async function getAllCampaigns(supabase: any, platform: string, adAccountId: string) {

    const { data, error } = await supabase
        .from('campaigns_metrics')
        .select(
            'campaign_id, name, status, objective, raw_data, start_date, platform_name, clicks, impressions, spend, leads, reach, link_clicks, messages, cpm, ctr, cpc, end_date, today_metrics, yesterday_metrics, auto_optimize'
        )
        .eq('platform_name', platform)
        .eq('ad_account_id', adAccountId);

    if (error) {
        console.error('Error fetching campaign data:', error);
        throw new Error(`Failed to fetch campaign data: ${error.message}`);
    }

    if (!data || data.length === 0) {
        console.warn("No campaign data found for the given platform and ad account.");
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((campaign: any) => ({
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        raw_data: campaign.raw_data,
        clicks: Number(campaign.clicks),
        impressions: Number(campaign.impressions),
        spend: Number(campaign.spend).toFixed(2),
        leads: Number(campaign.leads),
        reach: Number(campaign.reach),
        link_clicks: Number(campaign.link_clicks),
        messages: Number(campaign.messages),
        cpm: Number(campaign.cpm).toFixed(2),
        ctr: Number(campaign.ctr).toFixed(2),
        cpc: Number(campaign.cpc).toFixed(2),
        start_date: formatDate(campaign.start_date),
        end_date: formatDate(campaign.end_date),
        today_metrics: campaign.today_metrics,
        yesterday_metrics: campaign.yesterday_metrics,
        platform_name: campaign.platform_name,
        auto_optimize: campaign.auto_optimize,
    }));
}
