import type { UserRole } from '@/database/models';
import { verifyUserToken } from '@/lib/auth/jwt';

export type AuthContext = {
  userId: number;
  email: string;
  role: UserRole;
};

export async function getBearerAuth(req: Request): Promise<AuthContext | null> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const payload = await verifyUserToken(token);
  if (!payload) return null;
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role as UserRole,
  };
}

export function requireRoles(ctx: AuthContext, allowed: UserRole[]): boolean {
  return allowed.includes(ctx.role);
}
