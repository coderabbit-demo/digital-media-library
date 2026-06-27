import type { AppConfig } from '../config/index.js';
import type { CacheService } from '../services/cache.js';
import type { ContentProvider, TrendingItem } from './content-provider.js';
import { fetchJson } from './http.js';

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyAlbumSearch {
  albums?: {
    items?: Array<{
      id?: string;
      name?: string;
      artists?: Array<{ name?: string }>;
      images?: Array<{ url?: string }>;
    }>;
  };
}

const TOKEN_CACHE_KEY = 'provider:spotify:token';

/**
 * Music trending via the Spotify Web API Search endpoint with the `tag:new`
 * filter (newly released albums). NOTE: `/browse/new-releases` now requires user
 * auth and is deprecated, so it 403s under the client-credentials flow; Search
 * works with client credentials. The access token is cached in Redis until
 * shortly before expiry. Requires `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`.
 */
export class SpotifyMusicProvider implements ContentProvider {
  readonly name = 'spotify-music';

  constructor(
    private readonly config: AppConfig,
    private readonly cache: CacheService,
  ) {}

  private async getToken(): Promise<string> {
    const cached = await this.cache.get<string>(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const id = this.config.SPOTIFY_CLIENT_ID;
    const secret = this.config.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) throw new Error('Spotify credentials not configured');

    const basic = Buffer.from(`${id}:${secret}`).toString('base64');
    const token = await fetchJson<SpotifyTokenResponse>('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    // Cache slightly less than the real expiry to avoid edge-of-expiry failures.
    const ttl = Math.max(60, (token.expires_in ?? 3600) - 60);
    await this.cache.set(TOKEN_CACHE_KEY, token.access_token, ttl);
    return token.access_token;
  }

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const token = await this.getToken();
    const params = new URLSearchParams({
      q: 'tag:new', // Spotify search filter for newly released albums
      type: 'album',
      market: 'US',
      limit: String(Math.min(Math.max(limit, 1), 50)),
    });
    const url = `https://api.spotify.com/v1/search?${params.toString()}`;
    const data = await fetchJson<SpotifyAlbumSearch>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const items: TrendingItem[] = [];
    for (const album of data.albums?.items ?? []) {
      const title = album.name?.trim();
      if (!title || !album.id) continue;
      items.push({
        mediaType: 'music',
        title,
        creator: album.artists?.[0]?.name?.trim() || null,
        coverUrl: album.images?.[0]?.url ?? null,
        providerId: album.id,
        provider: this.name,
        genre: null,
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
