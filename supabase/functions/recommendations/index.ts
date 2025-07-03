// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "https://deno.land/std@0.191.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import OpenAI from "https://esm.sh/openai";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("DATABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );

  console.log("Starting OpenAI recommendation edge function");

  const { data: users, error: usersError } = await supabase.from("users").select("id");

  if (usersError) {
    console.error("Error fetching users:", usersError);
    return;
  }

  for (const user of users) {
    try {
      console.log(`Fetching campaign metrics for user: ${user.id}`);

      const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns_metrics")
        .select(`
          campaign_id,
          name,
          platform_name,
          clicks,
          impressions,
          spend,
          leads,
          reach,
          today_metrics,
          yesterday_metrics,
          last_7d_metrics,
          last_30d_metrics,
          this_month_metrics,
          last_month_metrics,
          ad_accounts!inner(user_id)
          `)
        .eq("ad_accounts.user_id", user.id);

      if (campaignsError || !campaigns || campaigns.length === 0) {
        console.error(
          `Skipping user ${user.id}: ${
            campaignsError ? `Error fetching campaigns: ${campaignsError.message}` : 'No campaigns found'
          }`
        );
        continue;
      }

      const preparedMetrics = campaigns.map((campaign) => ({
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        platform_name: campaign.platform_name,
        clicks: campaign.clicks,
        impressions: campaign.impressions,
        spend: campaign.spend,
        leads: campaign.leads,
        reach: campaign.reach,
        metrics: {
          today: campaign.today_metrics,
          yesterday: campaign.yesterday_metrics,
          last_7_days: campaign.last_7d_metrics,
          last_30_days: campaign.last_30d_metrics,
          this_month: campaign.this_month_metrics,
          last_month: campaign.last_month_metrics,
        },
      }));

      console.log("Starting OpenAI API request");
      const openai = new OpenAI({
        apiKey: Deno.env.get("NEXT_PUBLIC_OPENAI_API_KEY")!,
      });

      const prompt = `
        You are an AI marketing assistant. Based on the campaign metrics below, provide exactly 4 concise recommendations. Between 2-3 of the 4 should include a value-type insight. Each recommendation should be actionable, relevant, and formatted as either "text" or "metric" recommendations. Ensure that each recommendation includes an "icon" field that represents the platform or context of the recommendation. Use the following format for the response:
        
        [
          {
            "type": "text",
            "message": "Consider reallocating budget to high-performing Facebook campaigns.",
            "icon": "/meta.png"
          },
          {
            "type": "metric",
            "message": "Impressions on Instagram are up significantly!",
            "value": 25,
            "icon": "/instagram.png"
          }
        ]
        
        Metrics:
        ${JSON.stringify(preparedMetrics, null, 2)}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful marketing assistant." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      });

      const recommendations = response.choices[0]?.message?.content
        ? JSON.parse(response.choices[0].message.content)
        : [];

      console.log(`Recommendations generated for user ${user.id}: ${recommendations.length}`);
      // Insert recommendations into Supabase
      const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

      await supabase.from("recommendations").upsert({
        user_id: user.id,
        recommendations,
        updated_at: date,
      },
      { onConflict: "user_id" }
    );
      console.log(`Recommendations generated and stored for user: ${user.id}`);
    } catch (error) {
      console.error(`Error generating recommendations for user ${user.id}:`, error);
    }
  }

  console.log("All users processed. Edge function completed.");
  return new Response(
    JSON.stringify({
      message: "Ad account metrics sync complete. All users processed.",
    }),
    { status: 200 }
  );
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/recommendations' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
