import type { VerificationStatus } from '@/database/models';
import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { publicUserToJson } from '@/lib/api/public-user';
import { listPublicUsersByVerificationStatus } from '@/lib/repositories/users.repository';

/**
 * Lists citizen accounts waiting on ID review (`verification_status = pending`).
 * Assessor or admin only.
 */
export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth || !requireRoles(auth, ['assessor', 'admin'])) {
    return Response.json({ success: false, message: 'Forbidden.' }, { status: 403 });
  }

  try {
    const status: VerificationStatus = 'pending';
    const rows = await listPublicUsersByVerificationStatus(status);
    return Response.json({
      success: true,
      data: rows.map(publicUserToJson),
    });
  } catch (e) {
    console.error('users/pending-verification GET:', e);
    return Response.json({ success: false, message: 'Failed to load queue.' }, { status: 500 });
  }
}
