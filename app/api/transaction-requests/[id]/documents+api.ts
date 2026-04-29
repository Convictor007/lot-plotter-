import * as fs from 'fs';
import * as path from 'path';

import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { paramId } from '@/lib/api/route-params';
import { isDbConfigured } from '@/lib/db/client';
import { findTransactionById } from '@/lib/repositories/transaction-requests.repository';
import {
  insertRequestDocument,
  listDocumentsForTransaction,
} from '@/lib/repositories/request-documents.repository';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const idStr = await paramId(ctx, 'id');
  const transactionId = Number(idStr);
  if (!idStr || !Number.isFinite(transactionId)) {
    return Response.json({ success: false, message: 'Invalid id.' }, { status: 400 });
  }

  try {
    const row = await findTransactionById(transactionId);
    if (!row) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }
    if (row.user_id !== auth.userId && !requireRoles(auth, ['assessor', 'admin'])) {
      return Response.json({ success: false, message: 'Forbidden.' }, { status: 403 });
    }
    const docs = await listDocumentsForTransaction(transactionId);
    return Response.json({ success: true, data: docs });
  } catch (e) {
    console.error('documents GET:', e);
    return Response.json({ success: false, message: 'Failed to list documents.' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const idStr = await paramId(ctx, 'id');
  const transactionId = Number(idStr);
  if (!idStr || !Number.isFinite(transactionId)) {
    return Response.json({ success: false, message: 'Invalid id.' }, { status: 400 });
  }

  try {
    const row = await findTransactionById(transactionId);
    if (!row) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }
    if (row.user_id !== auth.userId) {
      return Response.json({ success: false, message: 'Only the owner may upload documents.' }, { status: 403 });
    }

    const fd = (await req.formData()) as unknown as { get: (name: string) => unknown };
    const docType = (fd.get('type') as string) || 'other';
    const file = fd.get('file');
    if (!file || typeof (file as Blob).arrayBuffer !== 'function') {
      return Response.json({ success: false, message: 'Missing file field (multipart form).' }, { status: 400 });
    }

    const blob = file as Blob;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const origName =
      typeof (file as File).name === 'string' ? (file as File).name : `upload_${Date.now()}`;
    const mime = (blob as Blob).type || 'application/octet-stream';

    const safeDir = path.join(process.cwd(), 'assets', 'temp', 'request-docs', String(transactionId));
    fs.mkdirSync(safeDir, { recursive: true });
    const diskName = `${Date.now()}_${origName.replace(/[^a-zA-Z0-9._-]/g, '_')}`.slice(0, 200);
    const diskPath = path.join(safeDir, diskName);
    fs.writeFileSync(diskPath, buffer);

    const publicPath = `/storage/request-docs/${transactionId}/${diskName}`;
    const docId = await insertRequestDocument({
      transaction_request_id: transactionId,
      type: docType.slice(0, 48),
      file_name: origName.slice(0, 512),
      file_url: publicPath,
      file_size: buffer.length,
      mime_type: mime.slice(0, 128),
      uploaded_by_user_id: auth.userId,
    });

    return Response.json(
      {
        success: true,
        data: { Documents_id: docId, file_url: publicPath },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('documents POST:', e);
    return Response.json({ success: false, message: 'Upload failed.' }, { status: 500 });
  }
}
