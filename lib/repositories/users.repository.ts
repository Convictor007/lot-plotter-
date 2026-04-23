import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import type { PublicUser, UserRow, VerificationStatus } from '@/database/models';
import { getPool } from '@/lib/db/client';

function coerceUserRow(raw: RowDataPacket): UserRow {
  const r = raw as Record<string, unknown>;
  const idFn = r.id_document_file_name;
  const idMime = r.id_document_mime_type;
  const ppFn = r.profile_picture_file_name;
  const ppMime = r.profile_picture_mime_type;
  return {
    ...(raw as unknown as UserRow),
    age: r.age != null && r.age !== '' ? Number(r.age) : null,
    id_document_file_name:
      idFn != null && idFn !== '' ? String(idFn) : null,
    id_document_mime_type:
      idMime != null && idMime !== '' ? String(idMime) : null,
    profile_picture_file_name:
      ppFn != null && ppFn !== '' ? String(ppFn) : null,
    profile_picture_mime_type:
      ppMime != null && ppMime !== '' ? String(ppMime) : null,
  };
}

function toPublicUser(row: UserRow): PublicUser {
  const { password_hash: _, ...rest } = row;
  return rest;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT User_id, email, password_hash, role, first_name, last_name, phone_number,
            gender, age, date_of_birth, street_address, region, postal_code,
            barangay, municipality, province, verification_status,
            id_document_file_name, id_document_mime_type,
            profile_picture_file_name, profile_picture_mime_type, created_at, updated_at
     FROM users WHERE email = ? LIMIT 1`,
    [email.trim().toLowerCase()]
  );
  if (!rows.length) return null;
  return coerceUserRow(rows[0]);
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT User_id, email, password_hash, role, first_name, last_name, phone_number,
            gender, age, date_of_birth, street_address, region, postal_code,
            barangay, municipality, province, verification_status,
            id_document_file_name, id_document_mime_type,
            profile_picture_file_name, profile_picture_mime_type, created_at, updated_at
     FROM users WHERE User_id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return coerceUserRow(rows[0]);
}

export async function getPublicUserById(id: number): Promise<PublicUser | null> {
  const row = await findUserById(id);
  return row ? toPublicUser(row) : null;
}

export async function createUser(input: {
  email: string;
  password_hash: string;
  role: UserRow['role'];
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  gender?: string | null;
  age?: number | null;
  date_of_birth?: string | null;
  street_address?: string | null;
  region?: string | null;
  postal_code?: string | null;
  barangay?: string | null;
  municipality: string;
  province: string;
  verification_status: VerificationStatus;
}): Promise<number> {
  const pool = getPool();
  const now = new Date();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (
      email, password_hash, role, first_name, last_name, phone_number,
      gender, age, date_of_birth, street_address, region, postal_code,
      barangay, municipality, province, verification_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.email.trim().toLowerCase(),
      input.password_hash,
      input.role,
      input.first_name,
      input.last_name,
      input.phone_number ?? null,
      input.gender ?? null,
      input.age ?? null,
      input.date_of_birth ?? null,
      input.street_address ?? null,
      input.region ?? null,
      input.postal_code ?? null,
      input.barangay ?? null,
      input.municipality,
      input.province,
      input.verification_status,
      now,
      now,
    ]
  );
  return res.insertId;
}

export type UserProfilePatch = Partial<
  Pick<
    UserRow,
    | 'first_name'
    | 'last_name'
    | 'phone_number'
    | 'gender'
    | 'age'
    | 'street_address'
    | 'region'
    | 'postal_code'
    | 'barangay'
    | 'municipality'
    | 'province'
  >
> & {
  date_of_birth?: string | Date | null;
};

export async function updateUserProfile(userId: number, patch: UserProfilePatch): Promise<boolean> {
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.first_name !== undefined) {
    fields.push('first_name = ?');
    values.push(patch.first_name);
  }
  if (patch.last_name !== undefined) {
    fields.push('last_name = ?');
    values.push(patch.last_name);
  }
  if (patch.phone_number !== undefined) {
    fields.push('phone_number = ?');
    values.push(patch.phone_number);
  }
  if (patch.gender !== undefined) {
    fields.push('gender = ?');
    values.push(patch.gender);
  }
  if (patch.age !== undefined) {
    fields.push('age = ?');
    values.push(patch.age);
  }
  if (patch.date_of_birth !== undefined) {
    fields.push('date_of_birth = ?');
    values.push(patch.date_of_birth);
  }
  if (patch.street_address !== undefined) {
    fields.push('street_address = ?');
    values.push(patch.street_address);
  }
  if (patch.region !== undefined) {
    fields.push('region = ?');
    values.push(patch.region);
  }
  if (patch.postal_code !== undefined) {
    fields.push('postal_code = ?');
    values.push(patch.postal_code);
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
  if (!fields.length) return true;
  fields.push('updated_at = ?');
  values.push(new Date());
  values.push(userId);
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET ${fields.join(', ')} WHERE User_id = ?`,
    values as (string | number | Date | null)[]
  );
  return res.affectedRows > 0;
}

export async function updatePasswordHash(userId: number, password_hash: string): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET password_hash = ?, updated_at = ? WHERE User_id = ?`,
    [password_hash, new Date(), userId]
  );
  return res.affectedRows > 0;
}

export async function updateVerificationStatus(userId: number, verification_status: VerificationStatus): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET verification_status = ?, updated_at = ? WHERE User_id = ?`,
    [verification_status, new Date(), userId]
  );
  return res.affectedRows > 0;
}

/** Saves uploaded ID file metadata and sets status to pending (citizen upload). */
export async function setUserIdDocumentAndPending(
  userId: number,
  id_document_file_name: string,
  id_document_mime_type: string | null
): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET id_document_file_name = ?, id_document_mime_type = ?, verification_status = 'pending', updated_at = ? WHERE User_id = ?`,
    [id_document_file_name, id_document_mime_type, new Date(), userId]
  );
  return res.affectedRows > 0;
}

export async function setUserProfilePicture(
  userId: number,
  profile_picture_file_name: string,
  profile_picture_mime_type: string | null
): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET profile_picture_file_name = ?, profile_picture_mime_type = ?, updated_at = ? WHERE User_id = ?`,
    [profile_picture_file_name, profile_picture_mime_type, new Date(), userId]
  );
  return res.affectedRows > 0;
}

export async function clearUserProfilePicture(userId: number): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET profile_picture_file_name = NULL, profile_picture_mime_type = NULL, updated_at = ? WHERE User_id = ?`,
    [new Date(), userId]
  );
  return res.affectedRows > 0;
}

/** Staff queue: citizens with a given verification status (no password_hash in rows). */
export async function listPublicUsersByVerificationStatus(status: VerificationStatus): Promise<PublicUser[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT User_id, email, role, first_name, last_name, phone_number,
            gender, age, date_of_birth, street_address, region, postal_code,
            barangay, municipality, province, verification_status,
            id_document_file_name, id_document_mime_type,
            profile_picture_file_name, profile_picture_mime_type, created_at, updated_at
     FROM users WHERE verification_status = ? ORDER BY updated_at DESC`,
    [status]
  );
  return rows.map((raw) => {
    const withPwd = { ...raw, password_hash: '' } as RowDataPacket;
    return toPublicUser(coerceUserRow(withPwd));
  });
}
