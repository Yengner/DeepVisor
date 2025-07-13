import { getDateRangeForLast365Days, getDateRangeForLastDays } from "/Users/yb/Desktop/deepvisor/supabase/functions/utils/getDynamicTimeRanges.ts";

export async function fetchMetaAdAccountMetrics(ad_account_id: string, accessToken: string) {
  console.log(`Fetching Meta metrics for ad account: ${ad_account_id}`);

  const datePresets = ["maximum"]; // Only maximum preset
  const dynamicIncrements = [
    { increment: "1", range: getDateRangeForLastDays(7) }, // Daily for the last 7 days
    { increment: "7", range: getDateRangeForLastDays(56) }, // Weekly for the last 8 weeks
    { increment: "30", range: getDateRangeForLastDays(365) }, // Monthly for the current year
  ];

  // Prepare batch requests for both date presets and increments
  const batchBody = [
    // Date presets (like "maximum")
    ...datePresets.map((preset) => ({
      method: "GET",
      relative_url: `/${ad_account_id}/insights?fields=clicks,impressions,spend,reach,actions,cpm,ctr,cpc,date_start,date_stop&date_preset=${preset}`,
    })),
    // Dynamic increments
    ...dynamicIncrements.map(({ increment, range }) => ({
      method: "GET",
      relative_url: `/${ad_account_id}/insights?fields=clicks,impressions,spend,reach,actions,cpm,ctr,cpc,date_start,date_stop&time_range=${JSON.stringify(
        range
      )}&time_increment=${increment}`,
    })),
  ];

  const batchUrl = `https://graph.facebook.com/v23.0`;

  try {
    // Send the batched request
    const response = await fetch(batchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch: batchBody }),
    });

    if (!response.ok) {
      console.error("Batch API request failed:", await response.text());
      throw new Error(`Failed to fetch Meta ad account metrics for ad account: ${ad_account_id}`);
    }

    const results = await response.json();

    let maximumMetrics = null; // Aggregated metrics
    const incrementMetrics = {}; // Time-based metrics

    results.forEach((result, index) => {
      if (result.code === 200) {
        const insights = JSON.parse(result.body).data || [];

        // Process "maximum" preset
        if (index < datePresets.length && datePresets[index] === "maximum") {
          const aggregated = insights.reduce((acc, entry) => {
              const actions = entry.actions || [];
              return {
                clicks: acc.clicks + parseInt(entry.clicks || 0, 10),
                impressions: acc.impressions + parseInt(entry.impressions || 0, 10),
                spend: acc.spend + parseFloat(entry.spend || 0),
                reach: acc.reach + parseInt(entry.reach || 0, 10),
                cpm: acc.cpm + parseFloat(entry.cpm || 0),
                ctr: acc.ctr + parseFloat(entry.ctr || 0),
                cpc: acc.cpc + parseFloat(entry.cpc || 0),
                leads: parseInt(actions.find((action) => action.action_type === "onsite_conversion.lead_grouped")?.value || 0, 10),
                link_clicks: parseInt(actions.find((action) => action.action_type === "link_click")?.value || 0,10),
                messages: parseInt(actions.find((action) => action.action_type === "onsite_conversion.total_messaging_connection")?.value || 0,10)
              };
            },
            {
              clicks: 0,
              impressions: 0,
              spend: 0,
              reach: 0,
              cpm: 0,
              ctr: 0,
              cpc: 0,
              leads: 0,
              link_clicks: 0,
              messages: 0,
            }
          );
          maximumMetrics = {
            ad_account_id,
            ...aggregated,
            updated_at: new Date().toISOString(),
          };
        } else {
          // Process time increments
          const increment = dynamicIncrements[index - datePresets.length].increment;
          incrementMetrics[increment] = insights.map((entry: any) => {
            const actions = entry.actions || [];
            return {
              date_start: entry.date_start,
              date_stop: entry.date_stop,
              spend: parseFloat(entry.spend || 0),
              clicks: parseInt(entry.clicks || 0, 10),
              impressions: parseInt(entry.impressions || 0, 10),
              reach: parseInt(entry.reach || 0, 10),
              actions: actions.reduce((actionAcc: any, action: any) => {
                actionAcc[action.action_type] = parseInt(action.value || 0, 10);
                return actionAcc;
              }, {}),
            };
          });
        }
      } else {
        console.error(`Error in batch response for index ${index}:`, result);
      }
    });

    return { maximumMetrics, incrementMetrics };
  } catch (error) {
    console.error("Error fetching ad account metrics:", error);
    throw new Error("Failed to fetch ad account metrics.");
  }
}