import * as fs from 'fs';
import * as path from 'path';

import { publicUserToJson } from '@/lib/api/public-user';
import { getBearerAuth } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import {
  PROFILE_PICTURES_DIR,
  tryUnlinkProfilePicture,
} from '@/lib/profile-picture-storage';
import {
  clearUserProfilePicture,
  findUserById,
  getPublicUserById,
  setUserProfilePicture,
} from '@/lib/repositories/users.repository';

const MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Multipart field `photo`: image/jpeg, image/png, or image/webp.
 */
export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const fd = (await req.formData()) as unknown as { get: (name: string) => unknown };
    const file = fd.get('photo');
    if (
      !file ||
      typeof file !== 'object' ||
      typeof (file as Blob).arrayBuffer !== 'function'
    ) {
      return Response.json({ success: false, message: 'No image uploaded.' }, { status: 400 });
    }

    const blob = file as Blob;
    if (blob.size > MAX_BYTES) {
      return Response.json(
        { success: false, message: 'Image is too large. Maximum size is 5 MB.' },
        { status: 400 }
      );
    }

    const mime = typeof blob.type === 'string' ? blob.type.toLowerCase() : '';
    if (!mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png') && !mime.includes('webp')) {
      return Response.json(
        { success: false, message: 'Only JPEG, PNG, or WebP images are allowed.' },
        { status: 400 }
      );
    }

    const existing = await findUserById(auth.userId);
    if (!existing) {
      return Response.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.mkdirSync(PROFILE_PICTURES_DIR, { recursive: true });
    const ext = extFromMime(mime);
    const filename = `pp_${auth.userId}_${Date.now()}.${ext}`;
    const fullPath = path.join(PROFILE_PICTURES_DIR, filename);

    if (existing.profile_picture_file_name) {
      tryUnlinkProfilePicture(existing.profile_picture_file_name);
    }

    fs.writeFileSync(fullPath, buffer);

    const mimeStored = mime && mime.length < 120 ? mime : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const ok = await setUserProfilePicture(auth.userId, filename, mimeStored);
    if (!ok) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        //
      }
      return Response.json({ success: false, message: 'Could not save profile picture.' }, { status: 500 });
    }

    const user = await getPublicUserById(auth.userId);
    if (!user) {
      return Response.json({ success: false, message: 'User not found.' }, { status: 404 });
    }
    return Response.json({ success: true, user: publicUserToJson(user) });
  } catch (e) {
    console.error('users/me/profile-picture POST:', e);
    return Response.json({ success: false, message: 'Upload failed.' }, { status: 500 });
  }
}

/** Removes the stored profile picture and file from disk. */
export async function DELETE(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const row = await findUserById(auth.userId);
    if (row?.profile_picture_file_name) {
      tryUnlinkProfilePicture(row.profile_picture_file_name);
    }
    await clearUserProfilePicture(auth.userId);
    const user = await getPublicUserById(auth.userId);
    if (!user) {
      return Response.json({ success: false, message: 'User not found.' }, { status: 404 });
    }
    return Response.json({ success: true, user: publicUserToJson(user) });
  } catch (e) {
    console.error('users/me/profile-picture DELETE:', e);
    return Response.json({ success: false, message: 'Failed to remove picture.' }, { status: 500 });
  }
}
