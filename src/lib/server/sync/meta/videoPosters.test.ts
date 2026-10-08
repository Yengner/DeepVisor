import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./client', () => ({ fetchMetaObject: vi.fn() }));
import { fetchMetaObject } from './client';
import { bestVideoPoster, enrichVideoPosters } from './videoPosters';
import type { MetaAdCreativeSeed } from './types';
beforeEach(() => vi.clearAllMocks());
it('uses the largest valid same-video thumbnail, not a tiny preferred image', () => {
  expect(bestVideoPoster([{ uri: 'https://media.test/small', width: 100, height: 100, is_preferred: true }, { uri: 'https://media.test/large', width: 1280, height: 720 }, { uri: 'http://unsafe', width: 2000, height: 2000 }])?.width).toBe(1280);
  expect(bestVideoPoster(null)).toBeNull();
});
it('deduplicates video IDs and stores poster metadata without substituting another creative', async () => {
  vi.mocked(fetchMetaObject).mockResolvedValue({ data: [{ uri: 'https://media.test/poster', width: 1280, height: 720 }] });
  const input = [{ externalId: 'a', videoId: '123', raw: {} }, { externalId: 'b', videoId: '123', raw: {} }, { externalId: 'c', videoId: null }] as MetaAdCreativeSeed[];
  const output = await enrichVideoPosters(input, 'private');
  expect(fetchMetaObject).toHaveBeenCalledTimes(1);
  expect(fetchMetaObject).toHaveBeenCalledWith(expect.objectContaining({ path: '123/thumbnails', signal: expect.any(AbortSignal) }));
  expect(output[0].raw).toHaveProperty('deepvisor_video_poster.width', 1280);
  expect(output[2]).toBe(input[2]);
  expect(JSON.stringify(output)).not.toContain('private');
});
it('retains existing assets on permission, timeout or malformed responses', async () => {
  const input = [{ externalId: 'a', videoId: '123', thumbnailUrl: 'https://media.test/small' }] as MetaAdCreativeSeed[];
  vi.mocked(fetchMetaObject).mockRejectedValue(new Error('expired'));
  expect(await enrichVideoPosters(input, 'private')).toEqual(input);
  vi.mocked(fetchMetaObject).mockResolvedValue({ data: [{ uri: 'bad', width: 0 }] });
  expect(await enrichVideoPosters(input, 'private')).toEqual(input);
});
