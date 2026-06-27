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
    // Never include the query string — provider URLs carry API keys (e.g. NYT,
    // Google Books pass the key as a query param). Log only host + path + status.
    let safe = url;
    try {
      const u = new URL(url);
      safe = `${u.origin}${u.pathname}`;
    } catch {
      safe = '[unparseable url]';
    }
    throw new Error(`Provider request failed: HTTP ${res.status} for ${safe}`);
  }
  return (await res.json()) as T;
}
