// deno-lint-ignore-file no-explicit-any
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? Deno.env.get("SITE_URL");
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const MAX_SYNC_JOB_LIMIT = 5;

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

export async function handleProcessAccountSyncJobsRequest(
  req: Request,
  functionName = "process_account_sync_jobs",
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
    1,
    MAX_SYNC_JOB_LIMIT,
  );
  const jobId = optionalString(
    requestUrl.searchParams.get("jobId") ??
      requestUrl.searchParams.get("job_id") ??
      jsonBody.jobId ??
      jsonBody.job_id,
  );
  const targetUrl = new URL("/api/integrations/meta/process-backfill-jobs", APP_BASE_URL);
  const startedAt = Date.now();

  console.info(`[${functionName}] forwarding account sync worker request`, {
    targetOrigin: targetUrl.origin,
    limit,
    targeted: Boolean(jobId),
  });

  const resp = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      limit,
      ...(jobId ? { jobId } : {}),
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
