import { MOCK_LOGIN_EMAIL } from '@/constants/mockAuth';
import type { VerificationStatus } from '@/database/models';

export type { VerificationStatus };

export type ProfileGender = 'Male' | 'Female' | '';

/** Full mock profile used on the Profile screen (demo data). */
export const MOCK_USER = {
  first_name: 'Darryl John',
  last_name: 'Reyes',
  role: 'Citizen',
  email: MOCK_LOGIN_EMAIL,
  phone_number: '+63 912 345 6789',
  gender: 'Male' as ProfileGender,
  age: '27',
  /** ISO date YYYY-MM-DD for API and date picker */
  date_of_birth_iso: '1998-03-17',
  street_address: '',
  region: 'South Luzon',
  postal_code: '',
  barangay: 'San Juan',
  municipality: 'Balatan',
  province: 'Camarines Sur',
  verification_status: 'verified' as VerificationStatus,
  has_id_document: false,
  id_document_mime_type: null as string | null,
  id_document_url: null as string | null,
  has_profile_picture: false,
  profile_picture_mime_type: null as string | null,
  profile_picture_url: null as string | null,
  /** From API `updated_at`; bumps when profile/avatar changes so avatar image refetches. */
  server_updated_at: '' as string,
};

type ProfileOverride = Partial<
  Pick<
    typeof MOCK_USER,
    | 'first_name'
    | 'last_name'
    | 'role'
    | 'gender'
    | 'age'
    | 'date_of_birth_iso'
    | 'street_address'
    | 'region'
    | 'postal_code'
    | 'verification_status'
  >
>;

/** Fields merged into profile state when resolving stored email (avoids duplicating MOCK_USER). */
export function getMockProfileOverrideForEmail(storedEmail: string): ProfileOverride {
  if (storedEmail === MOCK_LOGIN_EMAIL) {
    return {
      first_name: MOCK_USER.first_name,
      last_name: MOCK_USER.last_name,
      role: MOCK_USER.role,
      gender: MOCK_USER.gender,
      age: MOCK_USER.age,
      date_of_birth_iso: MOCK_USER.date_of_birth_iso,
      street_address: MOCK_USER.street_address,
      region: MOCK_USER.region,
      postal_code: MOCK_USER.postal_code,
    };
  }
  return {
    first_name: 'User',
    last_name: 'Account',
    verification_status: 'unverified',
  };
}
