import { MOCK_LOGIN_EMAIL } from '@/constants/mockAuth';

/** Full mock profile used on the Profile screen (demo data). */
export const MOCK_USER = {
  first_name: 'Darryl John',
  last_name: 'Reyes',
  role: 'Citizen',
  email: MOCK_LOGIN_EMAIL,
  phone_number: '+63 912 345 6789',
  gender: 'Male',
  age: '27',
  dob: 'March 17, 1998',
  barangay: 'San Juan',
  municipality: 'Balatan',
  province: 'Camarines Sur',
  verification_status: 'verified' as const,
};

type ProfileOverride = Partial<
  Pick<typeof MOCK_USER, 'first_name' | 'last_name' | 'role' | 'gender' | 'age' | 'dob'>
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
      dob: MOCK_USER.dob,
    };
  }
  return { first_name: 'User', last_name: 'Account' };
}
