import 'server-only';
import { fetchMetaObject } from './client';
import type { MetaAdCreativeSeed } from './types';
import { asRecord } from '@/lib/shared';

type Poster = { uri: string; width: number; height: number; is_preferred?: boolean };
export function bestVideoPoster(rows: unknown): Poster | null {
  if (!Array.isArray(rows)) return null;
  const valid = rows.filter((r): r is Poster => {
    if (!r || typeof r.uri !== 'string' || !Number.isFinite(r.width) || !Number.isFinite(r.height) || r.width <= 0 || r.height <= 0) return false;
    try { return new URL(r.uri).protocol === 'https:'; } catch { return false; }
  });
  return valid.sort((a, b) => b.width * b.height - a.width * a.height || Number(!!b.is_preferred) - Number(!!a.is_preferred) || a.uri.localeCompare(b.uri))[0] ?? null;
}

export async function enrichVideoPosters(creatives: MetaAdCreativeSeed[], accessToken: string) {
  const ids = [...new Set(creatives.flatMap(c => c.videoId && /^\d+$/.test(c.videoId) ? [c.videoId] : []))].slice(0, 20);
  const posters = new Map<string, Poster>();
  // Bounded, deduplicated read-only lookups, never one request per rendered card.
  for (let index = 0; index < ids.length; index += 3) {
    await Promise.all(ids.slice(index, index + 3).map(async id => {
      try {
        const response = await fetchMetaObject<{ data?: unknown }>({ path: `${id}/thumbnails`, accessToken,
          params: { fields: 'uri,width,height,is_preferred', limit: 20 }, signal: AbortSignal.timeout(8000) });
        const poster = bestVideoPoster(response.data);
        if (poster) posters.set(id, poster);
      } catch { console.warn('Meta video poster unavailable; retaining synced creative media', { videoId: id }); }
    }));
  }
  return creatives.map(c => {
    const poster = c.videoId ? posters.get(c.videoId) : null;
    return poster ? { ...c, raw: { ...asRecord(c.raw), deepvisor_video_poster: poster } as MetaAdCreativeSeed['raw'] } : c;
  });
}
