import type { ContentProvider, TrendingItem } from './content-provider.js';
import { fetchJson } from './http.js';

interface AppleRssFeed {
  feed?: {
    results?: Array<{
      id?: string;
      name?: string;
      artistName?: string;
      artworkUrl100?: string;
    }>;
  };
}

/**
 * Audiobooks trending via Apple's public "top audiobooks" RSS marketing feed
 * (JSON). No API key required. Throws on upstream failure.
 */
export class AppleAudiobookProvider implements ContentProvider {
  readonly name = 'apple-audiobooks';

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const count = Math.min(Math.max(limit, 1), 50);
    const url = `https://rss.applemarketingtools.com/api/v2/us/audiobooks/top/${count}/audiobooks.json`;
    const data = await fetchJson<AppleRssFeed>(url);

    const items: TrendingItem[] = [];
    const seen = new Set<string>();
    for (const r of data.feed?.results ?? []) {
      const title = r.name?.trim();
      if (!title || !r.id || seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({
        mediaType: 'audiobook',
        title,
        creator: r.artistName?.trim() || null,
        coverUrl: r.artworkUrl100 ?? null,
        providerId: r.id,
        provider: this.name,
        genre: null,
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
