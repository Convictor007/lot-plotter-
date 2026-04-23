import type { ResultSetHeader } from 'mysql2';

import { getPool } from '@/lib/db/client';

export async function insertAuditLog(input: {
  user_id: number | null;
  action: string;
  ip_address: string;
  user_agent: string | null;
  details: Record<string, unknown> | null;
}): Promise<void> {
  const pool = getPool();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.user_id,
      input.action,
      input.ip_address,
      input.user_agent,
      input.details ? JSON.stringify(input.details) : null,
      new Date(),
    ]
  );
}

export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 45);
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.slice(0, 45);
  return '0.0.0.0';
}
