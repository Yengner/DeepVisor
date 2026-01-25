// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ScheduleWindow = "12h" | "18h" | "22h";

// Use NY time regardless of server TZ
function nyHour(d = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false });
  return Number(fmt.format(d));
}
function inferWindowET(now = new Date()): ScheduleWindow {
  const h = nyHour(now);
  if (h < 12) return "12h";
  if (h < 18) return "18h";
  if (h < 22) return "22h";
  return "12h";
}
const queueForWindow = (w: ScheduleWindow) =>
  ({ "12h": "agency_daily_12h", "18h": "agency_daily_18h", "22h": "agency_daily_22h" } as const)[w];

const info = (msg: string, meta?: any) => console.log(`[materialize_daily_tasks] ${msg}${meta ? " " + JSON.stringify(meta) : ""}`);
const errorLog = (msg: string, meta?: any) => console.error(`[materialize_daily_tasks] ERROR: ${msg}${meta ? " " + JSON.stringify(meta) : ""}`);

// Optional: protect with a shared secret
function checkCronSecret(req: Request): boolean {
  const want = Deno.env.get("CRON_SECRET");
  if (!want) return true;
  return req.headers.get("x-cron-secret") === want;
}

serve(async (req) => {
  if (!checkCronSecret(req)) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const forced = url.searchParams.get("window") as ScheduleWindow | null;
  const onlyAccount = url.searchParams.get("ad_account_id"); // optional filter for testing
  const scheduleWindow = forced ?? inferWindowET();
  info("invoked", { forcedWindow: forced, resolvedWindow: scheduleWindow, onlyAccount });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch eligible accounts (adjust filter to your schema)
  let query = supabase
    .from("ad_accounts")
    .select("id, user_id, platform_name, external_account_id, agency_enabled")
    .eq("agency_enabled", true);

  if (onlyAccount) query = query.eq("id", onlyAccount);

  const { data: accounts, error } = await query;
  if (error) {
    errorLog("failed to fetch accounts", { message: error.message, code: (error as any).code });
    return new Response(error.message, { status: 500 });
  }
  info("accounts fetched", { count: accounts?.length ?? 0 });

  const todayUTC = new Date().toISOString().slice(0, 10);

  for (const a of accounts ?? []) {
    // normalize vendor to match tasks.vendor CHECK constraint
    const vendor = (a.platform_name || "").toLowerCase(); // expect 'meta' | 'google' | 'tiktok'
    const payload = {
      tenant_id: a.user_id,
      ad_account_id: a.id,
      vendor,
      external_account_id: a.external_account_id,
      type: "daily_kpi_scan",
      schedule_window: scheduleWindow,
      params: { lookback_days: 1, baseline_days: 7 }
    };

    // Try to insert; on unique violation, fetch existing
    const { data: inserted, error: insertErr } = await supabase
      .from("tasks")
      .insert({
        tenant_id: a.user_id,
        ad_account_id: a.id,
        vendor,
        type: "daily_kpi_scan",
        approval_policy: "auto",
        schedule_window: scheduleWindow,
        status: "scheduled",          // <-- IMPORTANT
        scheduled_at: new Date().toISOString(),
        payload,
        dedupe_key: `daily_kpi_scan:${a.id}:${scheduleWindow}:${todayUTC}`,
      })
      .select("*")
      .single();

    let task = inserted;
    if (insertErr) {
      // If it's not a unique violation, surface it
      const code = (insertErr as any)?.code;
      if (code !== "23505") {
        errorLog("insert failed", { code, msg: insertErr.message, ad_account_id: a.id });
        continue;
      }
      // Fetch existing task for today/window
      const { data: existing, error: getErr } = await supabase
        .from("tasks")
        .select("*")
        .eq("tenant_id", a.user_id)
        .eq("ad_account_id", a.id)
        .eq("type", "daily_kpi_scan")
        .eq("schedule_window", scheduleWindow)
        .gte("scheduled_at", `${todayUTC}T00:00:00Z`)
        .lte("scheduled_at", `${todayUTC}T23:59:59Z`)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .single();

      if (getErr || !existing) {
        errorLog("dedupe fetch failed", { ad_account_id: a.id, msg: getErr?.message });
        continue;
      }
      task = existing;
      info("dedupe: using existing task", { task_id: task.id, status: task.status });
    }

    if (!task) continue;

    // Only enqueue if it's not already queued/running/done
    const message = {
      task_id: task.id,
      workflow: "agency.kpi_scan",
      vendor,
      tenant_id: a.user_id,
      ad_account: { row_id: a.id, external_id: a.external_account_id },
      params: payload.params,
      schedule_window: scheduleWindow
    };

    const { data: sendId, error: sendErr } = await supabase.rpc("q_send", {
      queue: queueForWindow(scheduleWindow),
      payload: message,
      delay_seconds: 0,
    });

    if (sendErr) {
      errorLog("q_send failed", { task_id: task.id, err: sendErr });
      continue;
    }

    await supabase.from("tasks").update({ status: "queued", updated_at: new Date().toISOString() }).eq("id", task.id);
    info("enqueued", { task_id: task.id, queue: queueForWindow(scheduleWindow), msg_id: sendId });
  }

  return new Response(JSON.stringify({ ok: true, window: scheduleWindow }), { status: 200 });
});
