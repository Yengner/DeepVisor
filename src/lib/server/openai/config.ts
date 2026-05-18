import 'server-only';

export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

export function getConfiguredOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
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
