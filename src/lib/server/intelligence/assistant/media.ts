import 'server-only';
import { AssistantError } from './access';
export const MEDIA_BUCKET = 'assistant-draft-media';
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
export function verifiedMediaType(bytes: Uint8Array): string | null {
    if (bytes.length < 12)
        return null;
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'image/jpeg';
    if (bytes.slice(0, 8).every((b, i) => b === [137, 80, 78, 71, 13, 10, 26, 10][i]))
        return 'image/png';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
        return 'image/webp';
    if (ascii(4, 8) === 'ftyp' && ['isom', 'iso2', 'mp41', 'mp42', 'avc1'].includes(ascii(8, 12)))
        return 'video/mp4';
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 && ascii(0, Math.min(bytes.length, 128)).includes('webm'))
        return 'video/webm';
    return null;
}
export function validateMedia(bytes: Uint8Array, claimedType: string) {
    if (!bytes.length || bytes.length > MAX_MEDIA_BYTES)
        throw new AssistantError('Choose a file up to 4 MB.', 413);
    const mime = verifiedMediaType(bytes);
    if (!mime || mime !== claimedType)
        throw new AssistantError('Choose a valid JPEG, PNG, WebP, MP4 or WebM file.');
    return mime;
}
