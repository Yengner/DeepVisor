import 'server-only';

const META_GRAPH_VERSION = 'v24.0';
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_MAX_LOOKBACK_MONTHS = 37;
const META_TRANSIENT_MAX_ATTEMPTS = 3;
const META_TRANSIENT_RETRY_BASE_MS = 700;

type MetaCollectionResponse<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
  };
};

type MetaParsedError = {
  message: string;
  retryable: boolean;
  status: number;
};

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function resolveMetaBackfillWindow(days: number): {
  since: string;
  until: string;
  backfillDays: number;
} {
  const untilDate = startOfUtcDay(new Date());
  const requestedSinceDate = startOfUtcDay(new Date(untilDate));
  requestedSinceDate.setUTCDate(requestedSinceDate.getUTCDate() - Math.max(days - 1, 0));

  const earliestAllowedSinceDate = startOfUtcDay(new Date(untilDate));
  earliestAllowedSinceDate.setUTCMonth(
    earliestAllowedSinceDate.getUTCMonth() - META_MAX_LOOKBACK_MONTHS
  );

  const sinceDate =
    requestedSinceDate < earliestAllowedSinceDate
      ? earliestAllowedSinceDate
      : requestedSinceDate;
  const backfillDays =
    Math.floor((untilDate.getTime() - sinceDate.getTime()) / 86_400_000) + 1;

  return {
    since: sinceDate.toISOString().slice(0, 10),
    until: untilDate.toISOString().slice(0, 10),
    backfillDays,
  };
}

export function getBackfillDateRange(days: number): { since: string; until: string } {
  const { since, until } = resolveMetaBackfillWindow(days);
  return { since, until };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableMetaError(status: number, message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  return (
    normalizedMessage.includes('service temporarily unavailable') ||
    normalizedMessage.includes('please try again later') ||
    normalizedMessage.includes('temporarily unavailable') ||
    normalizedMessage.includes('rate limit')
  );
}

async function parseMetaError(response: Response): Promise<MetaParsedError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  const message = body.error?.message || `Meta request failed with status ${response.status}`;

  return {
    message,
    retryable: isRetryableMetaError(response.status, message),
    status: response.status,
  };
}

async function fetchMetaResponseWithRetry(url: URL): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= META_TRANSIENT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }

      const parsedError = await parseMetaError(response);
      lastError = new Error(parsedError.message);

      if (!parsedError.retryable || attempt === META_TRANSIENT_MAX_ATTEMPTS) {
        throw lastError;
      }

      console.warn(
        `Retrying Meta request after transient error (${attempt}/${META_TRANSIENT_MAX_ATTEMPTS}) for ${url.pathname}: ${parsedError.message}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Meta request failed');

      if (attempt === META_TRANSIENT_MAX_ATTEMPTS) {
        throw lastError;
      }

      console.warn(
        `Retrying Meta request after fetch failure (${attempt}/${META_TRANSIENT_MAX_ATTEMPTS}) for ${url.pathname}: ${lastError.message}`
      );
    }

    await sleep(META_TRANSIENT_RETRY_BASE_MS * attempt);
  }

  throw lastError ?? new Error('Meta request failed');
}

export async function fetchMetaObject<T>(input: {
  path: string;
  accessToken: string;
  params?: Record<string, string | number | boolean | undefined>;
}): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE_URL}/${input.path}`);
  url.searchParams.set('access_token', input.accessToken);

  for (const [key, value] of Object.entries(input.params ?? {})) {
    if (value === undefined) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const response = await fetchMetaResponseWithRetry(url);

  return (await response.json()) as T;
}

export async function fetchMetaCollection<T>(input: {
  path: string;
  accessToken: string;
  params?: Record<string, string | number | boolean | undefined>;
}): Promise<T[]> {
  let nextUrl: URL | null = new URL(`${META_GRAPH_BASE_URL}/${input.path}`);
  nextUrl.searchParams.set('access_token', input.accessToken);

  for (const [key, value] of Object.entries(input.params ?? {})) {
    if (value === undefined) {
      continue;
    }

    nextUrl.searchParams.set(key, String(value));
  }

  const rows: T[] = [];

  while (nextUrl) {
    const response = await fetchMetaResponseWithRetry(nextUrl);

    const body = (await response.json()) as MetaCollectionResponse<T>;
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ? new URL(body.paging.next) : null;
  }

  return rows;
}
