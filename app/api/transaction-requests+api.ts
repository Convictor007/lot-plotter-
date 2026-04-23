import type { TransactionStatus } from '@/database/models';
import { getBearerAuth } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import {
  createTransaction,
  generateReferenceNumber,
  listTransactionsForUser,
} from '@/lib/repositories/transaction-requests.repository';

/** List current user's transaction requests, or create one (authenticated). */
export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const rows = await listTransactionsForUser(auth.userId);
    return Response.json({ success: true, data: rows });
  } catch (e) {
    console.error('transaction-requests GET:', e);
    return Response.json({ success: false, message: 'Failed to list requests.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      type?: string;
      applicantName?: string;
      location?: string;
      propertyId?: string;
      notes?: string;
      status?: string;
    };

    if (!body.type) {
      return Response.json({ success: false, message: 'type is required.' }, { status: 400 });
    }

    const notesPayload = JSON.stringify({
      applicantName: body.applicantName ?? null,
      location: body.location ?? null,
      pin: body.propertyId ?? null,
      notes: body.notes?.trim() || null,
    });

    const reference_number = generateReferenceNumber();
    const transactionId = await createTransaction({
      user_id: auth.userId,
      reference_number,
      type: body.type,
      status: (body.status as TransactionStatus) || 'submitted',
      notes: notesPayload,
    });

    return Response.json(
      {
        success: true,
        message: 'Transaction request created.',
        data: {
          Transaction_id: transactionId,
          reference_number,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('transaction-requests POST:', e);
    return Response.json({ success: false, message: 'Failed to create request.' }, { status: 500 });
  }
}
