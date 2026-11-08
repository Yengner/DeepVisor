import 'server-only';
function integer(name: string, fallback: number, max: number) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}
export function assistantConfig() {
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna';
    if (!['gpt-6-luna', 'gpt-6.1-terra'].includes(model))
        throw new Error('Assistant model configuration is unsupported.');
    const effort = process.env.OPENAI_REASONING_EFFORT || 'low';
    if (!['low', 'medium', 'high'].includes(effort))
        throw new Error('Assistant reasoning configuration is unsupported.');
    return {
        model, effort: effort as 'low' | 'medium' | 'high',
        outputTokens: integer('OPENAI_ASSISTANT_OUTPUT_TOKENS', 1800, 4000),
        timeoutMs: integer('OPENAI_ASSISTANT_TIMEOUT_MS', 25000, 45000),
        rounds: integer('OPENAI_ASSISTANT_MAX_ROUNDS', 4, 5),
        conversationRequests: integer('OPENAI_ASSISTANT_CONVERSATION_REQUESTS', 40, 200),
        conversationTokens: integer('OPENAI_ASSISTANT_CONVERSATION_TOKENS', 300000, 2000000),
        businessRequests: integer('OPENAI_ASSISTANT_BUSINESS_DAILY_REQUESTS', 200, 2000),
        businessTokens: integer('OPENAI_ASSISTANT_BUSINESS_DAILY_TOKENS', 2000000, 10000000),
        perMinute: integer('OPENAI_ASSISTANT_BUSINESS_REQUESTS_PER_MINUTE', 10, 60),
    };
}
// Standard short-context USD estimates, verified 2026-11-04. Not an invoice.
export function estimatedCost(model: string, input: number, cached: number, output: number) {
    const price = model === 'gpt-6-luna' ? [0.1, 0.01, 0.5] : model === 'gpt-6.1-terra' ? [1, 0.05, 5] : null;
    return price ? ((input - Math.min(input, cached)) * price[0] + Math.min(input, cached) * price[1] + output * price[2]) / 1e6 : null;
}
