// deno-lint-ignore-file no-explicit-any
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? Deno.env.get("SITE_URL");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const MAX_QUEUE_LIMIT = 100;
const MAX_LOOKBACK_DAYS = 30;
const MAX_STALE_AFTER_MINUTES = 24 * 60;

type CronSecrets = {
  expected: string | null;
  headerSecret: string | null;
  bearerSecret: string | null;
};

async function secretFingerprint(value: string | null): Promise<string | null> {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `${value.length}:${hex.slice(0, 10)}`;
}

function readCronSecrets(req: Request): CronSecrets {
  const authorization = req.headers.get("authorization");
  const bearerSecret = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;

  return {
    expected: Deno.env.get("CRON_SECRET"),
    headerSecret: req.headers.get("x-cron-secret"),
    bearerSecret,
  };
}

function checkCronSecret(secrets: CronSecrets): boolean {
  if (Deno.env.get("SKIP_CRON_SECRET") === "true") return true;
  if (!secrets.expected) return true;

  return secrets.headerSecret === secrets.expected || secrets.bearerSecret === secrets.expected;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function positiveInteger(value: unknown, fallback: number, max: number): number {
  const numberValue = typeof value === "string" || typeof value === "number"
    ? Number(value)
    : Number.NaN;

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(numberValue), max);
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

export async function handleQueueAccountSyncJobsRequest(
  req: Request,
  functionName = "queue_account_sync_jobs",
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const cronSecrets = readCronSecrets(req);

  if (Deno.env.get("SKIP_CRON_SECRET") === "true") {
    console.warn(`[${functionName}] cron secret check skipped by SKIP_CRON_SECRET`);
  }

  if (!checkCronSecret(cronSecrets)) {
    console.warn(`[${functionName}] rejected cron request`, {
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
    console.error(`[${functionName}] APP_BASE_URL points to localhost in deployed runtime`, {
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
  const limit = positiveInteger(
    requestUrl.searchParams.get("limit") ?? jsonBody.limit,
    25,
    MAX_QUEUE_LIMIT,
  );
  const lookbackDays = positiveInteger(
    requestUrl.searchParams.get("lookbackDays") ??
      requestUrl.searchParams.get("lookback_days") ??
      jsonBody.lookbackDays ??
      jsonBody.lookback_days,
    7,
    MAX_LOOKBACK_DAYS,
  );
  const staleAfterMinutes = positiveInteger(
    requestUrl.searchParams.get("staleAfterMinutes") ??
      requestUrl.searchParams.get("stale_after_minutes") ??
      jsonBody.staleAfterMinutes ??
      jsonBody.stale_after_minutes,
    60,
    MAX_STALE_AFTER_MINUTES,
  );
  const businessId = optionalString(requestUrl.searchParams.get("businessId") ?? requestUrl.searchParams.get("business_id") ?? jsonBody.businessId ?? jsonBody.business_id);
  const adAccountId = optionalString(requestUrl.searchParams.get("adAccountId") ?? requestUrl.searchParams.get("ad_account_id") ?? jsonBody.adAccountId ?? jsonBody.ad_account_id);
  const targetUrl = new URL("/api/sync/scheduled-refresh", APP_BASE_URL);
  const startedAt = Date.now();

  console.info(`[${functionName}] forwarding account sync queue request`, {
    targetOrigin: targetUrl.origin,
    limit,
    lookbackDays,
    staleAfterMinutes,
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
      staleAfterMinutes,
      businessId,
      adAccountId,
    }),
  });

  const responseBody = await resp.text();

  console.info(`[${functionName}] app response`, {
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
}
