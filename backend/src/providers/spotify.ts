import type { MediaType } from '@dml/shared';
import type { AppConfig } from '../config/index.js';
import { fetchJson } from './http.js';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyItem {
  external_urls?: { spotify?: string };
}
interface SearchResponse {
  albums?: { items?: SpotifyItem[] };
  shows?: { items?: SpotifyItem[] };
  audiobooks?: { items?: SpotifyItem[] };
}

/** Item media type → Spotify search type. Books are not searched on Spotify. */
const SEARCH_TYPE: Partial<Record<MediaType, 'album' | 'show' | 'audiobook'>> = {
  music: 'album',
  podcast: 'show',
  audiobook: 'audiobook',
};

/**
 * Resolves a "Listen on Spotify" deep link for an item via the Spotify Web API
 * (client-credentials flow). The single boundary to Spotify (Principle III);
 * `ItemService` caches the resulting URL as part of the item detail. No-ops
 * (returns null) when credentials are absent, for books, or on any upstream
 * failure — the link is purely additive and never breaks the page.
 */
export class SpotifyLinkProvider {
  readonly name = 'spotify';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfig) {}

  private get configured(): boolean {
    return !!(this.config.SPOTIFY_CLIENT_ID && this.config.SPOTIFY_CLIENT_SECRET);
  }

  async findUrl(mediaType: MediaType, title: string, creator: string | null): Promise<string | null> {
    const type = SEARCH_TYPE[mediaType];
    if (!this.configured || !type || !title?.trim()) return null;
    try {
      const token = await this.getToken();
      const q = [title, creator].filter(Boolean).join(' ').trim();
      const params = new URLSearchParams({ q, type, limit: '1', market: 'US' });
      const data = await fetchJson<SearchResponse>(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const bucket =
        type === 'album' ? data.albums : type === 'show' ? data.shows : data.audiobooks;
      const url = bucket?.items?.[0]?.external_urls?.spotify;
      return url && /^https?:\/\//i.test(url) ? url : null;
    } catch {
      return null; // additive link; never propagate Spotify failures
    }
  }

  /** Client-credentials token, cached in-memory until shortly before expiry. */
  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now) return this.token.value;

    const basic = Buffer.from(
      `${this.config.SPOTIFY_CLIENT_ID}:${this.config.SPOTIFY_CLIENT_SECRET}`,
    ).toString('base64');
    const res = await fetchJson<TokenResponse>('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    // Refresh a minute early to avoid edge-of-expiry failures.
    this.token = { value: res.access_token, expiresAt: now + (res.expires_in - 60) * 1000 };
    return this.token.value;
  }
}
