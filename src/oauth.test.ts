import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizeUrl, createPkcePair, exchangeAuthorizationCode, refreshOAuthToken, revokeOAuthToken } from './oauth';

describe('platform OAuth PKCE', () => {
  it('builds S256 authorization requests and a verifiable challenge', async () => {
    const pair = await createPkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL(buildAuthorizeUrl({
      baseUrl: 'https://platform.test', clientId: 'client', redirectUri: 'https://product.test/callback',
      scope: ['account.read', 'usage.write'], state: 'state', codeChallenge: pair.challenge,
    }));
    expect(url.pathname).toBe('/api/v1/oauth/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('account.read usage.write');
  });

  it('exchanges and refreshes delegated credentials using the platform form contract', async () => {
    const calls: Request[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init));
      return Response.json({ access_token: 'access', refresh_token: 'refresh', token_type: 'Bearer', expires_in: 300, scope: 'account.read' });
    }) as typeof fetch;
    await exchangeAuthorizationCode({ baseUrl: 'https://platform.test', clientId: 'client', code: 'code', redirectUri: 'https://product.test/callback', verifier: 'verifier', fetch: fetchImpl });
    await refreshOAuthToken({ baseUrl: 'https://platform.test', clientId: 'client', refreshToken: 'refresh', fetch: fetchImpl });
    await revokeOAuthToken({ baseUrl: 'https://platform.test', clientId: 'client', token: 'access', tokenTypeHint: 'access_token', fetch: fetchImpl });
    expect(calls.map(call => call.url)).toEqual([
      'https://platform.test/api/v1/oauth/token', 'https://platform.test/api/v1/oauth/token', 'https://platform.test/api/v1/oauth/revoke',
    ]);
    expect(calls[0].headers.get('content-type')).toContain('application/x-www-form-urlencoded');
    expect(await calls[0].clone().text()).toContain('code_verifier=verifier');
    expect(await calls[1].clone().text()).toContain('grant_type=refresh_token');
    expect(await calls[2].clone().text()).toContain('token_type_hint=access_token');
  });
});
