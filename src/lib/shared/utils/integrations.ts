import type { SupportedIntegrationPlatform } from '@/lib/shared/types/integrations';
import type { IntegrationStatus } from '@/lib/shared/types/integrations';
import { formatRelativeTime } from './date';

export interface IntegrationPlatformPalette {
  accent: string;
  accentSoft: string;
  accentSurface: string;
  border: string;
  text: string;
}

export interface IntegrationPlatformDisplayLike {
  platformKey: string;
  platformName: string;
  status: IntegrationStatus;
  imageUrl: string | null;
  lastSyncedAt: string | null;
}

const PLATFORM_IMAGE_BY_KEY: Record<string, string> = {
  meta: '/images/platforms/logo/meta.png',
  google: '/images/platforms/logo/google.png',
  tiktok: '/images/platforms/logo/tiktok.png',
};

const PLATFORM_PALETTE_BY_KEY: Record<string, IntegrationPlatformPalette> = {
  meta: {
    accent: '#1877f2',
    accentSoft: 'rgba(24, 119, 242, 0.12)',
    accentSurface: 'rgba(24, 119, 242, 0.10)',
    border: 'rgba(24, 119, 242, 0.2)',
    text: '#154273',
  },
  google: {
    accent: '#34a853',
    accentSoft: 'rgba(52, 168, 83, 0.12)',
    accentSurface: 'rgba(52, 168, 83, 0.10)',
    border: 'rgba(52, 168, 83, 0.18)',
    text: '#24503a',
  },
  tiktok: {
    accent: '#fe2c55',
    accentSoft: 'rgba(254, 44, 85, 0.12)',
    accentSurface: 'rgba(254, 44, 85, 0.10)',
    border: 'rgba(254, 44, 85, 0.18)',
    text: '#5a2134',
  },
  default: {
    accent: '#2563eb',
    accentSoft: 'rgba(37, 99, 235, 0.12)',
    accentSurface: 'rgba(37, 99, 235, 0.10)',
    border: 'rgba(37, 99, 235, 0.18)',
    text: '#173868',
  },
};

const PLATFORM_SORT_ORDER = ['meta', 'google', 'tiktok'] as const;

/**
 * Narrows arbitrary platform keys down to the subset currently supported by the app.
 *
 * This is the backend support gate for OAuth flows and integration orchestration.
 */
export function toSupportedIntegrationPlatform(
  value: string | null | undefined
): SupportedIntegrationPlatform | null {
  return value === 'meta' ? 'meta' : null;
}

/**
 * Identifies integrations that are fully usable by the rest of the product.
 */
export function isIntegrationConnected(status: IntegrationStatus): boolean {
  return status === 'connected';
}

/**
 * Flags statuses that should surface reconnect or error treatment in the UI.
 */
export function integrationNeedsAttention(status: IntegrationStatus): boolean {
  return status === 'error' || status === 'needs_reauth';
}

/**
 * Maps an integration status to the Mantine color token used throughout status badges.
 */
export function getIntegrationStatusColor(
  status: IntegrationStatus
): 'green' | 'gray' | 'red' | 'yellow' {
  if (status === 'connected') return 'green';
  if (status === 'needs_reauth') return 'yellow';
  if (status === 'error') return 'red';
  return 'gray';
}

/**
 * Returns the human-readable label shown for each integration status.
 */
export function getIntegrationStatusLabel(status: IntegrationStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'needs_reauth') return 'Reconnect needed';
  if (status === 'error') return 'Issue detected';
  return 'Not connected';
}

/**
 * Returns the branded palette used to skin integration cards, glows, and accent surfaces.
 */
export function getIntegrationPlatformPalette(platformKey: string): IntegrationPlatformPalette {
  return PLATFORM_PALETTE_BY_KEY[platformKey] ?? PLATFORM_PALETTE_BY_KEY.default;
}

/**
 * Resolves the preferred static platform artwork, falling back to the row-provided image URL.
 */
export function getIntegrationPlatformImage(
  platformKey: string,
  imageUrl: string | null
): string | null {
  return PLATFORM_IMAGE_BY_KEY[platformKey] ?? imageUrl ?? null;
}

/**
 * Orders platform cards so connected and actionable channels appear before preview-only entries.
 */
export function sortIntegrationPlatforms<
  T extends Pick<IntegrationPlatformDisplayLike, 'platformKey' | 'platformName' | 'status'>
>(platforms: T[]): T[] {
  return [...platforms].sort((left, right) => {
    const leftConnected = isIntegrationConnected(left.status) ? 1 : 0;
    const rightConnected = isIntegrationConnected(right.status) ? 1 : 0;

    if (leftConnected !== rightConnected) {
      return rightConnected - leftConnected;
    }

    const leftAttention = integrationNeedsAttention(left.status) ? 1 : 0;
    const rightAttention = integrationNeedsAttention(right.status) ? 1 : 0;
    if (leftAttention !== rightAttention) {
      return rightAttention - leftAttention;
    }

    const leftOrder = PLATFORM_SORT_ORDER.indexOf(left.platformKey as (typeof PLATFORM_SORT_ORDER)[number]);
    const rightOrder = PLATFORM_SORT_ORDER.indexOf(right.platformKey as (typeof PLATFORM_SORT_ORDER)[number]);
    const safeLeft = leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder;
    const safeRight = rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder;

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }

    return left.platformName.localeCompare(right.platformName);
  });
}

/**
 * Produces the short availability sentence used in integration list and detail views.
 */
export function getIntegrationAvailabilityCopy(
  platform: Pick<IntegrationPlatformDisplayLike, 'platformKey' | 'status' | 'lastSyncedAt'>
): string {
  if (isIntegrationConnected(platform.status)) {
    return platform.lastSyncedAt
      ? `Last synced ${formatRelativeTime(platform.lastSyncedAt, { emptyLabel: 'Not synced yet' })}`
      : 'Connected and waiting for first sync';
  }

  if (platform.platformKey === 'meta') {
    return integrationNeedsAttention(platform.status)
      ? 'Reconnect Meta to restore syncing.'
      : 'Available to connect now.';
  }

  return 'Preview channel for future integrations.';
}
