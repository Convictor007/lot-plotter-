import { isDbConfigured } from '@/lib/db/client';
import { issueSocialSession } from '@/lib/auth/social-signin';

type FacebookMe = {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
};

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
        message: 'Set DATABASE_URL or MYSQL_* to enable Facebook auth.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { access_token?: string };
    const accessToken = body.access_token?.trim();
    if (!accessToken) {
      return Response.json({ success: false, message: 'access_token is required.' }, { status: 400 });
    }

    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,first_name,last_name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!meRes.ok) {
      return Response.json({ success: false, message: 'Invalid Facebook token.' }, { status: 401 });
    }
    const me = (await meRes.json()) as FacebookMe;
    const email = (me.email || '').trim().toLowerCase();
    if (!email) {
      return Response.json(
        {
          success: false,
          message:
            'Facebook did not return an email. Ensure the account has an email and email permission is approved.',
        },
        { status: 400 }
      );
    }

    const fallbackName = splitName(me.name);
    const firstName = (me.first_name || '').trim() || fallbackName.firstName;
    const lastName = (me.last_name || '').trim() || fallbackName.lastName;

    const session = await issueSocialSession(req, 'facebook', {
      email,
      firstName,
      lastName,
      providerUserId: me.id,
    });

    return Response.json({
      success: true,
      is_new_user: session.isNewUser,
      token: session.token,
      user: session.user,
    });
  } catch (e) {
    console.error('auth/facebook:', e);
    return Response.json({ success: false, message: 'Facebook login failed.' }, { status: 500 });
  }
}
