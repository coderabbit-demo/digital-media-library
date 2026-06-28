import type { AppConfig } from '../config/index.js';
import type { ItemDetail, ItemProvider } from './item-provider.js';
import { fetchJson } from './http.js';
import { stripHtml } from './text.js';

interface GoogleVolume {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    categories?: string[];
    seriesInfo?: { bookDisplayNumber?: string };
    infoLink?: string;
    canonicalVolumeLink?: string;
    previewLink?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

/**
 * Books item detail via the Google Books volume-by-id endpoint
 * (`/volumes/{id}`). Keyless at low quota; `GOOGLE_BOOKS_API_KEY` raises it.
 * Returns null on a 404-style miss; throws on other upstream failures.
 */
export class GoogleBooksItemProvider implements ItemProvider {
  readonly name = 'google-books-item';

  constructor(private readonly config: AppConfig) {}

  async getItem(providerId: string): Promise<ItemDetail | null> {
    const params = new URLSearchParams({ country: 'US' });
    if (this.config.GOOGLE_BOOKS_API_KEY) params.set('key', this.config.GOOGLE_BOOKS_API_KEY);
    let v: GoogleVolume;
    try {
      v = await fetchJson<GoogleVolume>(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(providerId)}?${params.toString()}`,
      );
    } catch (err) {
      // A 404 (unknown volume) is a miss, not a failure.
      if (err instanceof Error && /HTTP 404/.test(err.message)) return null;
      throw err;
    }
    const info = v.volumeInfo;
    const title = info?.title?.trim();
    if (!title || !v.id) return null;
    const fullTitle = info?.subtitle?.trim() ? `${title}: ${info.subtitle.trim()}` : title;
    return {
      mediaType: 'book',
      providerId: v.id,
      title: fullTitle,
      creator: info?.authors?.[0]?.trim() || null,
      coverUrl: info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? null,
      description: stripHtml(info?.description),
      genres: (info?.categories ?? []).map((c) => c.trim()).filter(Boolean),
      // Prefer the provider's own links, but always fall back to the canonical
      // volume URL (the API sometimes omits infoLink/canonicalVolumeLink).
      providerUrl:
        info?.infoLink ??
        info?.canonicalVolumeLink ??
        info?.previewLink ??
        `https://books.google.com/books?id=${encodeURIComponent(v.id)}`,
      series: info?.seriesInfo?.bookDisplayNumber ? `Book ${info.seriesInfo.bookDisplayNumber}` : null,
    };
  }
}
