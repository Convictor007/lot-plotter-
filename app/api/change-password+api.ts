import { MOCK_LOGIN_EMAIL, MOCK_LOGIN_PASSWORD } from '@/constants/mockAuth';
import { ExpoRequest, ExpoResponse } from 'expo-router/server';

export async function POST(req: ExpoRequest) {
  try {
    const body = await req.json();
    const { email, currentPassword, newPassword } = body as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!email || !currentPassword || !newPassword) {
      return ExpoResponse.json(
        { success: false, message: 'Email, current password, and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return ExpoResponse.json(
        { success: false, message: 'New password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return ExpoResponse.json(
        { success: false, message: 'New password must be different from your current password.' },
        { status: 400 }
      );
    }

    if (email === MOCK_LOGIN_EMAIL && currentPassword !== MOCK_LOGIN_PASSWORD) {
      return ExpoResponse.json(
        { success: false, message: 'Current password is incorrect.' },
        { status: 401 }
      );
    }

    // Replace with your backend: verify session, hash new password, persist via your auth service.
    return ExpoResponse.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('change-password:', error);
    return ExpoResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
