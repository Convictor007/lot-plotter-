import type { PublicUser, PublicUserJson, UserRow } from '@/database/models';

function isoDateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function isoDateTime(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function publicUserToJson(u: PublicUser): PublicUserJson {
  const hasDoc = Boolean(u.id_document_file_name?.trim());
  const hasPic = Boolean(u.profile_picture_file_name?.trim());
  return {
    User_id: u.User_id,
    email: u.email,
    role: u.role,
    first_name: u.first_name,
    last_name: u.last_name,
    phone_number: u.phone_number,
    gender: u.gender,
    age: u.age,
    date_of_birth: isoDateOnly(u.date_of_birth),
    street_address: u.street_address,
    region: u.region,
    postal_code: u.postal_code,
    barangay: u.barangay,
    municipality: u.municipality,
    province: u.province,
    verification_status: u.verification_status,
    has_id_document: hasDoc,
    id_document_mime_type: u.id_document_mime_type,
    id_document_url: hasDoc ? `/api/users/${u.User_id}/id-document` : null,
    has_profile_picture: hasPic,
    profile_picture_mime_type: u.profile_picture_mime_type,
    profile_picture_url: hasPic ? `/api/users/${u.User_id}/avatar` : null,
    created_at: isoDateTime(u.created_at),
    updated_at: isoDateTime(u.updated_at),
  };
}

export function userRowToPublicJson(row: UserRow): PublicUserJson {
  const { password_hash: _, ...pub } = row;
  return publicUserToJson(pub);
}
