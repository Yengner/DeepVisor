'use client';

const PITCH_DETACHED_PLATFORMS_KEY = 'deepvisor:pitch-detached-platforms';

export type PitchDetachedPlatform = {
  platformId: string;
  platformKey: string;
  platformName: string;
  integrationId: string | null;
  primaryAdAccountExternalId: string | null;
  primaryAdAccountName: string | null;
  detachedAt: string;
};

function isPitchDetachedPlatform(value: unknown): value is PitchDetachedPlatform {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.platformId === 'string' &&
    typeof record.platformKey === 'string' &&
    typeof record.platformName === 'string' &&
    typeof record.detachedAt === 'string'
  );
}

export function readPitchDetachedPlatforms(): PitchDetachedPlatform[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PITCH_DETACHED_PLATFORMS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPitchDetachedPlatform);
  } catch {
    return [];
  }
}

function writePitchDetachedPlatforms(platforms: PitchDetachedPlatform[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PITCH_DETACHED_PLATFORMS_KEY, JSON.stringify(platforms));
}

export function upsertPitchDetachedPlatform(platform: PitchDetachedPlatform) {
  const existing = readPitchDetachedPlatforms().filter((item) => item.platformId !== platform.platformId);
  writePitchDetachedPlatforms([...existing, platform]);
}

export function clearPitchDetachedPlatform(platformId: string) {
  const next = readPitchDetachedPlatforms().filter((item) => item.platformId !== platformId);
  writePitchDetachedPlatforms(next);
}

export function clearAllPitchDetachedPlatforms() {
  writePitchDetachedPlatforms([]);
}
