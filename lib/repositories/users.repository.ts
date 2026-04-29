import type { ResultSetHeader, RowDataPacket } from 'mysql2';

import type { PublicUser, UserRow, VerificationStatus } from '@/database/models';
import { getPool } from '@/lib/db/client';

const USER_SELECT = `
  SELECT
    u.user_id AS User_id,
    u.email,
    u.password_hash,
    u.role,
    p.first_name,
    p.last_name,
    p.phone_number,
    p.gender,
    NULL AS age,
    p.date_of_birth,
    a.street_address,
    a.region,
    a.postal_code,
    a.barangay,
    a.municipality,
    a.province,
    COALESCE(po.verification_status, 'unverified') AS verification_status,
    po.id_document_file_name,
    po.id_document_mime_type,
    p.profile_picture_file_name,
    p.profile_picture_mime_type,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN user_profiles p ON p.user_id = u.user_id
  LEFT JOIN user_addresses a ON a.user_id = u.user_id AND a.is_primary = 1
  LEFT JOIN property_owners po ON po.user_id = u.user_id
`;

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
    `${USER_SELECT} WHERE u.email = ? LIMIT 1`,
    [email.trim().toLowerCase()]
  );
  if (!rows.length) return null;
  return coerceUserRow(rows[0]);
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `${USER_SELECT} WHERE u.user_id = ? LIMIT 1`,
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [input.email.trim().toLowerCase(), input.password_hash, input.role, now, now]
    );
    const userId = res.insertId;

    await conn.execute(
      `INSERT INTO user_profiles (
         user_id, first_name, last_name, phone_number, gender, date_of_birth, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        input.first_name,
        input.last_name,
        input.phone_number ?? null,
        input.gender ?? null,
        input.date_of_birth ?? null,
        now,
        now,
      ]
    );

    await conn.execute(
      `INSERT INTO user_addresses (
         user_id, street_address, barangay, municipality, province, region, postal_code, is_primary, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        userId,
        input.street_address ?? null,
        input.barangay ?? null,
        input.municipality,
        input.province,
        input.region ?? null,
        input.postal_code ?? null,
        now,
        now,
      ]
    );

    if (input.role === 'citizen') {
      await conn.execute(
        `INSERT INTO property_owners (
           user_id, verification_status, id_document_file_name, id_document_mime_type, created_at, updated_at
         ) VALUES (?, ?, NULL, NULL, ?, ?)`,
        [userId, input.verification_status, now, now]
      );
    } else if (input.role === 'assessor') {
      await conn.execute(
        `INSERT INTO assessors (user_id, created_at, updated_at) VALUES (?, ?, ?)`,
        [userId, now, now]
      );
    } else if (input.role === 'admin') {
      await conn.execute(
        `INSERT INTO admins (user_id, created_at, updated_at) VALUES (?, ?, ?)`,
        [userId, now, now]
      );
    }

    await conn.commit();
    return userId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
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
  const now = new Date();
  const profileFields: string[] = [];
  const profileValues: unknown[] = [];
  const addressFields: string[] = [];
  const addressValues: unknown[] = [];

  if (patch.first_name !== undefined) {
    profileFields.push('first_name = ?');
    profileValues.push(patch.first_name);
  }
  if (patch.last_name !== undefined) {
    profileFields.push('last_name = ?');
    profileValues.push(patch.last_name);
  }
  if (patch.phone_number !== undefined) {
    profileFields.push('phone_number = ?');
    profileValues.push(patch.phone_number);
  }
  if (patch.gender !== undefined) {
    profileFields.push('gender = ?');
    profileValues.push(patch.gender);
  }
  if (patch.date_of_birth !== undefined) {
    profileFields.push('date_of_birth = ?');
    profileValues.push(patch.date_of_birth);
  }
  if (patch.street_address !== undefined) {
    addressFields.push('street_address = ?');
    addressValues.push(patch.street_address);
  }
  if (patch.region !== undefined) {
    addressFields.push('region = ?');
    addressValues.push(patch.region);
  }
  if (patch.postal_code !== undefined) {
    addressFields.push('postal_code = ?');
    addressValues.push(patch.postal_code);
  }
  if (patch.barangay !== undefined) {
    addressFields.push('barangay = ?');
    addressValues.push(patch.barangay);
  }
  if (patch.municipality !== undefined) {
    addressFields.push('municipality = ?');
    addressValues.push(patch.municipality);
  }
  if (patch.province !== undefined) {
    addressFields.push('province = ?');
    addressValues.push(patch.province);
  }
  if (!profileFields.length && !addressFields.length) return true;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (profileFields.length) {
      await conn.execute(
        `INSERT INTO user_profiles (user_id, first_name, last_name, created_at, updated_at)
         VALUES (?, '', '', ?, ?)
         ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`,
        [userId, now, now]
      );
      profileFields.push('updated_at = ?');
      profileValues.push(now, userId);
      await conn.execute(
        `UPDATE user_profiles SET ${profileFields.join(', ')} WHERE user_id = ?`,
        profileValues as (string | number | Date | null)[]
      );
    }

    if (addressFields.length) {
      const [existingAddr] = await conn.execute<RowDataPacket[]>(
        `SELECT address_id FROM user_addresses WHERE user_id = ? AND is_primary = 1 LIMIT 1`,
        [userId]
      );
      if (!existingAddr.length) {
        await conn.execute(
          `INSERT INTO user_addresses (
             user_id, street_address, barangay, municipality, province, region, postal_code, is_primary, created_at, updated_at
           ) VALUES (?, NULL, NULL, ?, ?, NULL, NULL, 1, ?, ?)`,
          [userId, String(patch.municipality ?? ''), String(patch.province ?? ''), now, now]
        );
      }
      addressFields.push('updated_at = ?');
      addressValues.push(now, userId);
      await conn.execute(
        `UPDATE user_addresses SET ${addressFields.join(', ')} WHERE user_id = ? AND is_primary = 1`,
        addressValues as (string | number | Date | null)[]
      );
    }

    await conn.execute(`UPDATE users SET updated_at = ? WHERE user_id = ?`, [now, userId]);
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updatePasswordHash(userId: number, password_hash: string): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?`,
    [password_hash, new Date(), userId]
  );
  return res.affectedRows > 0;
}

export async function updateVerificationStatus(userId: number, verification_status: VerificationStatus): Promise<boolean> {
  const pool = getPool();
  const [ensure] = await pool.execute<ResultSetHeader>(
    `INSERT INTO property_owners (user_id, verification_status, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE verification_status = VALUES(verification_status), updated_at = VALUES(updated_at)`,
    [userId, verification_status, new Date(), new Date()]
  );
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET updated_at = ? WHERE user_id = ?`,
    [new Date(), userId]
  );
  return ensure.affectedRows > 0 || res.affectedRows > 0;
}

