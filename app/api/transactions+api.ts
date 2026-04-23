import type { TransactionStatus } from '@/database/models';
import { getBearerAuth } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { createTransaction, generateReferenceNumber } from '@/lib/repositories/transaction-requests.repository';

/**
 * Legacy path used by `new-request.tsx`. When MySQL + JWT are configured, requires Bearer token.
 * Prefer `POST /api/transaction-requests` for new clients.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      type?: string;
      propertyId?: string;
      status?: string;
      notes?: string;
      applicantName?: string;
      location?: string;
      documentsVerified?: unknown;
      submittedAt?: string;
    };

    const {
      type,
      propertyId,
      status,
      notes,
      applicantName,
      location,
      documentsVerified,
    } = body;

    if (!type || !applicantName || !propertyId) {
      return Response.json(
        { success: false, message: 'Missing required fields: type, applicantName, or propertyId' },
        { status: 400 }
      );
    }

    if (isDbConfigured()) {
      const auth = await getBearerAuth(req);
      if (!auth) {
        return Response.json(
          {
            success: false,
            message:
              'Unauthorized. Sign in via POST /api/auth/login and send Authorization: Bearer <token> with this request.',
          },
          { status: 401 }
        );
      }

      const notesPayload = JSON.stringify({
        applicantName,
        location,
        pin: propertyId,
        notes: notes ?? null,
        documentsVerified: documentsVerified ?? null,
        submittedAt: body.submittedAt ?? null,
      });
      const reference_number = generateReferenceNumber();
      const transactionId = await createTransaction({
        user_id: auth.userId,
        reference_number,
        type,
        status: (status as TransactionStatus) || 'submitted',
        notes: notesPayload,
      });

      return Response.json(
        {
          success: true,
          message: 'Transaction request created successfully',
          data: {
            id: String(transactionId),
            Transaction_id: transactionId,
            reference_number,
            ...body,
          },
        },
        { status: 201 }
      );
    }

    const newTransactionId = `txn_${Date.now()}`;
    return Response.json(
      {
        success: true,
        message: 'Transaction request created successfully (demo mode — no database).',
        data: {
          id: newTransactionId,
          ...body,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating transaction:', error);
    return Response.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
