import 'server-only';

export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export const DEFAULT_OPENAI_FAST_MODEL = 'gpt-5.4-nano';
export const DEFAULT_OPENAI_STRUCTURED_TIMEOUT_MS = 120000;

export function getConfiguredOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function getConfiguredOpenAIFastModel(): string {
  return (
    process.env.OPENAI_FAST_MODEL?.trim() ||
    process.env.OPENAI_QUEUE_MODEL?.trim() ||
    DEFAULT_OPENAI_FAST_MODEL
  );
}

export function getConfiguredOpenAIStructuredTimeoutMs(): number {
  const rawValue = process.env.OPENAI_STRUCTURED_TIMEOUT_MS;
  const value = rawValue ? Number(rawValue) : DEFAULT_OPENAI_STRUCTURED_TIMEOUT_MS;

  return Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), 8000)
    : DEFAULT_OPENAI_STRUCTURED_TIMEOUT_MS;
}

export function supportsOpenAITemperature(model: string): boolean {
  const normalized = model.trim().toLowerCase();

  return (
    !normalized.startsWith('gpt-5') &&
    !normalized.startsWith('o1') &&
    !normalized.startsWith('o3') &&
    !normalized.startsWith('o4')
  );
}
