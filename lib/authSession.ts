import { removeItem, setItem } from '@/lib/appStorage';

/** Keys used for client-side session / demo auth (replace with real auth later). */
export const SESSION_USER_EMAIL_KEY = 'userEmail';
/** Cleared on logout; reserved if a privacy modal flag is added later. */
export const SESSION_PRIVACY_MODAL_KEY = 'hasSeenPrivacyModal';

export async function clearAuthSession(): Promise<void> {
  await removeItem(SESSION_USER_EMAIL_KEY);
  await removeItem(SESSION_PRIVACY_MODAL_KEY);
}

export async function setSessionUserEmail(email: string): Promise<void> {
  await setItem(SESSION_USER_EMAIL_KEY, email);
}
