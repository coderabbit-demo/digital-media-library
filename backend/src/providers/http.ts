/** Default per-request timeout for provider calls (ms). */
const DEFAULT_TIMEOUT_MS = 4000;

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

/**
 * Fetch JSON from a provider with a hard timeout. Throws on non-2xx or timeout so
 * the caller (a provider adapter) can surface a failure that `TrendingService`
 * converts into a stale/empty response. Uses the platform `fetch` (Node 22).
 */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: opts.headers,
    body: opts.body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Provider request failed: HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}
