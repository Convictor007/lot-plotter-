import * as jose from 'jose';

const encoder = new TextEncoder();

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET?.trim();
  if (!s || s === 'change-me') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production.');
    }
  }
  return encoder.encode(s || 'iassess-dev-secret-change-in-production');
}

export async function signUserToken(userId: number, email: string, role: string): Promise<string> {
  return new jose.SignJWT({ email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES || '7d')
    .sign(getSecret());
}

export async function verifyUserToken(
  token: string
): Promise<{ userId: number; email: string; role: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    const sub = payload.sub;
    if (!sub) return null;
    const userId = Number(sub);
    if (!Number.isFinite(userId)) return null;
    return {
      userId,
      email: String(payload.email ?? ''),
      role: String(payload.role ?? 'citizen'),
    };
  } catch {
    return null;
  }
}
