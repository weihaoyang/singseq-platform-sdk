import { describe, expect, it } from 'vitest';
import { createPlatformClient } from './client';

describe('generated platform client authentication', () => {
  it('uses the current CSRF value and accepts 204 without JSON parsing', async () => {
    const requests: Request[] = [];
    let csrf = 'first';
    const api = createPlatformClient({
      baseUrl: 'https://platform.test', auth: { type: 'session', csrf: () => csrf },
      fetch: async (request) => {
        requests.push(request as Request);
        return new Response(null, { status: 204 });
      },
    });
    await api.POST('/api/v1/auth/refresh');
    csrf = 'rotated';
    const result = await api.POST('/api/v1/auth/logout');
    expect(result.response.status).toBe(204);
    expect(result.data).toBeUndefined();
    expect(requests.map(request => request.headers.get('X-CSRF-Token'))).toEqual(['first', 'rotated']);
    expect(requests.every(request => request.credentials === 'include')).toBe(true);
  });

  it('keeps separate user credentials isolated and preserves HTTP errors', async () => {
    const headers: string[] = [];
    const transport: typeof fetch = async (request) => {
      headers.push((request as Request).headers.get('Authorization')!);
      expect((request as Request).credentials).toBe('omit');
      return Response.json({ code: 'subject_forbidden', message: 'Permission denied' }, { status: 403 });
    };
    const first = createPlatformClient({ baseUrl: 'https://platform.test', auth: { type: 'bearer', token: () => 'first' }, fetch: transport });
    const second = createPlatformClient({ baseUrl: 'https://platform.test', auth: { type: 'bearer', token: () => 'second' }, fetch: transport });
    const results = await Promise.all([first.GET('/api/v1/oauth/userinfo'), second.GET('/api/v1/oauth/userinfo')]);
    expect(headers).toEqual(['Bearer first', 'Bearer second']);
    expect(results.map(result => result.response.status)).toEqual([403, 403]);
  });
});
