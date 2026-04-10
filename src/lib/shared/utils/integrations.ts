import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';

export function toSupportedIntegrationPlatform(
  value: string | null | undefined
): SupportedIntegrationPlatform | null {
  return value === 'meta' ? 'meta' : null;
}
