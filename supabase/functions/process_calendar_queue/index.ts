// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? Deno.env.get("SITE_URL");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");

async function secretFingerprint(value: string | null): Promise<string | null> {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `${value.length}:${hex.slice(0, 10)}`;
}

function readCronSecrets(req: Request): {
  expected: string | null;
  headerSecret: string | null;
  bearerSecret: string | null;
} {
  const want = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const authorization = req.headers.get("authorization");
  const bearerSecret = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;

  return {
    expected: want,
    headerSecret,
    bearerSecret,
  };
}

function checkCronSecret(secrets: {
  expected: string | null;
  headerSecret: string | null;
  bearerSecret: string | null;
}): boolean {
  if (Deno.env.get("SKIP_CRON_SECRET") === "true") return true;
  if (!secrets.expected) return true;
  return secrets.headerSecret === secrets.expected || secrets.bearerSecret === secrets.expected;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function positiveNumber(value: unknown, fallback: number): number {
  const numberValue = typeof value === "string" || typeof value === "number"
    ? Number(value)
    : Number.NaN;

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isLocalAppBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

serve(async (req) => {
  const cronSecrets = readCronSecrets(req);

  if (Deno.env.get("SKIP_CRON_SECRET") === "true") {
    console.warn("[process_calendar_queue] cron secret check skipped by SKIP_CRON_SECRET");
  }

  if (!checkCronSecret(cronSecrets)) {
    console.warn("[process_calendar_queue] rejected cron request", {
      hasExpectedSecret: Boolean(cronSecrets.expected),
      hasCronSecretHeader: Boolean(cronSecrets.headerSecret),
      hasAuthorizationHeader: Boolean(req.headers.get("authorization")),
      expectedFingerprint: await secretFingerprint(cronSecrets.expected),
      headerFingerprint: await secretFingerprint(cronSecrets.headerSecret),
      bearerFingerprint: await secretFingerprint(cronSecrets.bearerSecret),
    });
    return new Response("forbidden", { status: 403 });
  }

  if (!APP_BASE_URL) {
    return new Response("APP_BASE_URL is not configured", { status: 500 });
  }

  if (isLocalAppBaseUrl(APP_BASE_URL) && Deno.env.get("ALLOW_LOCALHOST_APP_BASE_URL") !== "true") {
    console.error("[process_calendar_queue] APP_BASE_URL points to localhost in deployed runtime", {
      appBaseUrl: APP_BASE_URL,
    });
    return new Response(
      "APP_BASE_URL points to localhost. Set APP_BASE_URL to the deployed Next.js app URL for the Supabase Edge Function.",
      { status: 500 },
    );
  }

  if (!INTERNAL_API_KEY) {
    return new Response("INTERNAL_API_KEY is not configured", { status: 500 });
  }

  const requestUrl = new URL(req.url);
  const jsonBody = await readJsonBody(req);
  const limit = positiveNumber(requestUrl.searchParams.get("limit") ?? jsonBody.limit, 25);
  const lookbackDays = positiveNumber(
    requestUrl.searchParams.get("lookback_days") ??
      requestUrl.searchParams.get("lookbackDays") ??
      jsonBody.lookbackDays ??
      jsonBody.lookback_days,
    14,
  );
  const businessId = optionalString(requestUrl.searchParams.get("business_id") ?? jsonBody.businessId);
  const adAccountId = optionalString(requestUrl.searchParams.get("ad_account_id") ?? jsonBody.adAccountId);
  const targetUrl = new URL("/api/calendar/queue/process", APP_BASE_URL);
  const startedAt = Date.now();

  console.info("[process_calendar_queue] forwarding request", {
    targetOrigin: targetUrl.origin,
    limit,
    lookbackDays,
    businessScoped: Boolean(businessId),
    adAccountScoped: Boolean(adAccountId),
  });

  const resp = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      limit,
      lookbackDays,
      businessId,
      adAccountId,
    }),
  });

  const responseBody = await resp.text();

  console.info("[process_calendar_queue] app response", {
    status: resp.status,
    elapsedMs: Date.now() - startedAt,
    contentType: resp.headers.get("content-type"),
  });

  return new Response(responseBody, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") ?? "application/json",
    },
  });
});
