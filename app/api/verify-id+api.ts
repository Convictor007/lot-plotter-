import * as fs from 'fs';
import * as path from 'path';

import { getBearerAuth } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { VERIFY_IDS_DIR, tryUnlinkIdDocument } from '@/lib/id-document-storage';
import { findUserById, setUserIdDocumentAndPending } from '@/lib/repositories/users.repository';

/**
 * Accepts a government / valid ID upload for account verification (file under assets/id).
 * Requires Bearer auth; updates `users.id_document_*` and sets verification to pending.
 */
export async function POST(req: Request) {
  try {
    const auth = await getBearerAuth(req);
    if (!auth) {
      return Response.json(
        { success: false, message: 'Sign in required. Please log in and try again.' },
        { status: 401 }
      );
    }

    const fd = (await req.formData()) as unknown as { get: (name: string) => unknown };
    const file = fd.get('idDocument');

    if (
      !file ||
      typeof file !== 'object' ||
      typeof (file as Blob).arrayBuffer !== 'function'
    ) {
      return Response.json({ success: false, message: 'No document uploaded.' }, { status: 400 });
    }

    const blob = file as Blob;
    if (blob.size > 12 * 1024 * 1024) {
      return Response.json(
        { success: false, message: 'File is too large. Maximum size is 12 MB.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return Response.json(
        { success: false, message: 'Server storage is not configured.' },
        { status: 503 }
      );
    }

    const user = await findUserById(auth.userId);
    if (!user) {
      return Response.json({ success: false, message: 'Account not found.' }, { status: 404 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.mkdirSync(VERIFY_IDS_DIR, { recursive: true });

    const mime = typeof (blob as Blob).type === 'string' ? (blob as Blob).type : '';
    const ext =
      mime.includes('pdf') ? '.pdf'
      : mime.includes('png') ? '.png'
      : mime.includes('jpeg') || mime.includes('jpg') ? '.jpg'
      : mime.includes('webp') ? '.webp'
      : '.bin';

    const safeEmail = user.email.replace(/[^a-z0-9@._+-]/gi, '_').slice(0, 80);
    const filename = `id_${Date.now()}_${safeEmail}${ext}`;
    const fullPath = path.join(VERIFY_IDS_DIR, filename);

    if (user.id_document_file_name) {
      tryUnlinkIdDocument(user.id_document_file_name);
    }

    fs.writeFileSync(fullPath, buffer);

    const mimeStored = mime && mime.length < 120 ? mime : null;
    const ok = await setUserIdDocumentAndPending(user.User_id, filename, mimeStored);
    if (!ok) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        //
      }
      return Response.json({ success: false, message: 'Could not save verification record.' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'ID received. Your account is pending verification. We will notify you when review is complete.',
      verificationStatus: 'pending' as const,
    });
  } catch (error) {
    console.error('verify-id:', error);
    return Response.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
