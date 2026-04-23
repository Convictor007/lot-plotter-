import * as fs from 'fs';

import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { paramId, userIdSegmentFromRequestUrl } from '@/lib/api/route-params';
import { resolveProfilePicturePath } from '@/lib/profile-picture-storage';
import { findUserById } from '@/lib/repositories/users.repository';

function contentType(row: { profile_picture_mime_type: string | null; profile_picture_file_name: string | null }): string {
  if (row.profile_picture_mime_type?.trim()) return row.profile_picture_mime_type.trim();
  const n = row.profile_picture_file_name?.toLowerCase() ?? '';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Profile photo bytes. Allowed: the same user, or assessor/admin.
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
    const row = await findUserById(userId);
    if (!row?.profile_picture_file_name) {
      return Response.json({ success: false, message: 'No profile picture on file.' }, { status: 404 });
    }

    const fullPath = resolveProfilePicturePath(row.profile_picture_file_name);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return Response.json({ success: false, message: 'File missing.' }, { status: 404 });
    }

    const buf = fs.readFileSync(fullPath);
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType(row),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('users/[userId]/avatar GET:', e);
    return Response.json({ success: false, message: 'Failed to load image.' }, { status: 500 });
  }
}
