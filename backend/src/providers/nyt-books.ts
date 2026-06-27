import type { AppConfig } from '../config/index.js';
import type { ContentProvider, TrendingItem } from './content-provider.js';
import { fetchJson } from './http.js';

interface NytOverviewResponse {
  results?: {
    lists?: Array<{
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
 * Books trending via the NYT Books API "best sellers overview" (bestseller lists
 * are our trending signal for books). Requires `NYT_API_KEY`; throws when absent
 * or on upstream failure so `TrendingService` falls back to cache.
 */
export class NytBooksProvider implements ContentProvider {
  readonly name = 'nyt-books';

  constructor(private readonly config: AppConfig) {}

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const key = this.config.NYT_API_KEY;
    if (!key) throw new Error('NYT_API_KEY not configured');

    const url = `https://api.nytimes.com/svc/books/v3/lists/overview.json?api-key=${encodeURIComponent(key)}`;
    const data = await fetchJson<NytOverviewResponse>(url);

    const items: TrendingItem[] = [];
    const seen = new Set<string>();
    for (const list of data.results?.lists ?? []) {
      for (const book of list.books ?? []) {
        const title = book.title?.trim();
        if (!title) continue;
        const id = book.primary_isbn13 || book.primary_isbn10 || `${title}:${book.author ?? ''}`;
        if (seen.has(id)) continue;
        seen.add(id);
        items.push({
          mediaType: 'book',
          title,
          creator: book.author?.trim() || null,
          coverUrl: book.book_image ?? null,
          providerId: id,
          provider: this.name,
        });
        if (items.length >= limit) return items;
      }
    }
    return items;
  }
}
