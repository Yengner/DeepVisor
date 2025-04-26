// Future idea///

// // Follow this setup guide to integrate the Deno language server with your editor:
// // https://deno.land/manual/getting_started/setup_your_environment
// // This enables autocomplete, go to definition, etc.

// // Setup type definitions for built-in Supabase Runtime APIs
// import "https://deno.land/std@0.191.0/dotenv/load.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js";
// import { fetchPostData } from "./fetchPostData.ts";


// Deno.serve(async () => {
//   const supabase = createClient(
//     Deno.env.get("SUPABASE_URL")!,
//     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
//   );

//   const { data: camps } = await supabase
//     .from("campaigns")
//     .select("id,user_id,daily_budget,objective,vertical")
//     .eq("auto_optimize", true);

//   // 2) Load ML model ONCE
//   const modelBytes = await supabase.storage
//     .from("models")
//     .download("latest.onnx");
//   const model = await loadModel(modelBytes);

//   for (const c of camps) {
//     // 3) Gather features for this campaign
//     const { data: feats } = await supabase
//       .from("campaign_features")
//       .select("avg_cpa_7d,ctr_trend_7d,spend_pct,objective,vertical")
//       .eq("campaign_id", c.id)
//       .order("timestamp", { ascending: false })
//       .limit(1);

//     if (!feats?.[0]) continue;
//     const inputs = feats[0];

//     // 4) Score model to get an action
//     const action = await scoreFeatures(model, inputs);
//     // e.g. action = { type:"update_budget", value:8500 } or { type:"pause_adset", adsetId:"..." }

//     // 5) Apply the action via your Next.js API
//     const urlBase = Deno.env.get("NEXT_PUBLIC_BASE_URL");
//     switch (action.type) {
//       case "update_budget":
//         await fetch(`${urlBase}/api/campaign/updateBudget`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             userId: c.user_id,
//             campaignId: c.id,
//             newBudget: action.value
//           }),
//         });
//         break;
//       case "pause_adset":
//         await fetch(`${urlBase}/api/campaign/toggleAdSet`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             userId: c.user_id,
//             adsetId: action.adsetId,
//             newStatus: false
//           }),
//         });
//         break;
//       // …other action types…
//     }
//   }

//   return new Response("Optimized.");

// });