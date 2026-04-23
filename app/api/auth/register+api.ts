import * as bcrypt from 'bcryptjs';

import { signUserToken } from '@/lib/auth/jwt';
import { clientIpFromRequest, insertAuditLog } from '@/lib/repositories/audit-logs.repository';
import { publicUserToJson } from '@/lib/api/public-user';
import { createUser, findUserByEmail, getPublicUserById } from '@/lib/repositories/users.repository';
import { isDbConfigured } from '@/lib/db/client';

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return Response.json(
      {
        success: false,
        code: 'DB_NOT_CONFIGURED',
        message: 'Set DATABASE_URL or MYSQL_* to enable registration.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      gender?: string;
      age?: number | string;
      date_of_birth?: string;
      barangay?: string;
      municipality?: string;
      province?: string;
    };

    const email = body.email?.trim();
    const password = body.password ?? '';
    const first_name = body.first_name?.trim();
    const last_name = body.last_name?.trim();
    const municipality = body.municipality?.trim();
    const province = body.province?.trim();

    if (!email || !password || !first_name || !last_name || !municipality || !province) {
      return Response.json(
        {
          success: false,
          message: 'email, password, first_name, last_name, municipality, and province are required.',
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json({ success: false, message: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return Response.json({ success: false, message: 'An account with this email already exists.' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    let regAge: number | null = null;
    if (body.age !== undefined && body.age !== null && body.age !== '') {
      const n = typeof body.age === 'number' ? body.age : parseInt(String(body.age).replace(/\D/g, ''), 10);
      regAge = Number.isFinite(n) && n >= 0 && n <= 150 ? n : null;
    }
    let regDob: string | null = null;
    if (body.date_of_birth?.trim()) {
      const s = body.date_of_birth.trim().slice(0, 10);
      regDob = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    }
    const userId = await createUser({
      email,
      password_hash,
      role: 'citizen',
      first_name,
      last_name,
      phone_number: body.phone_number?.trim() || null,
      gender: body.gender?.trim() || null,
      age: regAge,
      date_of_birth: regDob,
      barangay: body.barangay?.trim() || null,
      municipality,
      province,
      verification_status: 'unverified',
    });

    const token = await signUserToken(userId, email.toLowerCase(), 'citizen');

    try {
      await insertAuditLog({
        user_id: userId,
        action: 'auth.register',
        ip_address: clientIpFromRequest(req),
        user_agent: req.headers.get('user-agent'),
        details: { email: email.toLowerCase() },
      });
    } catch {
      //
    }

    const created = await getPublicUserById(userId);
    if (!created) {
      return Response.json({ success: false, message: 'Registration failed.' }, { status: 500 });
    }

    return Response.json(
      {
        success: true,
        token,
        user: publicUserToJson(created),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('auth/register:', e);
    return Response.json({ success: false, message: 'Registration failed.' }, { status: 500 });
  }
}
