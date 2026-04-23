import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import type { TransactionRequestRow, TransactionStatus } from '@/database/models';
import { getPool } from '@/lib/db/client';

export function generateReferenceNumber(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listTransactionsForUser(userId: number): Promise<TransactionRequestRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT Transaction_id, reference_number, user_id, type, status, notes, assessor_notes,
            submitted_at, updated_at, completed_at
     FROM transaction_requests
     WHERE user_id = ?
     ORDER BY submitted_at DESC, Transaction_id DESC`,
    [userId]
  );
  return rows as TransactionRequestRow[];
}

export async function findTransactionById(id: number): Promise<TransactionRequestRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT Transaction_id, reference_number, user_id, type, status, notes, assessor_notes,
            submitted_at, updated_at, completed_at
     FROM transaction_requests WHERE Transaction_id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return rows[0] as TransactionRequestRow;
}

export async function createTransaction(input: {
  user_id: number;
  reference_number: string;
  type: string | null;
  status: TransactionStatus;
  notes: string | null;
}): Promise<number> {
  const pool = getPool();
  const now = new Date();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO transaction_requests (
      reference_number, user_id, type, status, notes, submitted_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.reference_number,
      input.user_id,
      input.type,
      input.status,
      input.notes,
      now,
      now,
    ]
  );
  return res.insertId;
}

export async function updateTransactionAssessor(
  transactionId: number,
  patch: {
    status?: TransactionStatus;
    assessor_notes?: string | null;
    completed_at?: Date | null;
  }
): Promise<boolean> {
  const pool = getPool();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [new Date()];
  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status);
  }
  if (patch.assessor_notes !== undefined) {
    fields.push('assessor_notes = ?');
    values.push(patch.assessor_notes);
  }
  if (patch.completed_at !== undefined) {
    fields.push('completed_at = ?');
    values.push(patch.completed_at);
  }
  values.push(transactionId);
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE transaction_requests SET ${fields.join(', ')} WHERE Transaction_id = ?`,
    values as (string | number | Date | null)[]
  );
  return res.affectedRows > 0;
}
