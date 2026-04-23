import { publicUserToJson } from '@/lib/api/public-user';
import { getBearerAuth } from '@/lib/auth/api-auth';
import { getPublicUserById, updateUserProfile, type UserProfilePatch } from '@/lib/repositories/users.repository';
import { isDbConfigured } from '@/lib/db/client';

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const user = await getPublicUserById(auth.userId);
    if (!user) {
      return Response.json({ success: false, message: 'User not found.' }, { status: 404 });
    }
    return Response.json({ success: true, user: publicUserToJson(user) });
  } catch (e) {
    console.error('users/me GET:', e);
    return Response.json({ success: false, message: 'Failed to load profile.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      first_name?: string;
      last_name?: string;
      phone_number?: string | null;
      gender?: string | null;
      age?: number | string | null;
      date_of_birth?: string | null;
      street_address?: string | null;
      region?: string | null;
      postal_code?: string | null;
      barangay?: string | null;
      municipality?: string | null;
      province?: string | null;
    };
    const patch: UserProfilePatch = {};
    if (body.first_name !== undefined) patch.first_name = String(body.first_name).trim();
    if (body.last_name !== undefined) patch.last_name = String(body.last_name).trim();
    if (body.phone_number !== undefined) patch.phone_number = body.phone_number;
    if (body.gender !== undefined) {
      const g = body.gender === null || body.gender === '' ? null : String(body.gender).trim();
      patch.gender = g && g.length ? g : null;
    }
    if (body.age !== undefined) {
      if (body.age === null || body.age === '') {
        patch.age = null;
      } else {
        const n = typeof body.age === 'number' ? body.age : parseInt(String(body.age).replace(/\D/g, ''), 10);
        patch.age = Number.isFinite(n) && n >= 0 && n <= 150 ? n : null;
      }
    }
    if (body.date_of_birth !== undefined) {
      const raw = body.date_of_birth;
      if (raw === null || raw === '') {
        patch.date_of_birth = null;
      } else {
        const s = String(raw).trim().slice(0, 10);
        patch.date_of_birth = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      }
    }
    if (body.street_address !== undefined) {
      patch.street_address =
        body.street_address === null || body.street_address === ''
          ? null
          : String(body.street_address).trim() || null;
    }
    if (body.region !== undefined) {
      patch.region =
        body.region === null || body.region === '' ? null : String(body.region).trim() || null;
    }
    if (body.postal_code !== undefined) {
      patch.postal_code =
        body.postal_code === null || body.postal_code === ''
          ? null
          : String(body.postal_code).trim() || null;
    }
    if (body.barangay !== undefined) patch.barangay = body.barangay;
    if (body.municipality !== undefined) {
      const m = String(body.municipality ?? '').trim();
      if (m.length) patch.municipality = m;
    }
    if (body.province !== undefined) {
      const p = String(body.province ?? '').trim();
      if (p.length) patch.province = p;
    }

    await updateUserProfile(auth.userId, patch);
    const user = await getPublicUserById(auth.userId);
    if (!user) {
      return Response.json({ success: false, message: 'User not found.' }, { status: 404 });
    }
    return Response.json({ success: true, user: publicUserToJson(user) });
  } catch (e) {
    console.error('users/me PATCH:', e);
    return Response.json({ success: false, message: 'Failed to update profile.' }, { status: 500 });
  }
}
