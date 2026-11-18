/**
 * Quick ad media limits, shared by the form and the server.
 * Meta accepts photos up to 30 MB. Videos are capped by our private storage (50 MB per file
 * on the current Supabase plan, also the bucket limit), well under Meta's own video limit.
 */
export const QUICK_AD_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'] as const;
export type QuickAdMediaType = (typeof QUICK_AD_MEDIA_TYPES)[number];

const MB = 1024 * 1024;
export const QUICK_AD_MAX_IMAGE_MB = 30;
export const QUICK_AD_MAX_VIDEO_MB = 50;

export function isQuickAdMediaType(type: unknown): type is QuickAdMediaType {
  return QUICK_AD_MEDIA_TYPES.includes(type as QuickAdMediaType);
}

/** Largest allowed size in bytes for this type, or null when the type is not accepted. */
export function quickAdMaxBytes(type: unknown): number | null {
  if (!isQuickAdMediaType(type)) return null;
  return (type.startsWith('video/') ? QUICK_AD_MAX_VIDEO_MB : QUICK_AD_MAX_IMAGE_MB) * MB;
}

export type QuickAdMediaProblem = 'type' | 'size';
/** Why a file of this type and size cannot be used, or null when it fits. */
export function quickAdMediaProblem(type: unknown, size: number): QuickAdMediaProblem | null {
  const max = quickAdMaxBytes(type);
  if (max === null) return 'type';
  return Number.isInteger(size) && size > 0 && size <= max ? null : 'size';
}
