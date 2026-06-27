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
 * "Podcasts" parent so shows section under their specific genre (e.g. News).
 */
function primaryGenre(genres?: Array<{ name?: string }>): string | null {
  const names = (genres ?? []).map((g) => g.name?.trim()).filter((n): n is string => !!n);
  return names.find((n) => n !== 'Podcasts') ?? names[0] ?? null;
}

/**
 * Podcasts trending via Apple's public "top podcasts" RSS marketing feed (JSON).
 * No API key or OAuth required. Items carry a genre so the UI can group them into
 * sections. `creator` is the show's publisher. Throws on upstream failure.
 */
export class ApplePodcastProvider implements ContentProvider {
  readonly name = 'apple-podcasts';

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const count = Math.min(Math.max(limit, 1), 100);
    const url = `https://rss.marketingtools.apple.com/api/v2/us/podcasts/top/${count}/podcasts.json`;
    const data = await fetchJson<AppleRssFeed>(url);

    const items: TrendingItem[] = [];
    const seen = new Set<string>();
    for (const r of data.feed?.results ?? []) {
      const title = r.name?.trim();
      if (!title || !r.id || seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({
        mediaType: 'podcast',
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
