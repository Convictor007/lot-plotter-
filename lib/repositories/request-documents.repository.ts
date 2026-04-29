import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import type { RequestDocumentRow } from '@/database/models';
import { getPool } from '@/lib/db/client';

export async function listDocumentsForTransaction(transactionId: number): Promise<RequestDocumentRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT document_id AS Documents_id, transaction_request_id, type, file_name, file_url, file_size,
            mime_type, uploaded_by_user_id, status, uploaded_at,
            CASE WHEN status = 'approved' THEN 1 ELSE 0 END AS verified
     FROM request_documents
     WHERE transaction_request_id = ?
     ORDER BY uploaded_at ASC`,
    [transactionId]
  );
  return rows as RequestDocumentRow[];
}

export async function insertRequestDocument(input: {
  transaction_request_id: number;
  type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by_user_id?: number | null;
}): Promise<number> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO request_documents (
      transaction_request_id, type, status, file_name, file_url, file_size, mime_type, uploaded_by_user_id, uploaded_at
    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    [
      input.transaction_request_id,
      input.type,
      input.file_name,
      input.file_url,
      input.file_size,
      input.mime_type,
      input.uploaded_by_user_id ?? null,
      new Date(),
    ]
  );
  return res.insertId;
}
