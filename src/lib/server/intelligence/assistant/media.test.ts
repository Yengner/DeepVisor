import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./access', () => ({ AssistantError: class extends Error {
    } }));
import { validateMedia, verifiedMediaType, MAX_MEDIA_BYTES } from './media';
it('checks signatures and claimed MIME, rejects executable content and oversized uploads', () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    expect(validateMedia(png, 'image/png')).toBe('image/png');
    expect(() => validateMedia(png, 'video/mp4')).toThrow();
    expect(verifiedMediaType(new TextEncoder().encode('<svg onload="bad()"/>'))).toBeNull();
    expect(() => validateMedia(new Uint8Array(MAX_MEDIA_BYTES + 1), 'image/png')).toThrow('4 MB');
});
