import type { AppConfig } from '../config/index.js';
import type { ContentProvider, TrendingItem } from './content-provider.js';
import { fetchJson } from './http.js';

interface NytOverviewResponse {
  results?: {
    lists?: Array<{
      list_name?: string;
      books?: Array<{
        title?: string;
        author?: string;
        book_image?: string;
        primary_isbn13?: string;
        primary_isbn10?: string;
      }>;
    }>;
  };
}

/**
 * Books trending via the NYT Books API "best sellers overview", which returns ALL
 * current bestseller lists (every genre) in one call. Books are interleaved
 * round-robin across lists so the result spans genres rather than being dominated
 * by the first list. Requires `NYT_API_KEY`; throws when absent or on failure.
 */
export class NytBooksProvider implements ContentProvider {
  readonly name = 'nyt-books';

  constructor(private readonly config: AppConfig) {}

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const key = this.config.NYT_API_KEY;
    if (!key) throw new Error('NYT_API_KEY not configured');

    const url = `https://api.nytimes.com/svc/books/v3/lists/overview.json?api-key=${encodeURIComponent(key)}`;
    const data = await fetchJson<NytOverviewResponse>(url);

    // Normalize each list (genre) into its own array.
    const perList: TrendingItem[][] = [];
    for (const list of data.results?.lists ?? []) {
      const genre = list.list_name?.trim() || 'Bestsellers';
      const items: TrendingItem[] = [];
      for (const book of list.books ?? []) {
        const title = book.title?.trim();
        if (!title) continue;
        const id = book.primary_isbn13 || book.primary_isbn10 || `${title}:${book.author ?? ''}`;
        items.push({
          mediaType: 'book',
          title,
          creator: book.author?.trim() || null,
          coverUrl: book.book_image ?? null,
          providerId: id,
          provider: this.name,
          genre,
        });
      }
      if (items.length > 0) perList.push(items);
    }

    // Round-robin across lists so every genre is represented, deduping by id.
    const out: TrendingItem[] = [];
    const seen = new Set<string>();
    const maxLen = Math.max(0, ...perList.map((l) => l.length));
    for (let i = 0; i < maxLen && out.length < limit; i++) {
      for (const list of perList) {
        const item = list[i];
        if (!item || seen.has(item.providerId)) continue;
        seen.add(item.providerId);
        out.push(item);
        if (out.length >= limit) break;
      }
    }
    return out;
  }
}
