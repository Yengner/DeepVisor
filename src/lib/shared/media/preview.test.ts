import { expect, it } from 'vitest';
import { previewSources, usablePreviewDimensions } from './preview';

it('rejects tiny thumbnails without rejecting portrait, square or landscape posters', () => {
  expect(usablePreviewDimensions(64, 64)).toBe(false);
  expect(usablePreviewDimensions(128, 128)).toBe(false);
  expect(usablePreviewDimensions(480, 854)).toBe(true);
  expect(usablePreviewDimensions(1080, 1080)).toBe(true);
  expect(usablePreviewDimensions(800, 200)).toBe(true);
  expect(usablePreviewDimensions(NaN, 854)).toBe(false);
});
it('advances past expired or tiny sources, deduplicates and exhausts safely', () => {
  const media = { image: 'expired', fallbackImages: ['tiny', 'portrait', 'portrait'], fallbackImage: 'square' };
  expect(previewSources(media, ['expired', 'tiny'])).toEqual(['portrait', 'square']);
  expect(previewSources(media, ['expired', 'tiny', 'portrait', 'square'])).toEqual([]);
});
