// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? Deno.env.get("SITE_URL");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

function checkCronSecret(req: Request): boolean {
  const want = Deno.env.get("CRON_SECRET");
  if (!want) return true;
  return req.headers.get("x-cron-secret") === want;
}

serve(async (req) => {
  if (!checkCronSecret(req)) {
    return new Response("forbidden", { status: 403 });
  }

  if (!APP_BASE_URL) {
    return new Response("APP_BASE_URL is not configured", { status: 500 });
  }

  if (!INTERNAL_API_KEY) {
    return new Response("INTERNAL_API_KEY is not configured", { status: 500 });
  }

  const requestUrl = new URL(req.url);
  const limit = requestUrl.searchParams.get("limit") ?? "1";
  const targetUrl = new URL("/api/integrations/meta/process-backfill-jobs", APP_BASE_URL);

  const resp = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      limit: Number(limit) > 0 ? Number(limit) : 1,
    }),
  });

  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") ?? "application/json",
    },
  });
});
