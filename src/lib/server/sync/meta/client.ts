import 'server-only';

const META_GRAPH_VERSION = 'v23.0';
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_MAX_LOOKBACK_MONTHS = 37;

type MetaCollectionResponse<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
  };
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

async function parseMetaError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  return body.error?.message || `Meta request failed with status ${response.status}`;
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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await parseMetaError(response));
  }

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
    const response = await fetch(nextUrl);
    if (!response.ok) {
      throw new Error(await parseMetaError(response));
    }

    const body = (await response.json()) as MetaCollectionResponse<T>;
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ? new URL(body.paging.next) : null;
  }

  return rows;
}
