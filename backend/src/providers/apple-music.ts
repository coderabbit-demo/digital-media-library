import type { ContentProvider, TrendingItem } from './content-provider.js';
import { fetchJson } from './http.js';

interface AppleRssFeed {
  feed?: {
    results?: Array<{
      id?: string;
      name?: string;
      artistName?: string;
      artworkUrl100?: string;
      url?: string;
      genres?: Array<{ name?: string }>;
    }>;
  };
}

/**
 * Picks a display genre from Apple's genre list, skipping the generic top-level
 * "Music" parent so albums section under their specific genre (e.g. Hip-Hop/Rap).
 */
function primaryGenre(genres?: Array<{ name?: string }>): string | null {
  const names = (genres ?? []).map((g) => g.name?.trim()).filter((n): n is string => !!n);
  return names.find((n) => n !== 'Music') ?? names[0] ?? null;
}

/**
 * Music trending via Apple's public "most-played albums" RSS marketing feed
 * (JSON). No API key or OAuth required. Items carry a genre so the UI can group
 * them into sections. Throws on upstream failure.
 */
export class AppleMusicProvider implements ContentProvider {
  readonly name = 'apple-music';

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const count = Math.min(Math.max(limit, 1), 100);
    const url = `https://rss.marketingtools.apple.com/api/v2/us/music/most-played/${count}/albums.json`;
    const data = await fetchJson<AppleRssFeed>(url);

    const items: TrendingItem[] = [];
    const seen = new Set<string>();
    for (const r of data.feed?.results ?? []) {
      const title = r.name?.trim();
      if (!title || !r.id || seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({
        mediaType: 'music',
        title,
        creator: r.artistName?.trim() || null,
        coverUrl: r.artworkUrl100 ?? null,
        providerId: r.id,
        provider: this.name,
        genre: primaryGenre(r.genres),
        description: null,
        providerUrl: r.url ?? null,
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
