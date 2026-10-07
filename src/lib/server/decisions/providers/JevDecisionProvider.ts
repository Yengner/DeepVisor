import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FEATURE_SCHEMA_VERSION, type FeatureSnapshot } from '@/lib/server/features';
import { DECISIONS, type DecisionProvider, type DecisionProviderIdentity, type DecisionResult } from '../types';
import { jsonSchema, validateDecisionResult } from '../validation';

export const JEV_QUESTION_SCHEMA_VERSION = 1;
const QUESTION_ID = 'delivery_decision_v1';
const ADAPTER_VERSION = '1';
const MAX_RETRY_DELAY_MS = 5000;
const probability = z.number().finite().min(0).max(1);
const responseSchema = z.object({
  model: z.string(),
  answers: z.object({
    [QUESTION_ID]: z.object({
      type: z.literal('choice'),
      choice: z.enum(DECISIONS),
      probabilities: z.object({
        HOLD: probability, INSUFFICIENT_DATA: probability, REDUCE_BUDGET: probability,
        PAUSE_DELIVERY_UNIT: probability, REVIEW_CREATIVE: probability,
      }).strict(),
      confidence: probability,
    }),
  }).strict(),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
});

type ErrorCode = 'CONFIGURATION' | 'INVALID_INPUT' | 'TIMEOUT' | 'UNAVAILABLE' | 'HTTP_ERROR' | 'INVALID_RESPONSE';
export class JevProviderError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(`Jev evaluation failed: ${code}`);
    this.name = 'JevProviderError';
  }
}

function readConfig() {
  const apiKey = process.env.JEV_API_KEY?.trim();
  const model = process.env.JEV_MODEL_ID?.trim() || 'jev-1.13.0';
  const timeoutMs = Number(process.env.JEV_TIMEOUT_MS ?? 10000);
  const maxRetries = Number(process.env.JEV_MAX_RETRIES ?? 1);
  let url: URL;
  try {
    url = new URL(process.env.JEV_API_URL || 'https://api.typesafe.ai/v1/systemone');
  } catch {
    throw new JevProviderError('CONFIGURATION');
  }
  if (!apiKey || /[\r\n]/.test(apiKey) || !/^jev-\d+\.\d+\.\d+$/.test(model) ||
      url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000 ||
      !Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 2) {
    throw new JevProviderError('CONFIGURATION');
  }
  return { apiKey, model, url: url.toString(), timeoutMs, maxRetries };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
    }
    return item;
  });
}

function requestBody(state: FeatureSnapshot, questions: readonly string[], model: string): string {
  if (state.schemaVersion !== FEATURE_SCHEMA_VERSION || !jsonSchema.safeParse(state).success ||
      !Array.isArray(questions) || !questions.length ||
      questions.some((question) => typeof question !== 'string' || !question.trim())) {
    throw new JevProviderError('INVALID_INPUT');
  }
  return canonicalJson({
    model,
    state: {
      questionSchemaVersion: JEV_QUESTION_SCHEMA_VERSION,
      featureSchemaVersion: state.schemaVersion,
      asOfDay: state.asOfDay,
      platform: state.deliveryUnit.platform,
      entityType: state.deliveryUnit.entityType,
      currency: state.deliveryUnit.currency,
      resultDefinition: state.resultDefinition,
      frequencyBasis: state.frequencyBasis,
      windows: state.windows,
      comparisons: state.comparisons,
      trackingConfidence: state.trackingConfidence,
      creativeFatigue: state.creativeFatigue,
    },
    questions: {
      [QUESTION_ID]: {
        type: 'choice',
        instructions: {
          task: 'Choose one reviewable recommendation for this Meta ad set using only the supplied evidence. This is not authorization to execute. Unknown metrics are not zero. Prioritize insufficient evidence over spend changes.',
          considerations: [...questions],
        },
        criteria: {
          HOLD: 'Sufficient evidence with no supported need to change delivery.',
          INSUFFICIENT_DATA: 'Missing or insufficient performance evidence, unreliable comparisons, or low/unknown tracking confidence prevents a supported recommendation.',
          REDUCE_BUDGET: 'Sufficient comparable evidence supports reviewing a budget reduction due to declining efficiency.',
          PAUSE_DELIVERY_UNIT: 'Sufficient reliable evidence supports reviewing a pause due to persistent ineffective delivery.',
          REVIEW_CREATIVE: 'Available fatigue indicators support human creative review.',
        },
      },
    },
  });
}

