import { isDbConfigured } from '@/lib/db/client';
import { issueSocialSession } from '@/lib/auth/social-signin';

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
};

function getAllowedGoogleClientIds(): string[] {
  const raw = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ]
    .map((v) => v?.trim() || '')
    .filter(Boolean);
  return [...new Set(raw)];
}

function splitName(fullName?: string): { firstName: string; lastName: string } {
  const name = (fullName || '').trim();
  if (!name) return { firstName: 'Citizen', lastName: 'User' };
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: 'User' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return Response.json(
      {
        success: false,
        code: 'DB_NOT_CONFIGURED',
        message: 'Set DATABASE_URL or MYSQL_* to enable Google auth.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { id_token?: string };
    const idToken = body.id_token?.trim();
    if (!idToken) {
      return Response.json({ success: false, message: 'id_token is required.' }, { status: 400 });
    }

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) {
      return Response.json({ success: false, message: 'Invalid Google token.' }, { status: 401 });
    }
    const tokenInfo = (await verifyRes.json()) as GoogleTokenInfo;

    const allowedAudiences = getAllowedGoogleClientIds();
    if (allowedAudiences.length && !allowedAudiences.includes(String(tokenInfo.aud || ''))) {
      return Response.json({ success: false, message: 'Google token audience mismatch.' }, { status: 401 });
    }

    const email = (tokenInfo.email || '').trim().toLowerCase();
    const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === 'true';
    if (!email || !emailVerified) {
      return Response.json({ success: false, message: 'Google account email is missing or unverified.' }, { status: 400 });
    }

    const namesFromFull = splitName(tokenInfo.name);
    const firstName = (tokenInfo.given_name || '').trim() || namesFromFull.firstName;
    const lastName = (tokenInfo.family_name || '').trim() || namesFromFull.lastName;

    const session = await issueSocialSession(req, 'google', {
      email,
      firstName,
      lastName,
      providerUserId: tokenInfo.sub,
    });

    return Response.json({
      success: true,
      is_new_user: session.isNewUser,
      token: session.token,
      user: session.user,
    });
  } catch (e) {
    console.error('auth/google:', e);
    return Response.json({ success: false, message: 'Google login failed.' }, { status: 500 });
  }
}
