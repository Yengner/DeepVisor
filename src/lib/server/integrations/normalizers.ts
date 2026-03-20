import type { IntegrationStatus } from '@/lib/shared/types/integrations';

const SUPPORTED_INTEGRATION_STATUSES = new Set<IntegrationStatus>([
  'connected',
  'disconnected',
  'needs_reauth',
  'error',
]);

export function toIntegrationStatus(value: unknown): IntegrationStatus {
  if (
    typeof value === 'string' &&
    SUPPORTED_INTEGRATION_STATUSES.has(value as IntegrationStatus)
  ) {
    return value as IntegrationStatus;
  }

  return 'disconnected';
}
