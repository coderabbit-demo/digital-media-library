import type { AppConfig } from '../config/index.js';
import type { ContentProvider, TrendingItem } from './content-provider.js';
import { fetchJson } from './http.js';

interface GoogleVolumesResponse {
  items?: Array<{
    id?: string;
    volumeInfo?: {
      title?: string;
      authors?: string[];
      description?: string;
      infoLink?: string;
      canonicalVolumeLink?: string;
      imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    };
  }>;
}

/** Genres queried for recommendations; results are interleaved across them. */
const SUBJECTS = ['fiction', 'nonfiction', 'mystery', 'science fiction', 'fantasy', 'history'];

/**
 * Books recommendations via the Google Books API across several genres (newest
 * per subject). Works without a key at low quota; `GOOGLE_BOOKS_API_KEY` raises
 * the limit. Throws only when every genre query fails.
 */
export class GoogleBooksProvider implements ContentProvider {
  readonly name = 'google-books';

  constructor(private readonly config: AppConfig) {}

  private async fetchSubject(subject: string, count: number): Promise<TrendingItem[]> {
    const key = this.config.GOOGLE_BOOKS_API_KEY;
    const params = new URLSearchParams({
      q: `subject:${subject}`,
      orderBy: 'newest',
      maxResults: String(count),
      country: 'US',
      printType: 'books',
    });
    if (key) params.set('key', key);
    const data = await fetchJson<GoogleVolumesResponse>(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    );
    // Title-case the subject for display as a genre label (e.g., "science fiction" → "Science Fiction").
    const genre = subject.replace(/\b\w/g, (c) => c.toUpperCase());
    const items: TrendingItem[] = [];
    for (const v of data.items ?? []) {
      const title = v.volumeInfo?.title?.trim();
      if (!title || !v.id) continue;
      items.push({
        mediaType: 'book',
        title,
        creator: v.volumeInfo?.authors?.[0]?.trim() || null,
        coverUrl: v.volumeInfo?.imageLinks?.thumbnail ?? v.volumeInfo?.imageLinks?.smallThumbnail ?? null,
        providerId: v.id,
        provider: this.name,
        genre,
        description: v.volumeInfo?.description?.trim() || null,
        providerUrl: v.volumeInfo?.infoLink ?? v.volumeInfo?.canonicalVolumeLink ?? null,
      });
    }
    return items;
  }

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const perSubject = Math.max(4, Math.ceil(limit / SUBJECTS.length));
    const settled = await Promise.allSettled(SUBJECTS.map((s) => this.fetchSubject(s, perSubject)));
    const lists = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (lists.length === 0) throw new Error('all Google Books genre queries failed');

    // Interleave across genres, dedupe by id.
    const out: TrendingItem[] = [];
    const seen = new Set<string>();
    const maxLen = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < maxLen && out.length < limit; i++) {
      for (const list of lists) {
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
