// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// console.log("Hello from Functions!")

// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }

//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/campaign-worker' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

// supabase/functions/campaign-worker/index.ts

// import { createClient } from '@supabase/supabase-js';
// import { supabaseAdmin } from '../../../utils/supabase-server';
// import { createMetaCampaign } from '/Users/yb/Desktop/deepvisor/src/lib/actions/meta/campaign.actions.ts';


// Deno.serve(async () => {
//   const { data } = await sb.rpc('pop', { queue_name: 'create-campaign' });
//   if (!data?.length) return new Response('No job', { status: 204 });

//   const { msg_id: msgId, message: formData } = data[0];

//   const steps = [
//     { key: 'Campaign', fn: () => createMetaCampaign(formData) },
//     // e.g., AdSet, Creative, Ad steps go here...
//   ];

//   for (const { key, fn } of steps) {
//     await supabaseAdmin
//       .from('campaign_job_progress')
//       .insert({ msg_id: msgId, step: key, status: 'loading' });

//     try {
//       const result = await fn();
//       await supabaseAdmin
//         .from('campaign_job_progress')
//         .update({ status: 'success', result_id: result.campaignId || result })
//         .eq('msg_id', msgId).eq('step', key);
//     } catch (err: any) {
//       await supabaseAdmin
//         .from('campaign_job_progress')
//         .update({ status: 'error', error: err.message })
//         .eq('msg_id', msgId).eq('step', key);
//       break;
//     }
//   }

//   await sb.rpc('delete', { queue_name: 'create-campaign', msg_id: msgId });
//   return new Response('OK');
// });

// import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
// import { createMetaCampaign } from '../_shared/campaign-actions.ts';

import { createClient } from "npm:@supabase/supabase-js@2";
import "https://deno.land/std@0.191.0/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("URL") ?? "",
  Deno.env.get("SERVICE_ROLE_KEY") ?? "",
  { db: { schema: "pgmq_public" } },
);
console.log("🚀 campaign-worker initializing");

Deno.serve(async (req) => {
  console.log("📥 Request hit campaign-worker");

  const payload = await req.json().catch(() => ({}));
  console.log("🧾 Payload:", payload);

  console.log("⏳ Calling pop()");
  const { data: jobs, error } = await supabase.rpc("pop", { queue_name: "create_campaign" });

  if (error) {
    console.error("❌ pop() error:", error);
    return new Response("pop error", { status: 500 });
  }
  if (!jobs?.length) {
    console.log("♻️ No jobs in queue");
    return new Response(null, { status: 204 }); 
  }

  const job = jobs[0];
  console.log("✅ Popped:", job.msg_id, job.message);

  // Immediately delete for test
  await supabase.rpc("delete", { queue_name: "create_campaign", message_id: job.msg_id });
  console.log("🗑️ Deleted:", job.msg_id);

  return new Response(JSON.stringify({ success: true, job }), { status: 200 });
});

// supabase/functions/campaign-worker/index.ts
import { queueClient } from './queueClient.ts';
import { createMetaCampaign } from '../_shared/campaign-actions.ts';

console.log('🚀 campaign-worker booting');

Deno.serve(async (_req) => {
  console.log('⏳ Popping job');
  const { data: jobs, error } = await queueClient.rpc('pop', {
    queue_name: 'create_campaign'
  });

  if (error) {
    console.error('❌ pop error:', error);
    return new Response('pop error', { status: 500 });
  }
  if (!jobs?.length) {
    console.log('♻️ No job found');
    return new Response(null, { status: 204 });
  }

  const job = jobs[0];
  console.log('✅ Popped job:', job.msg_id, job.message);

  const { message } = job;
  const { accessToken, ...formData } = message;

  try {
    console.log('⏳ Running createMetaCampaign');
    const result = await createMetaCampaign(formData, accessToken);
    console.log('✅ createMetaCampaign succeeded:', result);
  } catch (err) {
    console.error('❌ createMetaCampaign failed:', err);
  }

  await queueClient.rpc('delete', {
    queue_name: 'create_campaign',
    message_id: job.msg_id
  });
  console.log('🗑️ Deleted job:', job.msg_id);

  return new Response(JSON.stringify({ success: true, msg_id: job.msg_id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

