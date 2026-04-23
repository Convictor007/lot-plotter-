import { apiUrl } from '@/lib/api/api-url';

/**
 * Loads a protected image endpoint as a data URI (works on web + native where
 * `Image` + `source.headers` or `blob:` URLs are unreliable).
 */
export async function fetchAuthenticatedImageDataUri(
  relativeApiPath: string,
  token: string
): Promise<string | null> {
  try {
    const r = await fetch(apiUrl(relativeApiPath), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    if (!ab.byteLength) return null;

    const rawCt = r.headers.get('content-type') ?? 'image/jpeg';
    const mime = rawCt.split(';')[0].trim();
    const mimeSafe = mime.startsWith('image/') ? mime : 'image/jpeg';

    const bytes = new Uint8Array(ab);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof globalThis.btoa !== 'function') return null;
    const base64 = globalThis.btoa(binary);
    return `data:${mimeSafe};base64,${base64}`;
  } catch {
    return null;
  }
}
