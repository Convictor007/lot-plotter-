import * as bcrypt from 'bcryptjs';

import { signUserToken } from '@/lib/auth/jwt';
import { clientIpFromRequest, insertAuditLog } from '@/lib/repositories/audit-logs.repository';
import { userRowToPublicJson } from '@/lib/api/public-user';
import { findUserByEmail } from '@/lib/repositories/users.repository';
import { isDbConfigured } from '@/lib/db/client';

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return Response.json(
      {
        success: false,
        code: 'DB_NOT_CONFIGURED',
        message: 'Set DATABASE_URL or MYSQL_DATABASE (and MySQL credentials) to enable auth.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password ?? '';
    if (!email || !password) {
      return Response.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      try {
        await insertAuditLog({
          user_id: null,
          action: 'auth.login_failed',
          ip_address: clientIpFromRequest(req),
          user_agent: req.headers.get('user-agent'),
          details: { email: email.toLowerCase() },
        });
      } catch {
        //
      }
      return Response.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await signUserToken(user.User_id, user.email, user.role);

    try {
      await insertAuditLog({
        user_id: user.User_id,
        action: 'auth.login_success',
        ip_address: clientIpFromRequest(req),
        user_agent: req.headers.get('user-agent'),
        details: {},
      });
    } catch {
      //
    }

    return Response.json({
      success: true,
      token,
      user: userRowToPublicJson(user),
    });
  } catch (e) {
    console.error('auth/login:', e);
    return Response.json({ success: false, message: 'Login failed.' }, { status: 500 });
  }
}
