import createClient from 'openapi-fetch';
import type { paths } from './schema';

export type PlatformClientOptions = {
  baseUrl: string;
  auth: { type: 'session'; csrf: () => string } | { type: 'bearer'; token: () => string };
  fetch?: typeof globalThis.fetch;
};

export function createPlatformClient(options: PlatformClientOptions) {
  const api = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: options.auth.type === 'session' ? 'include' : 'omit',
    fetch: options.fetch,
  });
  api.use({
    onRequest({ request }) {
      if (options.auth.type === 'bearer') {
        request.headers.set('Authorization', `Bearer ${options.auth.token()}`);
      } else if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        request.headers.set('X-CSRF-Token', options.auth.csrf());
      }
      return request;
    },
  });
  return api;
}

export function loginUrl(baseUrl: string, returnPath = '/account') {
  const url = new URL('/api/v1/auth/login', baseUrl);
  url.searchParams.set('return_path', returnPath);
  return url.toString();
}
