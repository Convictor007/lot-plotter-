/**
 * Row shapes aligned with `database/schema.sql` (MySQL column names).
 */

export type UserRole = 'citizen' | 'assessor' | 'admin';

/** Matches `users.verification_status` ENUM in schema.sql */
export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export type TransactionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'pending_documents'
  | 'approved'
  | 'rejected'
  | 'ready_for_payment'
  | 'completed'
  | 'cancelled';

export interface UserRow {
  User_id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  gender: string | null;
  age: number | null;
  date_of_birth: Date | null;
  street_address: string | null;
  region: string | null;
  postal_code: string | null;
  barangay: string | null;
  municipality: string;
  province: string;
  verification_status: VerificationStatus;
  /** Basename under assets/id (set on ID upload). */
  id_document_file_name: string | null;
  id_document_mime_type: string | null;
  profile_picture_file_name: string | null;
  profile_picture_mime_type: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionRequestRow {
  Transaction_id: number;
  reference_number: string;
  user_id: number;
  type: string | null;
  status: TransactionStatus | null;
  notes: string | null;
  assessor_notes: string | null;
  submitted_at: Date | null;
  updated_at: Date | null;
  completed_at: Date | null;
}

export interface RequestDocumentRow {
  Documents_id: number;
  transaction_request_id: number;
  type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date;
  verified: number;
}

export interface GisPlotRow {
  Gis_id: number;
  user_id: number;
  transaction_request_id: number | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  tie_points: unknown;
  center_lat: string | null;
  center_lng: string | null;
  zoom: string | null;
  polygon: unknown;
  area: string | null;
  Perimeter: string | null;
  extracted_from_title: number;
  title_file_name: string | null;
  historical_comparison_notes: string | null;
  created_at: Date | null;
}

/** Safe user JSON (no password_hash). */
export type PublicUser = Omit<UserRow, 'password_hash'>;

/**
 * Same fields as `PublicUser`, but as returned over HTTP JSON:
 * timestamps and `date_of_birth` are ISO strings (`date_of_birth` is calendar date `YYYY-MM-DD` or null).
 */
export type PublicUserJson = Omit<
  PublicUser,
  'created_at' | 'updated_at' | 'date_of_birth' | 'id_document_file_name' | 'profile_picture_file_name'
> & {
  created_at: string;
  updated_at: string;
  date_of_birth: string | null;
  /** True when an ID file is stored for review. */
  has_id_document: boolean;
  id_document_mime_type: string | null;
  /** GET with Bearer auth (owner, assessor, or admin). Omitted internal file name. */
  id_document_url: string | null;
  has_profile_picture: boolean;
  profile_picture_mime_type: string | null;
  /** GET with Bearer auth (owner, assessor, or admin). */
  profile_picture_url: string | null;
};
