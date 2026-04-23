import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { paramId, userIdSegmentFromRequestUrl } from '@/lib/api/route-params';
import { publicUserToJson } from '@/lib/api/public-user';
import { getPublicUserById } from '@/lib/repositories/users.repository';

/**
 * Public profile for a user. Citizens may only read their own row; assessor/admin may read any.
 */
export async function GET(req: Request, ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  let idStr = await paramId(ctx, 'userId');
  if (!idStr) idStr = userIdSegmentFromRequestUrl(req);
  const userId = Number(idStr);
  if (!idStr || !Number.isFinite(userId)) {
    return Response.json({ success: false, message: 'Invalid user id.' }, { status: 400 });
  }

  if (auth.userId !== userId && !requireRoles(auth, ['assessor', 'admin'])) {
    return Response.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }

  try {
    const user = await getPublicUserById(userId);
    if (!user) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }
    return Response.json({ success: true, data: publicUserToJson(user) });
  } catch (e) {
    console.error('users/[userId] GET:', e);
    return Response.json({ success: false, message: 'Failed to load user.' }, { status: 500 });
  }
}
