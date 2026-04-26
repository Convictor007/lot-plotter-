import * as bcrypt from 'bcryptjs';

import { publicUserToJson } from '@/lib/api/public-user';
import { signUserToken } from '@/lib/auth/jwt';
import { clientIpFromRequest, insertAuditLog } from '@/lib/repositories/audit-logs.repository';
import { createUser, findUserByEmail, getPublicUserById } from '@/lib/repositories/users.repository';

export type SocialProvider = 'google' | 'facebook';

export type SocialProfile = {
  email: string;
  firstName: string;
  lastName: string;
  providerUserId?: string;
};

export async function issueSocialSession(
  req: Request,
  provider: SocialProvider,
  profile: SocialProfile
): Promise<{
  isNewUser: boolean;
  token: string;
  user: ReturnType<typeof publicUserToJson>;
}> {
  const email = profile.email.trim().toLowerCase();
  const firstName = profile.firstName.trim() || 'Citizen';
  const lastName = profile.lastName.trim() || 'User';
  const defaultMunicipality = process.env.AUTH_DEFAULT_MUNICIPALITY?.trim() || 'Balatan';
  const defaultProvince = process.env.AUTH_DEFAULT_PROVINCE?.trim() || 'Camarines Sur';

  let user = await findUserByEmail(email);
  let isNewUser = false;
  if (!user) {
    const entropy = `${provider}:${profile.providerUserId || email}:${Date.now()}:${Math.random()}`;
    const passwordHash = await bcrypt.hash(entropy, 10);
    const userId = await createUser({
      email,
      password_hash: passwordHash,
      role: 'citizen',
      first_name: firstName,
      last_name: lastName,
      municipality: defaultMunicipality,
      province: defaultProvince,
      verification_status: 'unverified',
    });
    user = await findUserByEmail(email);
    if (!user || user.User_id !== userId) {
      throw new Error('Could not create social account.');
    }
    isNewUser = true;
  }

  const token = await signUserToken(user.User_id, user.email, user.role);
  const publicUser = await getPublicUserById(user.User_id);
  if (!publicUser) {
    throw new Error('Social account user not found.');
  }

  try {
    await insertAuditLog({
      user_id: user.User_id,
      action: isNewUser ? `auth.${provider}_register` : `auth.${provider}_login`,
      ip_address: clientIpFromRequest(req),
      user_agent: req.headers.get('user-agent'),
      details: { email, provider_user_id: profile.providerUserId ?? null },
    });
  } catch {
    //
  }

  return {
    isNewUser,
    token,
    user: publicUserToJson(publicUser),
  };
}
