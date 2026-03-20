import 'server-only';

import { asNumber, asRecord, asString, formatRetryDelay } from '@/lib/shared';
import { createAdminClient } from '@/lib/server/supabase/admin';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';
import { syncConnectedBusinessPlatforms } from './syncBusinessPlatform';

const RATE_LIMIT_DETAIL_KEY = 'manual_sync_rate_limit';
const BASE_COOLDOWN_MS = 30_000;
const HALF_LIFE_MS = 15 * 60_000;
const MAX_COOLDOWN_MS = 30 * 60_000;
const MIN_LOAD_THRESHOLD = 0.05;

type IntegrationRow = Database['public']['Tables']['platform_integrations']['Row'] & {
  platforms?: { key: string } | { key: string }[] | null;
};

type ManualSyncRateLimitState = {
  load: number;
  lastRequestedAt: string | null;
  nextAllowedAt: string | null;
};

type ManualRefreshAllowedResult = {
  allowed: true;
  refreshedCount: number;
  failedCount: number;
};

type ManualRefreshBlockedResult = {
  allowed: false;
  retryAfterMs: number;
  nextAllowedAt: string;
  message: string;
};

export type ManualRefreshResult =
  | ManualRefreshAllowedResult
  | ManualRefreshBlockedResult;

function isSyncEligibleStatus(status: string): boolean {
  return status === 'connected' || status === 'error' || status === 'needs_reauth';
}

function toPlatformKey(value: string | null | undefined): SupportedIntegrationPlatform | null {
  return value === 'meta' ? 'meta' : null;
}

function parseIsoTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function decayLoad(load: number, elapsedMs: number): number {
  if (!Number.isFinite(load) || load <= 0) {
    return 0;
  }

  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return load;
  }

  return load * Math.exp((-Math.LN2 * elapsedMs) / HALF_LIFE_MS);
}

function resolveCooldownMs(load: number): number {
  const boundedLoad = Math.max(1, load);

  return Math.min(
    MAX_COOLDOWN_MS,
    Math.max(BASE_COOLDOWN_MS, Math.round(BASE_COOLDOWN_MS * Math.pow(2, boundedLoad - 1)))
  );
}

function parseRateLimitState(details: Record<string, unknown>): ManualSyncRateLimitState {
  const rateLimit = asRecord(details[RATE_LIMIT_DETAIL_KEY]);

  return {
    load: asNumber(rateLimit.load),
    lastRequestedAt: asString(rateLimit.lastRequestedAt) || null,
    nextAllowedAt: asString(rateLimit.nextAllowedAt) || null,
  };
}

function formatCooldownMessage(retryAfterMs: number): string {
  return `Sync cooling down. ${formatRetryDelay(retryAfterMs)}`;
}

async function listLatestBusinessSyncTargets(input: {
  businessId: string;
  platformKey?: SupportedIntegrationPlatform;
}): Promise<IntegrationRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('*, platforms ( key )')
    .eq('business_id', input.businessId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const latestByPlatformId = new Map<string, IntegrationRow>();

  for (const row of (data ?? []) as IntegrationRow[]) {
    if (latestByPlatformId.has(row.platform_id)) {
      continue;
    }

    const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
    const platformKey = toPlatformKey(platform?.key);
    if (!platformKey) {
      continue;
    }

    if (input.platformKey && platformKey !== input.platformKey) {
      continue;
    }

    if (!isSyncEligibleStatus(row.status)) {
      continue;
    }

    latestByPlatformId.set(row.platform_id, row);
  }

  return Array.from(latestByPlatformId.values());
}

function resolveBlockedState(integrations: IntegrationRow[]): ManualRefreshBlockedResult | null {
  const nowMs = Date.now();
  let nextAllowedAtMs: number | null = null;

  for (const integration of integrations) {
    const details = asRecord(integration.integration_details);
    const state = parseRateLimitState(details);
    const blockedUntil = parseIsoTimestamp(state.nextAllowedAt);

    if (blockedUntil !== null && blockedUntil > nowMs) {
      nextAllowedAtMs = nextAllowedAtMs === null ? blockedUntil : Math.max(nextAllowedAtMs, blockedUntil);
    }
  }

  if (nextAllowedAtMs === null) {
    return null;
  }

  const retryAfterMs = Math.max(1_000, nextAllowedAtMs - nowMs);

  return {
    allowed: false,
    retryAfterMs,
    nextAllowedAt: new Date(nextAllowedAtMs).toISOString(),
    message: formatCooldownMessage(retryAfterMs),
  };
}

async function persistRateLimitState(input: {
  integrations: IntegrationRow[];
  requestedAt: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const requestedAtMs = new Date(input.requestedAt).getTime();

  for (const integration of input.integrations) {
    const integrationDetails = asRecord(integration.integration_details);
    const currentState = parseRateLimitState(integrationDetails);
    const lastRequestedAtMs = parseIsoTimestamp(currentState.lastRequestedAt);
    const decayedLoad =
      lastRequestedAtMs === null
        ? 0
        : decayLoad(currentState.load, Math.max(0, requestedAtMs - lastRequestedAtMs));
    const nextLoad = (decayedLoad < MIN_LOAD_THRESHOLD ? 0 : decayedLoad) + 1;
    const cooldownMs = resolveCooldownMs(nextLoad);

    const nextDetails = {
      ...integrationDetails,
      [RATE_LIMIT_DETAIL_KEY]: {
        load: nextLoad,
        lastRequestedAt: input.requestedAt,
        nextAllowedAt: new Date(requestedAtMs + cooldownMs).toISOString(),
        baseCooldownMs: BASE_COOLDOWN_MS,
        halfLifeMs: HALF_LIFE_MS,
        maxCooldownMs: MAX_COOLDOWN_MS,
      },
    };

    const { error } = await supabase
      .from('platform_integrations')
      .update({
        integration_details: nextDetails as Json,
        updated_at: input.requestedAt,
      })
      .eq('id', integration.id);

    if (error) {
      throw error;
    }
  }
}

export async function runManualBusinessSync(input: {
  businessId: string;
  platformKey?: SupportedIntegrationPlatform;
}): Promise<ManualRefreshResult> {
  const integrations = await listLatestBusinessSyncTargets(input);

  if (integrations.length === 0) {
    return {
      allowed: true,
      refreshedCount: 0,
      failedCount: 0,
    };
  }

  const blockedState = resolveBlockedState(integrations);
  if (blockedState) {
    return blockedState;
  }

  const requestedAt = new Date().toISOString();

  await persistRateLimitState({
    integrations,
    requestedAt,
  });

  const result = await syncConnectedBusinessPlatforms({
    businessId: input.businessId,
    trigger: 'manual_refresh',
    platformKey: input.platformKey,
  });

  return {
    allowed: true,
    refreshedCount: result.successCount,
    failedCount: result.failedCount,
  };
}
