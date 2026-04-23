import * as fs from 'fs';

import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { paramId, userIdSegmentFromRequestUrl } from '@/lib/api/route-params';
import { resolveIdDocumentPath } from '@/lib/id-document-storage';
import { findUserById } from '@/lib/repositories/users.repository';

function contentTypeForUser(row: { id_document_mime_type: string | null; id_document_file_name: string | null }): string {
  if (row.id_document_mime_type?.trim()) return row.id_document_mime_type.trim();
  const n = row.id_document_file_name?.toLowerCase() ?? '';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Streams the citizen's uploaded ID file. Allowed: the same user, or assessor/admin.
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
    if (!row?.id_document_file_name) {
      return Response.json({ success: false, message: 'No ID document on file.' }, { status: 404 });
    }

    const fullPath = resolveIdDocumentPath(row.id_document_file_name);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return Response.json({ success: false, message: 'File missing.' }, { status: 404 });
    }

    const buf = fs.readFileSync(fullPath);
    const ct = contentTypeForUser(row);
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('users/[userId]/id-document GET:', e);
    return Response.json({ success: false, message: 'Failed to load document.' }, { status: 500 });
  }
}
