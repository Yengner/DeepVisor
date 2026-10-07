import { z } from 'zod';
import type { Json } from '@/lib/shared/types/supabase';
import { DECISIONS, type DecisionResult } from './types';

// JSON.stringify silently drops unsupported values and changes NaN to null.
// Reject them instead so validation and persisted evidence have the same meaning.
function isJson(value: unknown, ancestors = new Set<object>(), depth = 0): value is Json {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const children = Array.isArray(value) ? Array.from(value) : Object.values(value);
  const valid = Object.getOwnPropertySymbols(value).length === 0 &&
    children.every((child) => isJson(child, ancestors, depth + 1));
  ancestors.delete(value);
  return valid;
}

export const jsonSchema = z.custom<Json>((value) => isJson(value), 'Expected finite, acyclic JSON');
export const providerIdentitySchema = z.object({
  providerId: z.string().trim().min(1),
  providerVersion: z.string().trim().min(1).nullable(),
  modelId: z.string().trim().min(1),
  modelVersion: z.string().trim().min(1).nullable(),
}).strict();

const probability = z.number().finite().min(0).max(1);
const decisionResultSchema = providerIdentitySchema.extend({
  decision: z.enum(DECISIONS),
  confidence: probability.nullable(),
  probabilities: z.record(z.enum(DECISIONS), probability).optional(),
  explanation: z.string().optional(),
  evidence: jsonSchema.optional(),
  rawResponse: jsonSchema.optional(),
}).strict().superRefine((result, context) => {
  if (!result.probabilities) return;
  const total = Object.values(result.probabilities).reduce((sum, value) => sum + (value ?? 0), 0);
  if (Math.abs(total - 1) > 0.000001 || result.probabilities[result.decision] === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Distribution must sum to one and include the selected decision' });
  }
});

export function validateDecisionResult(value: unknown): DecisionResult {
  return decisionResultSchema.parse(value);
}
