import type { VerificationStatus } from '@/database/models';
import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { paramId, userIdSegmentFromRequestUrl } from '@/lib/api/route-params';
import { publicUserToJson } from '@/lib/api/public-user';
import { getPublicUserById, updateVerificationStatus } from '@/lib/repositories/users.repository';

const STAFF_ALLOWED: VerificationStatus[] = ['verified', 'unverified', 'rejected'];

type Body = { verification_status?: unknown };

/**
 * Assessor/admin sets identity verification after reviewing ID upload and profile.
 * Allowed values: `verified` (approve), `rejected` (decline — citizen can re-upload), or `unverified` (reset).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ userId: string }> | { userId: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth || !requireRoles(auth, ['assessor', 'admin'])) {
    return Response.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }

  let idStr = await paramId(ctx, 'userId');
  if (!idStr) idStr = userIdSegmentFromRequestUrl(req);
  const userId = Number(idStr);
  if (!idStr || !Number.isFinite(userId)) {
    return Response.json({ success: false, message: 'Invalid user id.' }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const next = body.verification_status;
  if (typeof next !== 'string' || !STAFF_ALLOWED.includes(next as VerificationStatus)) {
    return Response.json(
      {
        success: false,
        message: 'verification_status must be "verified", "rejected", or "unverified".',
      },
      { status: 400 }
    );
  }

  try {
    const existing = await getPublicUserById(userId);
    if (!existing) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }

    const ok = await updateVerificationStatus(userId, next as VerificationStatus);
    if (!ok) {
      return Response.json({ success: false, message: 'Update failed.' }, { status: 500 });
    }

    const updated = await getPublicUserById(userId);
    return Response.json({
      success: true,
      data: updated ? publicUserToJson(updated) : null,
    });
  } catch (e) {
    console.error('users/[userId]/verification PATCH:', e);
    return Response.json({ success: false, message: 'Failed to update verification.' }, { status: 500 });
  }
}
