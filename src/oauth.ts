export type PkcePair = { verifier: string; challenge: string };

const base64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export function randomOAuthState(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomOAuthState(48);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function buildAuthorizeUrl(options: {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string[];
  state: string;
  codeChallenge: string;
}) {
  const url = new URL('/api/v1/oauth/authorize', options.baseUrl);
  url.search = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: options.scope.join(' '),
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export type OAuthToken = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
};

async function tokenRequest(baseUrl: string, body: Record<string, string>, fetchImpl: typeof fetch) {
  const response = await fetchImpl(new URL('/api/v1/oauth/token', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Platform OAuth token request failed') as Error & { status: number; payload: unknown };
    error.status = response.status;
    error.payload = result;
    throw error;
  }
  return result as OAuthToken;
}

export function exchangeAuthorizationCode(options: {
  baseUrl: string;
  clientId: string;
  code: string;
  redirectUri: string;
  verifier: string;
  fetch?: typeof fetch;
}) {
  return tokenRequest(options.baseUrl, {
    grant_type: 'authorization_code',
    client_id: options.clientId,
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.verifier,
  }, options.fetch ?? fetch);
}

export function refreshOAuthToken(options: {
  baseUrl: string;
  clientId: string;
  refreshToken: string;
  fetch?: typeof fetch;
}) {
  return tokenRequest(options.baseUrl, {
    grant_type: 'refresh_token',
    client_id: options.clientId,
    refresh_token: options.refreshToken,
  }, options.fetch ?? fetch);
}
