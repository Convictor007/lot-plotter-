import * as bcrypt from 'bcryptjs';

import { MOCK_LOGIN_EMAIL, MOCK_LOGIN_PASSWORD } from '@/constants/mockAuth';
import { isDbConfigured } from '@/lib/db/client';
import { clientIpFromRequest, insertAuditLog } from '@/lib/repositories/audit-logs.repository';
import { findUserByEmail, updatePasswordHash } from '@/lib/repositories/users.repository';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };
    const { email, currentPassword, newPassword } = body;

    if (!email || !currentPassword || !newPassword) {
      return Response.json(
        { success: false, message: 'Email, current password, and new password are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return Response.json(
        { success: false, message: 'New password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return Response.json(
        { success: false, message: 'New password must be different from your current password.' },
        { status: 400 }
      );
    }

    if (isDbConfigured()) {
      const user = await findUserByEmail(email);
      if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return Response.json({ success: false, message: 'Current password is incorrect.' }, { status: 401 });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await updatePasswordHash(user.User_id, hash);
      try {
        await insertAuditLog({
          user_id: user.User_id,
          action: 'user.password_change',
          ip_address: clientIpFromRequest(req),
          user_agent: req.headers.get('user-agent'),
          details: {},
        });
      } catch {
        //
      }
      return Response.json({ success: true, message: 'Password updated successfully.' });
    }

    if (email === MOCK_LOGIN_EMAIL && currentPassword !== MOCK_LOGIN_PASSWORD) {
      return Response.json({ success: false, message: 'Current password is incorrect.' }, { status: 401 });
    }

    return Response.json({
      success: true,
      message: 'Password updated successfully. (Demo mode — database not configured.)',
    });
  } catch (error) {
    console.error('change-password:', error);
    return Response.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
