// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const N8N_WEBHOOK_URL = Deno.env.get("N8N_TASK_WEBHOOK")!;

const VT = 60;        // visibility timeout while processing
const BATCH = 25;
const WAIT = 5;       // long-poll seconds
const POLL_MS = 100;
const BACKOFF = 300;  // retry after 5 min on transient errors

const QUEUES = ["agency_adhoc", "agency_daily_12h", "agency_daily_18h", "agency_daily_22h"];

// Add logging helpers (no timestamps; Supabase already provides them)
const info = (msg: string, meta?: any) =>
  console.log(`[dispatch_queue] ${msg}` + (meta ? ` ${JSON.stringify(meta)}` : ""));
const errorLog = (msg: string, meta?: any) =>
  console.error(`[dispatch_queue] ERROR: ${msg}` + (meta ? ` ${JSON.stringify(meta)}` : ""));

serve(async () => {
  info("dispatch_queue invoked", { queues: QUEUES.length, vt: VT, batch: BATCH });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  for (const q of QUEUES) {
    info(`reading queue`, { queue: q });
    const { data: msgs, error } = await supabase.rpc("q_read", {
      queue: q,
      vt_seconds: VT,
      batch_size: BATCH,
      wait_seconds: WAIT,
      poll_ms: POLL_MS,
    });

    if (error) {
      errorLog(`[${q}] q_read error`, { message: error.message, code: (error as any).code });
      continue;
    }
    if (!msgs || msgs.length === 0) {
      info(`no messages`, { queue: q });
      continue;
    }
    info(`messages received`, { queue: q, count: msgs.length });

    for (const m of msgs) {
      const msgId = (m as any).msg_id as number;
      const message = (m as any).message as any;

      info("processing message", { queue: q, msgId, taskId: message?.task_id });

      // Mark task running (+attempt)
      const { error: markErr } = await supabase.rpc("task_mark_running", { p_id: message.task_id });
      if (markErr) {
        errorLog("task_mark_running failed", { taskId: message.task_id, err: markErr });
      }

      try {
        // Call n8n; it can just echo {ok:true} for V1
        const resp = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(message),
        });

        let body: any = {};
        try { body = await resp.json(); } catch { body = {}; }

        info("n8n response received", { status: resp.status, ok: resp.ok });
        if (resp.ok) {
          const { error: updErr } = await supabase
            .from("tasks")
            .update({ status: "done", result: body, updated_at: new Date().toISOString() })
            .eq("id", message.task_id);
          if (updErr) errorLog("updating task to done failed", { taskId: message.task_id, err: updErr });

          const { error: archErr } = await supabase.rpc("q_archive", { queue: q, p_msg_id: msgId }); // archive for auditing
          if (archErr) errorLog("q_archive failed", { queue: q, msgId, err: archErr });
          else info("task completed and archived", { queue: q, msgId, taskId: message.task_id });
        } else {
          const retryable = resp.status >= 500 || resp.status === 429;
          info("n8n returned non-ok status", { status: resp.status, retryable });
          if (retryable) {
            const { error: vtErr } = await supabase.rpc("q_set_vt", { queue: q, p_msg_id: msgId, vt_seconds: BACKOFF });
            if (vtErr) errorLog("q_set_vt failed", { queue: q, msgId, err: vtErr });
            const { error: queuedErr } = await supabase
              .from("tasks")
              .update({
                status: "queued",
                error: { code: "N8N_ERR", http: resp.status, body },
                updated_at: new Date().toISOString(),
              })
              .eq("id", message.task_id);
            if (queuedErr) errorLog("re-queuing task failed", { taskId: message.task_id, err: queuedErr });
            else info("task re-queued with backoff", { taskId: message.task_id, backoff: BACKOFF });
          } else {
            const { error: dlErr } = await supabase
              .from("tasks")
              .update({
                status: "dead_letter",
                error: { code: "N8N_FATAL", http: resp.status, body },
              })
              .eq("id", message.task_id);
            if (dlErr) errorLog("marking task dead_letter failed", { taskId: message.task_id, err: dlErr });
            const { error: archErr2 } = await supabase.rpc("q_archive", { queue: q, p_msg_id: msgId });
            if (archErr2) errorLog("q_archive failed (dead_letter)", { queue: q, msgId, err: archErr2 });
            else info("task marked dead_letter and archived", { taskId: message.task_id });
          }
        }
      } catch (err) {
        // network/timeout → backoff
        errorLog("network/dispatch error while calling n8n", { err: String(err), queue: q, msgId, taskId: message?.task_id });
        const { error: vtErr2 } = await supabase.rpc("q_set_vt", { queue: q, p_msg_id: msgId, vt_seconds: BACKOFF });
        if (vtErr2) errorLog("q_set_vt failed (catch)", { queue: q, msgId, err: vtErr2 });
        const { error: queuedErr2 } = await supabase
          .from("tasks")
          .update({
            status: "queued",
            error: { code: "DISPATCH_ERR", msg: String(err) },
            updated_at: new Date().toISOString(),
          })
          .eq("id", message.task_id);
        if (queuedErr2) errorLog("re-queuing task failed (catch)", { taskId: message.task_id, err: queuedErr2 });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/dispatch_queue' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
