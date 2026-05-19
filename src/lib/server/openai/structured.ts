import 'server-only';

import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import {
  getConfiguredOpenAIFastModel,
  getConfiguredOpenAIStructuredTimeoutMs,
  supportsOpenAITemperature,
} from './config';

type AiGenerationStatus = 'succeeded' | 'skipped' | 'failed' | 'invalid_output';

type StructuredAiResult<T> = {
  output: T;
  aiGenerated: boolean;
  runId: string | null;
  fallbackReason: string | null;
  model: string;
  promptVersion: string;
};

type RunStructuredAiInput<T> = {
  supabase: SupabaseClient<Database>;
  businessId: string;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  queueItemId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  promptVersion: string;
  schemaName: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  task: string;
  input: unknown;
  fallback: T;
  validate: (value: unknown) => T | null;
  skipReason?: string | null;
  temperature?: number;
  model?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

function isAbortError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.name === 'APIUserAbortError' ||
      error.name === 'TimeoutError' ||
      message.includes('aborted') ||
      message.includes('abort') ||
      message.includes('timeout') ||
      message.includes('timed out'))
  );
}

async function recordAiGenerationRun(input: {
  supabase: SupabaseClient<Database>;
  businessId: string;
  platformIntegrationId: string | null;
  adAccountId: string | null;
  queueItemId: string | null;
  sourceType: string;
  sourceId: string | null;
  schemaName: string;
  promptVersion: string;
  model: string;
  inputHash: string;
  output: unknown;
  status: AiGenerationStatus;
  fallbackReason: string | null;
  errorMessage: string | null;
  latencyMs: number;
  metadata: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const { data, error } = await (input.supabase as any)
      .schema('ai')
      .from('ai_generation_runs')
      .insert({
        business_id: input.businessId,
        platform_integration_id: input.platformIntegrationId,
        ad_account_id: input.adAccountId,
        queue_item_id: input.queueItemId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        schema_name: input.schemaName,
        prompt_version: input.promptVersion,
        model: input.model,
        input_hash: input.inputHash,
        output_json: input.output,
        status: input.status,
        fallback_reason: input.fallbackReason,
        error_message: input.errorMessage,
        latency_ms: input.latencyMs,
        metadata_json: input.metadata,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[openai:structured] failed to record AI generation run:', error);
      return null;
    }

    return typeof data?.id === 'string' ? data.id : null;
  } catch (error) {
    console.error('[openai:structured] failed to record AI generation run:', error);
    return null;
  }
}

export async function runStructuredAI<T>(
  input: RunStructuredAiInput<T>
): Promise<StructuredAiResult<T>> {
  const model = input.model?.trim() || getConfiguredOpenAIFastModel();
  const timeoutMs =
    typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
      ? Math.min(Math.floor(input.timeoutMs), 8000)
      : getConfiguredOpenAIStructuredTimeoutMs();
  const inputHash = hashPayload(input.input);
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  async function finish(params: {
    output: T;
    aiGenerated: boolean;
    status: AiGenerationStatus;
    fallbackReason: string | null;
    errorMessage?: string | null;
  }): Promise<StructuredAiResult<T>> {
    const runId = await recordAiGenerationRun({
      supabase: input.supabase,
      businessId: input.businessId,
      platformIntegrationId: input.platformIntegrationId ?? null,
      adAccountId: input.adAccountId ?? null,
      queueItemId: input.queueItemId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      schemaName: input.schemaName,
      promptVersion: input.promptVersion,
      model,
      inputHash,
      output: params.output,
      status: params.status,
      fallbackReason: params.fallbackReason,
      errorMessage: params.errorMessage ?? null,
      latencyMs: Date.now() - startedAt,
      metadata: input.metadata ?? {},
    });

    return {
      output: params.output,
      aiGenerated: params.aiGenerated,
      runId,
      fallbackReason: params.fallbackReason,
      model,
      promptVersion: input.promptVersion,
    };
  }

  if (input.skipReason) {
    return finish({
      output: input.fallback,
      aiGenerated: false,
      status: 'skipped',
      fallbackReason: input.skipReason,
    });
  }

  if (!apiKey) {
    return finish({
      output: input.fallback,
      aiGenerated: false,
      status: 'skipped',
      fallbackReason: 'missing_api_key',
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    const completion = await client.chat.completions.create({
      model,
      ...(typeof input.temperature === 'number' && supportsOpenAITemperature(model)
        ? { temperature: input.temperature }
        : {}),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
      messages: [
        {
          role: 'system',
          content: input.systemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: input.task,
            input: input.input,
          }),
        },
      ],
    } as any, {
      signal: abortController.signal,
    } as any).finally(() => clearTimeout(timeout));

    const message = completion.choices[0]?.message as
      | { content?: string | null; refusal?: string | null }
      | undefined;

    if (message?.refusal) {
      return finish({
        output: input.fallback,
        aiGenerated: false,
        status: 'failed',
        fallbackReason: 'model_refusal',
        errorMessage: message.refusal,
      });
    }

    if (!message?.content) {
      return finish({
        output: input.fallback,
        aiGenerated: false,
        status: 'invalid_output',
        fallbackReason: 'empty_output',
      });
    }

    const parsed = JSON.parse(message.content) as unknown;
    const validated = input.validate(parsed);

    if (!validated) {
      return finish({
        output: input.fallback,
        aiGenerated: false,
        status: 'invalid_output',
        fallbackReason: 'invalid_output',
      });
    }

    return finish({
      output: validated,
      aiGenerated: true,
      status: 'succeeded',
      fallbackReason: null,
    });
  } catch (error) {
    return finish({
      output: input.fallback,
      aiGenerated: false,
      status: 'failed',
      fallbackReason: isAbortError(error) ? 'timeout' : 'api_error',
      errorMessage: safeErrorMessage(error),
    });
  }
}
