import type { ErrorDTO } from '@dml/shared';

/**
 * Base URL for the API. Defaults to `/api` (Vite dev proxy / same-origin in prod)
 * but can be overridden via VITE_API_BASE_URL.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** A typed error thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, body: ErrorDTO | null, fallback: string) {
    super(body?.message ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error ?? 'unknown_error';
  }

  /** True when the failure was an anti-spam rate limit (HTTP 429, FR-019). */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** True when the request was unauthenticated (HTTP 401). */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
}

async function parseError(res: Response): Promise<ErrorDTO | null> {
  try {
    const data = (await res.json()) as ErrorDTO;
    if (data && typeof data.error === 'string' && typeof data.message === 'string') {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Typed fetch wrapper. Always sends cookies (credentials: 'include') so the
 * first-party session cookie travels with each request. Throws ApiError on
 * non-2xx. Returns `undefined` for empty (204) responses.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: payload,
    credentials: 'include',
    signal,
  });

  if (!res.ok) {
    const errorBody = await parseError(res);
    throw new ApiError(res.status, errorBody, `Request to ${path} failed (${res.status}).`);
  }

  if (res.status === 204 || res.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