/** Saves uploaded ID file metadata and sets status to pending (citizen upload). */
export async function setUserIdDocumentAndPending(
  userId: number,
  id_document_file_name: string,
  id_document_mime_type: string | null
): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO property_owners (
       user_id, verification_status, id_document_file_name, id_document_mime_type, created_at, updated_at
     ) VALUES (?, 'pending', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       verification_status = 'pending',
       id_document_file_name = VALUES(id_document_file_name),
       id_document_mime_type = VALUES(id_document_mime_type),
       updated_at = VALUES(updated_at)`,
    [userId, id_document_file_name, id_document_mime_type, new Date(), new Date()]
  );
  await pool.execute(`UPDATE users SET updated_at = ? WHERE user_id = ?`, [new Date(), userId]);
  return res.affectedRows > 0;
}

export async function setUserProfilePicture(
  userId: number,
  profile_picture_file_name: string,
  profile_picture_mime_type: string | null
): Promise<boolean> {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO user_profiles (user_id, first_name, last_name, created_at, updated_at)
     VALUES (?, '', '', ?, ?)
     ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`,
    [userId, new Date(), new Date()]
  );
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE user_profiles SET profile_picture_file_name = ?, profile_picture_mime_type = ?, updated_at = ? WHERE user_id = ?`,
    [profile_picture_file_name, profile_picture_mime_type, new Date(), userId]
  );
  await pool.execute(`UPDATE users SET updated_at = ? WHERE user_id = ?`, [new Date(), userId]);
  return res.affectedRows > 0;
}

export async function clearUserProfilePicture(userId: number): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE user_profiles SET profile_picture_file_name = NULL, profile_picture_mime_type = NULL, updated_at = ? WHERE user_id = ?`,
    [new Date(), userId]
  );
  await pool.execute(`UPDATE users SET updated_at = ? WHERE user_id = ?`, [new Date(), userId]);
  return res.affectedRows > 0;
}

/** Staff queue: citizens with a given verification status (no password_hash in rows). */
export async function listPublicUsersByVerificationStatus(status: VerificationStatus): Promise<PublicUser[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `${USER_SELECT}
     WHERE u.role = 'citizen' AND COALESCE(po.verification_status, 'unverified') = ?
     ORDER BY u.updated_at DESC`,
    [status]
  );
  return rows.map((raw) => {
    const withPwd = { ...raw, password_hash: '' } as RowDataPacket;
    return toPublicUser(coerceUserRow(withPwd));
  });
}
