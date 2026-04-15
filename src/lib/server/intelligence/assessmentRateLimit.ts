import 'server-only';

import { asNumber, asRecord, asString } from '@/lib/shared';
import { parseTimestampMs } from '@/lib/shared/utils/date';
import { createAdminClient } from '@/lib/server/supabase/admin';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { BusinessIntelligencePlanningScope } from './types';
import { runBusinessIntelligenceAssessment } from './service';

const RATE_LIMIT_DETAIL_KEY = 'intelligence_assessment_rate_limit';
const BASE_COOLDOWN_MS = 15_000;
const HALF_LIFE_MS = 10 * 60_000;
const MAX_COOLDOWN_MS = 10 * 60_000;
const MIN_LOAD_THRESHOLD = 0.05;

type IntegrationRow = Pick<
  Database['public']['Tables']['platform_integrations']['Row'],
  'id' | 'business_id' | 'status' | 'integration_details' | 'updated_at' | 'created_at'
>;

type AssessmentRateLimitState = {
  load: number;
  lastRequestedAt: string | null;
  nextAllowedAt: string | null;
};

type RateLimitedAssessmentAllowedResult = {
  allowed: true;
  result: Awaited<ReturnType<typeof runBusinessIntelligenceAssessment>>;
};

type RateLimitedAssessmentBlockedResult = {
  allowed: false;
  retryAfterMs: number;
  nextAllowedAt: string;
  message: string;
};

export type RateLimitedBusinessIntelligenceAssessmentResult =
  | RateLimitedAssessmentAllowedResult
  | RateLimitedAssessmentBlockedResult;

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

function parseRateLimitState(details: Record<string, unknown>): AssessmentRateLimitState {
  const rateLimit = asRecord(details[RATE_LIMIT_DETAIL_KEY]);

  return {
    load: asNumber(rateLimit.load),
    lastRequestedAt: asString(rateLimit.lastRequestedAt) || null,
    nextAllowedAt: asString(rateLimit.nextAllowedAt) || null,
  };
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))
  );
}

function resolveTargetIntegrationIds(input: {
  scope: BusinessIntelligencePlanningScope;
  platformIntegrationId?: string | null;
  platformIntegrationIds?: string[];
  defaultPlatformIntegrationId?: string | null;
}): string[] | null {
  if (input.scope === 'integration') {
    return uniqueIds([input.platformIntegrationId, input.defaultPlatformIntegrationId]);
  }

  if (input.scope === 'selected_integrations') {
    const selectedIds = uniqueIds(input.platformIntegrationIds ?? []);
    return selectedIds.length > 0
      ? selectedIds
      : uniqueIds([input.defaultPlatformIntegrationId]);
  }

  return null;
}

async function listAssessmentTargets(input: {
  businessId: string;
  scope: BusinessIntelligencePlanningScope;
  platformIntegrationId?: string | null;
  platformIntegrationIds?: string[];
  defaultPlatformIntegrationId?: string | null;
}): Promise<IntegrationRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('id, business_id, status, integration_details, updated_at, created_at')
    .eq('business_id', input.businessId)
    .eq('status', 'connected')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const targetIds = resolveTargetIntegrationIds(input);
  const integrations = (data ?? []) as IntegrationRow[];

  if (!targetIds || targetIds.length === 0) {
    return integrations;
  }

  const targetIdSet = new Set(targetIds);
  return integrations.filter((integration) => targetIdSet.has(integration.id));
}

function formatCooldownMessage(retryAfterMs: number): string {
  const totalSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `Assessment cooling down. Try again in ${minutes}m ${seconds}s.`;
  }

  return `Assessment cooling down. Try again in ${seconds}s.`;
}

function resolveBlockedState(
  integrations: IntegrationRow[]
): RateLimitedAssessmentBlockedResult | null {
  const nowMs = Date.now();
  let nextAllowedAtMs: number | null = null;

  for (const integration of integrations) {
    const details = asRecord(integration.integration_details);
    const state = parseRateLimitState(details);
    const blockedUntil = parseTimestampMs(state.nextAllowedAt);

    if (blockedUntil !== null && blockedUntil > nowMs) {
      nextAllowedAtMs =
        nextAllowedAtMs === null ? blockedUntil : Math.max(nextAllowedAtMs, blockedUntil);
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
    const lastRequestedAtMs = parseTimestampMs(currentState.lastRequestedAt);
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

export async function runRateLimitedBusinessIntelligenceAssessment(input: {
  businessId: string;
  scope: BusinessIntelligencePlanningScope;
  platformIntegrationId?: string | null;
  platformIntegrationIds?: string[];
  defaultAdAccountId?: string | null;
  defaultPlatformIntegrationId?: string | null;
}): Promise<RateLimitedBusinessIntelligenceAssessmentResult> {
  const integrations = await listAssessmentTargets({
    businessId: input.businessId,
    scope: input.scope,
    platformIntegrationId: input.platformIntegrationId,
    platformIntegrationIds: input.platformIntegrationIds,
    defaultPlatformIntegrationId: input.defaultPlatformIntegrationId,
  });

  const blockedState = resolveBlockedState(integrations);
  if (blockedState) {
    return blockedState;
  }

  if (integrations.length > 0) {
    await persistRateLimitState({
      integrations,
      requestedAt: new Date().toISOString(),
    });
  }

  const result = await runBusinessIntelligenceAssessment(input);

  return {
    allowed: true,
    result,
  };
}
