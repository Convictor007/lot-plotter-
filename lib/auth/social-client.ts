import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

function requireEnvVar(name: string): string {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function randomNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getGoogleClientId(): string {
  const candidates = [
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
  ];
  for (const c of candidates) {
    const v = (c || '').trim();
    if (v) return v;
  }
  throw new Error(
    'Missing Google client id. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (or EXPO_PUBLIC_GOOGLE_CLIENT_ID).'
  );
}

export async function requestGoogleIdToken(): Promise<string> {
  const clientId = getGoogleClientId();
  const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/google' });
  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };
  const request = new AuthSession.AuthRequest({
    clientId,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    extraParams: {
      nonce: randomNonce(),
      prompt: 'select_account',
    },
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') {
    if (result.type === 'dismiss' || result.type === 'cancel') {
      throw new Error('Google sign-in cancelled.');
    }
    throw new Error(`Google sign-in failed (${result.type}).`);
  }
  const idToken = result.params.id_token;
  if (!idToken) {
    throw new Error('Google did not return id_token.');
  }
  return idToken;
}

export async function requestFacebookAccessToken(): Promise<string> {
  const clientId = requireEnvVar('EXPO_PUBLIC_FACEBOOK_APP_ID');
  const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/facebook' });
  const request = new AuthSession.AuthRequest({
    clientId,
    responseType: AuthSession.ResponseType.Token,
    scopes: ['public_profile', 'email'],
    redirectUri,
  });
  const result = await request.promptAsync({
    authorizationEndpoint: 'https://www.facebook.com/v20.0/dialog/oauth',
  });
  if (result.type !== 'success') {
    throw new Error('Facebook sign-in cancelled.');
  }
  const accessToken = result.params.access_token;
  if (!accessToken) {
    throw new Error('Facebook did not return access_token.');
  }
  return accessToken;
}