type Attempt = { response: Response; body?: unknown };

export class JevDecisionProvider implements DecisionProvider {
  readonly identity: DecisionProviderIdentity;
  #config: ReturnType<typeof readConfig>;

  constructor(private readonly fetcher: typeof fetch = fetch) {
    this.#config = readConfig();
    this.identity = Object.freeze({
      providerId: 'jev', providerVersion: ADAPTER_VERSION,
      modelId: this.#config.model, modelVersion: this.#config.model.slice(4),
    });
  }

  private async attempt(body: string): Promise<Attempt> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new JevProviderError('TIMEOUT'));
        controller.abort();
      }, this.#config.timeoutMs);
    });
    try {
      return await Promise.race([timeout, (async () => {
        let response: Response;
        try {
          response = await this.fetcher(this.#config.url, {
            method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
            headers: { Authorization: `Bearer ${this.#config.apiKey}`, 'Content-Type': 'application/json' },
            body,
          });
        } catch {
          throw new JevProviderError(controller.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE');
        }
        if (!response.ok) {
          await response.body?.cancel();
          return { response };
        }
        try {
          return { response, body: await response.json() as unknown };
        } catch {
          throw new JevProviderError('INVALID_RESPONSE');
        }
      })()]);
    } finally {
      clearTimeout(timer);
    }
  }

  async evaluate(state: FeatureSnapshot, questions: readonly string[]): Promise<DecisionResult> {
    const body = requestBody(state, questions, this.#config.model);
    const requestHash = createHash('sha256').update(body).digest('hex');
    for (let attempt = 0; attempt <= this.#config.maxRetries; attempt += 1) {
      let result: Attempt;
      let retryDelay = 250 * 2 ** attempt;
      try {
        result = await this.attempt(body);
      } catch (error) {
        if (!(error instanceof JevProviderError)) throw new JevProviderError('UNAVAILABLE');
        if (!['TIMEOUT', 'UNAVAILABLE'].includes(error.code) || attempt === this.#config.maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      if (!result.response.ok) {
        const retryable = [408, 429, 500, 502, 503, 504, 529].includes(result.response.status);
        if (!retryable) throw new JevProviderError('HTTP_ERROR');
        if (attempt === this.#config.maxRetries) throw new JevProviderError('UNAVAILABLE');
        const retryAfter = result.response.headers.get('retry-after');
        if (retryAfter) {
          const delay = /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
          if (Number.isFinite(delay)) retryDelay = Math.max(retryDelay, delay);
        }
        // Do not retry sooner than requested or keep a server request waiting indefinitely.
        if (retryDelay > MAX_RETRY_DELAY_MS) throw new JevProviderError('UNAVAILABLE');
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      const parsed = responseSchema.safeParse(result.body);
      if (!parsed.success || parsed.data.model !== this.#config.model) throw new JevProviderError('INVALID_RESPONSE');
      const answer = parsed.data.answers[QUESTION_ID];
      const probabilities = Object.values(answer.probabilities);
      if (Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) > 0.000001 ||
          answer.probabilities[answer.choice] < Math.max(...probabilities)) {
        throw new JevProviderError('INVALID_RESPONSE');
      }
      const requestId = result.response.headers.get('x-request-id');
      return validateDecisionResult({
        ...this.identity, decision: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities,
        evidence: { questionSchemaVersion: JEV_QUESTION_SCHEMA_VERSION, featureSchemaVersion: state.schemaVersion, requestHash },
        // Keep documented fields only; error bodies, extra fields and auth headers are never audited.
        rawResponse: {
          ...parsed.data,
          requestId: requestId && /^[\w.:-]{1,128}$/.test(requestId) && !requestId.includes(this.#config.apiKey) ? requestId : null,
          attempts: attempt + 1,
        },
      });
    }
    throw new JevProviderError('UNAVAILABLE');
  }
}
