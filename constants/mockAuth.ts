/**
 * Demo / mock account for local development (no backend auth).
 * Password is intentionally simple for testing only.
 */
export const MOCK_LOGIN_EMAIL = 'dareyes@my.cspc.edu.ph';
export const MOCK_LOGIN_PASSWORD = 'dsadsadsa';

export function isMockLoginValid(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  return (
    normalizedEmail === MOCK_LOGIN_EMAIL.toLowerCase() &&
    normalizedPassword === MOCK_LOGIN_PASSWORD
  );
}
