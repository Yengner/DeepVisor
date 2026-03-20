import type { SupportedPlatformVendor } from '../types';

const SUPPORTED_VENDORS = new Set<SupportedPlatformVendor>(['meta', 'google', 'tiktok']);

export function toSupportedVendor(value: unknown): SupportedPlatformVendor {
  if (typeof value === 'string' && SUPPORTED_VENDORS.has(value as SupportedPlatformVendor)) {
    return value as SupportedPlatformVendor;
  }

  return 'meta';
}
