// supabase/functions/dv-queue-worker/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const POP_SQL = `select * from pgmq.pop('dv_jobs', 600);`;     // 10 min VT
const DELETE_SQL = `select pgmq.delete('dv_jobs', $1) as ok;`;

const LANGGRAPH_URL = Deno.env.get("LANGGRAPH_URL")!;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // pop one
  const { data: popped, error: popErr } = await supabase.rpc("exec_sql", { sql: POP_SQL });
  if (popErr) return new Response(popErr.message, { status: 500 });
  const rows = Array.isArray(popped) ? popped : [];
  if (rows.length === 0) return new Response("no-jobs", { status: 204 });

  const msg = rows[0];
  const payload = msg.message;

  // serialize per job (optional but recommended)
  const { data: active } = await supabase
    .from("ai_runs")
    .select("id").eq("job_id", payload.jobId)
    .in("status", ["queued","running"]).maybeSingle();
  if (active) return new Response("busy", { status: 202 });

  // create run
  const { data: runIns, error: runErr } = await supabase
    .from("ai_runs")
    .insert({ job_id: payload.jobId, status: "running", started_at: new Date().toISOString() })
    .select("id").single();
  if (runErr) return new Response(runErr.message, { status: 500 });
  const runId = runIns.id;

  try {
    const lg = await fetch(LANGGRAPH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, ...payload })
    });
    if (!lg.ok) throw new Error(await lg.text());

    await supabase.from("ai_runs")
      .update({ status: "succeeded", finished_at: new Date().toISOString() })
      .eq("id", runId);

    await supabase.rpc("exec_sql", { sql: DELETE_SQL, params: [msg.msg_id] });
    return new Response("ok");
  } catch (e) {
    await supabase.from("ai_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: { message: String(e) } })
      .eq("id", runId);
    return new Response("failed", { status: 500 });
  }
});
