/** Reject icon-sized previews, not usable portrait or landscape media. */
export function usablePreviewDimensions(width: number, height: number) {
  return Number.isFinite(width) && Number.isFinite(height) &&
    Math.min(width, height) >= 80 && Math.max(width, height) >= 160;
}

export function previewSources(media?: { image?: string | null; fallbackImages?: string[]; fallbackImage?: string | null }, failed: string[] = []) {
  return [...new Set([media?.image, ...(media?.fallbackImages ?? []), media?.fallbackImage])]
    .filter((url): url is string => !!url && !failed.includes(url));
}
