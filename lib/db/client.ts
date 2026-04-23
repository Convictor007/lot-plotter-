import path from 'path';
import { config } from 'dotenv';
import mysql from 'mysql2/promise';

/** Load `.env` when API routes run (ensures MYSQL_* / JWT_SECRET are set outside app.config). */
config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

let pool: mysql.Pool | null = null;

export function isDbConfigured(): boolean {
  if (process.env.DATABASE_URL?.trim()) return true;
  return Boolean(process.env.MYSQL_DATABASE?.trim());
}

export function getPool(): mysql.Pool {
  if (!isDbConfigured()) {
    throw new Error('Database environment variables are not set.');
  }
  if (!pool) {
    const url = process.env.DATABASE_URL?.trim();
    pool = url
      ? mysql.createPool(url)
      : mysql.createPool({
          host: process.env.MYSQL_HOST || '127.0.0.1',
          port: Number(process.env.MYSQL_PORT || 3306),
          user: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD ?? '',
          database: process.env.MYSQL_DATABASE || 'iassess',
          waitForConnections: true,
          connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
        });
  }
  return pool;
}
