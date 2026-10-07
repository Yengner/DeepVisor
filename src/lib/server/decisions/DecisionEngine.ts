import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { FEATURE_SCHEMA_VERSION, type FeatureSnapshot } from '@/lib/server/features';
import { insertDecisionRun, saveFeatureSnapshot, updateDecisionRun } from './repository';
import { jsonSchema, providerIdentitySchema, validateDecisionResult } from './validation';
import type { DecisionProvider, DecisionResult, PersistedDecisionResult } from './types';

export class DecisionEngineError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'PROVIDER_FAILED' | 'INVALID_RESPONSE' | 'PERSISTENCE_FAILED',
    public readonly decisionRunId?: string,
  ) {
    super(`Decision evaluation failed: ${code}`);
    this.name = 'DecisionEngineError';
  }
}

export class DecisionEngine {
  constructor(private readonly client: SupabaseClient<Database>, private readonly provider: DecisionProvider) {}

  async evaluate(input: {
    businessId: string;
    platformIntegrationId: string;
    snapshot: FeatureSnapshot;
    questions: readonly string[];
  }): Promise<PersistedDecisionResult> {
    const identity = providerIdentitySchema.safeParse(this.provider.identity);
    if (!identity.success || !input.businessId.trim() || !input.platformIntegrationId.trim() ||
      input.snapshot.schemaVersion !== FEATURE_SCHEMA_VERSION ||
      input.snapshot.deliveryUnit.businessId !== input.businessId ||
      !jsonSchema.safeParse(input.snapshot).success || !Array.isArray(input.questions) ||
      input.questions.length === 0 || input.questions.some((question) => typeof question !== 'string' || !question.trim())) {
      throw new DecisionEngineError('INVALID_INPUT');
    }
    const snapshot = structuredClone(input.snapshot);
    const questions = [...input.questions];
    let featureSnapshotId: string;
    let decisionRunId: string;
    try {
      const saved = await saveFeatureSnapshot(this.client, {
        platformIntegrationId: input.platformIntegrationId, snapshot,
      });
      featureSnapshotId = saved.id;
      const run = await insertDecisionRun(this.client, input.businessId, {
        feature_snapshot_id: saved.id,
        provider: identity.data.providerId,
        provider_model: identity.data.modelId,
        provider_version: identity.data.providerVersion,
        model_version: identity.data.modelVersion,
        decision_json: { questions },
        status: 'pending',
      });
      decisionRunId = run.id;
    } catch {
      throw new DecisionEngineError('PERSISTENCE_FAILED');
    }

    const fail = async (code: 'PROVIDER_FAILED' | 'INVALID_RESPONSE'): Promise<never> => {
      try {
        const failed = await updateDecisionRun(this.client, input.businessId, decisionRunId, {
          status: 'failed', confidence: null,
          decision_json: { questions, error: { code } },
          provider_response_json: null,
        });
        if (!failed) throw new Error('Decision run not found');
      } catch {
        throw new DecisionEngineError('PERSISTENCE_FAILED', decisionRunId);
      }
      throw new DecisionEngineError(code, decisionRunId);
    };

    let response: unknown;
    try {
      response = await this.provider.evaluate(structuredClone(snapshot), [...questions]);
    } catch {
      return fail('PROVIDER_FAILED');
    }

    let result: DecisionResult;
    try {
      result = validateDecisionResult(response);
      if (result.providerId !== identity.data.providerId || result.providerVersion !== identity.data.providerVersion ||
          result.modelId !== identity.data.modelId || result.modelVersion !== identity.data.modelVersion) {
        return fail('INVALID_RESPONSE');
      }
    } catch {
      return fail('INVALID_RESPONSE');
    }

    const { rawResponse, ...decision } = result;
    try {
      const completed = await updateDecisionRun(this.client, input.businessId, decisionRunId, {
        status: 'completed', confidence: result.confidence,
        decision_json: JSON.parse(JSON.stringify({ questions, result: decision })) as Json,
        provider_response_json: rawResponse ?? null,
      });
      if (!completed) throw new Error('Decision run not found');
    } catch {
      throw new DecisionEngineError('PERSISTENCE_FAILED', decisionRunId);
    }
    return { featureSnapshotId, decisionRunId, result };
  }
}
