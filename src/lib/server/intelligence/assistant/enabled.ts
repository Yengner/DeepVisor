import 'server-only';

/**
 * "Ask DeepVisor" (the AI assistant) is hidden for the beta: no launcher, no ad-card or mobile entry
 * point, and its API refuses requests. Set DEEPVISOR_ASSISTANT=true to turn it back on.
 */
export const assistantEnabled = () => process.env.DEEPVISOR_ASSISTANT === 'true';
