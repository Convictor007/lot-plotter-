import type { TransactionStatus } from '@/database/models';
import { getBearerAuth, requireRoles } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { paramId } from '@/lib/api/route-params';
import {
  findTransactionById,
  updateTransactionAssessor,
} from '@/lib/repositories/transaction-requests.repository';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const idStr = await paramId(ctx, 'id');
  const id = Number(idStr);
  if (!idStr || !Number.isFinite(id)) {
    return Response.json({ success: false, message: 'Invalid id.' }, { status: 400 });
  }

  try {
    const row = await findTransactionById(id);
    if (!row) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }
    if (row.user_id !== auth.userId && !requireRoles(auth, ['assessor', 'admin'])) {
      return Response.json({ success: false, message: 'Forbidden.' }, { status: 403 });
    }
    return Response.json({ success: true, data: row });
  } catch (e) {
    console.error('transaction-requests/[id] GET:', e);
    return Response.json({ success: false, message: 'Failed to load request.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }
  if (!requireRoles(auth, ['assessor', 'admin'])) {
    return Response.json({ success: false, message: 'Assessor or admin only.' }, { status: 403 });
  }

  const idStr = await paramId(ctx, 'id');
  const id = Number(idStr);
  if (!idStr || !Number.isFinite(id)) {
    return Response.json({ success: false, message: 'Invalid id.' }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: TransactionStatus;
      assessor_notes?: string | null;
      completed_at?: string | null;
    };
    const row = await findTransactionById(id);
    if (!row) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }

    const completed_at = body.completed_at ? new Date(body.completed_at) : undefined;
    const ok = await updateTransactionAssessor(id, {
      status: body.status,
      assessor_notes: body.assessor_notes,
      completed_at: completed_at === undefined ? undefined : completed_at,
    });
    if (!ok) {
      return Response.json({ success: false, message: 'Nothing to update.' }, { status: 400 });
    }
    const updated = await findTransactionById(id);
    return Response.json({ success: true, data: updated });
  } catch (e) {
    console.error('transaction-requests/[id] PATCH:', e);
    return Response.json({ success: false, message: 'Failed to update request.' }, { status: 500 });
  }
}
