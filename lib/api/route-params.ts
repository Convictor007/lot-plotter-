/** Resolve dynamic segment from Expo Router API context (sync or async params). */
export async function paramId(
  ctx: { params?: Promise<Record<string, string>> | Record<string, string> } | undefined,
  key: string
): Promise<string | undefined> {
  const raw = ctx?.params;
  if (raw == null) return undefined;
  const p = raw instanceof Promise ? await raw : raw;
  if (p == null || typeof p !== 'object') return undefined;
  const v = p[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Fallback when `ctx.params` is missing (seen on some nested API routes, e.g. `users/[userId]/avatar+api`).
 * Reads the segment immediately after `/api/users/` from the request URL.
 */
export function userIdSegmentFromRequestUrl(req: Request): string | undefined {
  try {
    const parts = new URL(req.url).pathname.split('/').filter(Boolean);
    const uIdx = parts.indexOf('users');
    if (uIdx === -1 || parts[uIdx + 1] == null || parts[uIdx + 1] === '') return undefined;
    return parts[uIdx + 1];
  } catch {
    return undefined;
  }
}
