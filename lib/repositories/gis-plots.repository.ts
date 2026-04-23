import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import type { GisPlotRow } from '@/database/models';
import { getPool } from '@/lib/db/client';

export async function listGisPlotsForUser(userId: number): Promise<GisPlotRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT Gis_id, user_id, transaction_request_id, barangay, municipality, province,
            tie_points, center_lat, center_lng, zoom, polygon, area, Perimeter,
            extracted_from_title, title_file_name, historical_comparison_notes, created_at
     FROM gis_plots
     WHERE user_id = ?
     ORDER BY created_at DESC, Gis_id DESC`,
    [userId]
  );
  return rows as GisPlotRow[];
}

export async function findGisPlotById(id: number): Promise<GisPlotRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT Gis_id, user_id, transaction_request_id, barangay, municipality, province,
            tie_points, center_lat, center_lng, zoom, polygon, area, Perimeter,
            extracted_from_title, title_file_name, historical_comparison_notes, created_at
     FROM gis_plots WHERE Gis_id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return rows[0] as GisPlotRow;
}

export async function createGisPlot(input: {
  user_id: number;
  transaction_request_id?: number | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
  tie_points?: unknown;
  center_lat?: number | null;
  center_lng?: number | null;
  zoom?: number | null;
  polygon?: unknown;
  area?: number | null;
  perimeter?: number | null;
  extracted_from_title?: number;
  title_file_name?: string | null;
  historical_comparison_notes?: string | null;
}): Promise<number> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO gis_plots (
      user_id, transaction_request_id, barangay, municipality, province,
      tie_points, center_lat, center_lng, zoom, polygon, area, Perimeter,
      extracted_from_title, title_file_name, historical_comparison_notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.user_id,
      input.transaction_request_id ?? null,
      input.barangay ?? null,
      input.municipality ?? null,
      input.province ?? null,
      input.tie_points != null ? JSON.stringify(input.tie_points) : null,
      input.center_lat ?? null,
      input.center_lng ?? null,
      input.zoom ?? null,
      input.polygon != null ? JSON.stringify(input.polygon) : null,
      input.area ?? null,
      input.perimeter ?? null,
      input.extracted_from_title ?? 0,
      input.title_file_name ?? null,
      input.historical_comparison_notes ?? null,
      new Date(),
    ]
  );
  return res.insertId;
}

export async function updateGisPlot(
  gisId: number,
  userId: number,
  patch: Partial<{
    transaction_request_id: number | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
    tie_points: unknown;
    center_lat: number | null;
    center_lng: number | null;
    zoom: number | null;
    polygon: unknown;
    area: number | null;
    perimeter: number | null;
    historical_comparison_notes: string | null;
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
  if (patch.transaction_request_id !== undefined) {
    fields.push('transaction_request_id = ?');
    values.push(patch.transaction_request_id);
  }
  if (patch.barangay !== undefined) {
    fields.push('barangay = ?');
    values.push(patch.barangay);
  }
  if (patch.municipality !== undefined) {
    fields.push('municipality = ?');
    values.push(patch.municipality);
  }
  if (patch.province !== undefined) {
    fields.push('province = ?');
    values.push(patch.province);
  }
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
    fields.push('Perimeter = ?');
    values.push(patch.perimeter);
  }
  if (patch.historical_comparison_notes !== undefined) {
    fields.push('historical_comparison_notes = ?');
    values.push(patch.historical_comparison_notes);
  }
  if (!fields.length) return true;
  values.push(gisId, userId);
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE gis_plots SET ${fields.join(', ')} WHERE Gis_id = ? AND user_id = ?`,
    values as (string | number | Date | null)[]
  );
  return res.affectedRows > 0;
}
