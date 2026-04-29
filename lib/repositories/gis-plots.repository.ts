import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import type { GisPlotRow } from '@/database/models';
import { getPool } from '@/lib/db/client';

export async function listGisPlotsForUser(userId: number): Promise<GisPlotRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT gis_id AS Gis_id, owner_user_id AS user_id,
            tie_points, center_lat, center_lng, zoom, polygon, area, perimeter AS Perimeter, created_at
     FROM gis_plots
     WHERE owner_user_id = ?
     ORDER BY created_at DESC, gis_id DESC`,
    [userId]
  );
  return rows as GisPlotRow[];
}

export async function findGisPlotById(id: number): Promise<GisPlotRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT gis_id AS Gis_id, owner_user_id AS user_id,
            tie_points, center_lat, center_lng, zoom, polygon, area, perimeter AS Perimeter, created_at
     FROM gis_plots WHERE gis_id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return rows[0] as GisPlotRow;
}

export async function createGisPlot(input: {
  user_id: number;
  tie_points?: unknown;
  center_lat?: number | null;
  center_lng?: number | null;
  zoom?: number | null;
  polygon?: unknown;
  area?: number | null;
  perimeter?: number | null;
}): Promise<number> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO gis_plots (
      owner_user_id, tie_points, center_lat, center_lng, zoom, polygon, area, perimeter, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.user_id,
      input.tie_points != null ? JSON.stringify(input.tie_points) : null,
      input.center_lat ?? null,
      input.center_lng ?? null,
      input.zoom ?? null,
      input.polygon != null ? JSON.stringify(input.polygon) : null,
      input.area ?? null,
      input.perimeter ?? null,
      new Date(),
    ]
  );
  return res.insertId;
}

export async function updateGisPlot(
  gisId: number,
  userId: number,
  patch: Partial<{
    tie_points: unknown;
    center_lat: number | null;
    center_lng: number | null;
    zoom: number | null;
    polygon: unknown;
    area: number | null;
    perimeter: number | null;
  }>
): Promise<boolean> {
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  const setJson = (col: string, val: unknown) => {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(val != null ? JSON.stringify(val) : null);
    }
  };
  setJson('tie_points', patch.tie_points);
  if (patch.center_lat !== undefined) {
    fields.push('center_lat = ?');
    values.push(patch.center_lat);
  }
  if (patch.center_lng !== undefined) {
    fields.push('center_lng = ?');
    values.push(patch.center_lng);
  }
  if (patch.zoom !== undefined) {
    fields.push('zoom = ?');
    values.push(patch.zoom);
  }
  setJson('polygon', patch.polygon);
  if (patch.area !== undefined) {
    fields.push('area = ?');
    values.push(patch.area);
  }
  if (patch.perimeter !== undefined) {
    fields.push('perimeter = ?');
    values.push(patch.perimeter);
  }
  if (!fields.length) return true;
  values.push(gisId, userId);
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE gis_plots SET ${fields.join(', ')} WHERE gis_id = ? AND owner_user_id = ?`,
    values as (string | number | Date | null)[]
  );
  return res.affectedRows > 0;
}
