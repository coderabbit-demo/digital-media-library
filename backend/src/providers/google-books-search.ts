import type { AppConfig } from '../config/index.js';
import type { TrendingItem } from './content-provider.js';
import type { SearchProvider } from './search-provider.js';
import { fetchJson } from './http.js';

/** Google Books thumbnails come back as http://; upgrade to https:// (else null). */
function toHttps(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  return null;
}

interface GoogleVolumesResponse {
  items?: Array<{
    id?: string;
    volumeInfo?: {
      title?: string;
      authors?: string[];
      categories?: string[];
      description?: string;
      infoLink?: string;
      canonicalVolumeLink?: string;
      imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    };
  }>;
}

/**
 * Book search via the Google Books API (`volumes?q=<term>`). Works keyless at low
 * (shared) quota; `GOOGLE_BOOKS_API_KEY` raises the limit. Throws on failure.
 */
export class GoogleBooksSearchProvider implements SearchProvider {
  readonly name = 'google-books-search';

  constructor(private readonly config: AppConfig) {}

  async search(query: string, limit: number): Promise<TrendingItem[]> {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(Math.max(limit, 1), 40)),
      country: 'US',
      printType: 'books',
    });
    const key = this.config.GOOGLE_BOOKS_API_KEY;
    if (key) params.set('key', key);
    const data = await fetchJson<GoogleVolumesResponse>(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    );

    const items: TrendingItem[] = [];
    const seen = new Set<string>();
    for (const v of data.items ?? []) {
      const title = v.volumeInfo?.title?.trim();
      if (!title || !v.id || seen.has(v.id)) continue;
      seen.add(v.id);
      items.push({
        mediaType: 'book',
        title,
        creator: v.volumeInfo?.authors?.[0]?.trim() || null,
        coverUrl: toHttps(
          v.volumeInfo?.imageLinks?.thumbnail ?? v.volumeInfo?.imageLinks?.smallThumbnail,
        ),
        providerId: v.id,
        provider: this.name,
        genre: v.volumeInfo?.categories?.[0]?.trim() || null,
        description: v.volumeInfo?.description?.trim() || null,
        providerUrl: v.volumeInfo?.infoLink ?? v.volumeInfo?.canonicalVolumeLink ?? null,
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
