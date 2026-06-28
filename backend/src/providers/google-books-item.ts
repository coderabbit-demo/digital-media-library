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
interface GoogleVolumesSearch {
  items?: GoogleVolume[];
}

/** ISBN-10 (last char may be X) or ISBN-13. */
function isIsbn(id: string): boolean {
  return /^\d{9}[\dxX]$/.test(id) || /^\d{13}$/.test(id);
}

/**
 * Books item detail via Google Books. Handles both id shapes the app produces:
 * Google **volume ids** (Discover/Search via Google Books) and **ISBNs**
 * (Discover via the NYT bestseller lists). It first tries the volume-by-id
 * endpoint, then falls back to an `isbn:` search. Keyless at low quota;
 * `GOOGLE_BOOKS_API_KEY` raises it. Returns null on a miss; throws on other
 * upstream failures.
 */
export class GoogleBooksItemProvider implements ItemProvider {
  readonly name = 'google-books-item';

  constructor(private readonly config: AppConfig) {}

  async getItem(providerId: string): Promise<ItemDetail | null> {
    // Route by id shape: NYT-sourced books carry an ISBN (not a valid volume id,
    // so the volume-by-id endpoint errors on it) — resolve those via search.
    const v = isIsbn(providerId)
      ? await this.fetchByIsbn(providerId)
      : await this.fetchVolumeById(providerId);
    return v ? this.toDetail(v, providerId) : null;
  }

  private get keyParam(): string {
    return this.config.GOOGLE_BOOKS_API_KEY ? `&key=${this.config.GOOGLE_BOOKS_API_KEY}` : '';
  }

  private async fetchVolumeById(id: string): Promise<GoogleVolume | null> {
    try {
      const v = await fetchJson<GoogleVolume>(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}?country=US${this.keyParam}`,
      );
      return v.id ? v : null;
    } catch (err) {
      // A 404 (unknown volume / not a volume id) is a miss, not a failure.
      if (err instanceof Error && /HTTP 404/.test(err.message)) return null;
      throw err;
    }
  }

  private async fetchByIsbn(isbn: string): Promise<GoogleVolume | null> {
    const data = await fetchJson<GoogleVolumesSearch>(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&country=US${this.keyParam}`,
    );
    return data.items?.find((v) => v.id && v.volumeInfo?.title) ?? null;
  }

  /** Map a Google volume to ItemDetail, keeping the app's canonical providerId. */
  private toDetail(v: GoogleVolume, providerId: string): ItemDetail | null {
    const info = v.volumeInfo;
    const title = info?.title?.trim();
    if (!title || !v.id) return null;
    const fullTitle = info?.subtitle?.trim() ? `${title}: ${info.subtitle.trim()}` : title;
    return {
      mediaType: 'book',
      // Keep the id the rest of the app uses (ISBN for NYT items), so the page's
      // shelf/rating controls line up with existing library entries.
      providerId,
      title: fullTitle,
      creator: info?.authors?.[0]?.trim() || null,
      coverUrl: info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? null,
      description: stripHtml(info?.description),
      genres: (info?.categories ?? []).map((c) => c.trim()).filter(Boolean),
      providerUrl:
        info?.infoLink ??
        info?.canonicalVolumeLink ??
        info?.previewLink ??
        `https://books.google.com/books?id=${encodeURIComponent(v.id)}`,
      series: info?.seriesInfo?.bookDisplayNumber ? `Book ${info.seriesInfo.bookDisplayNumber}` : null,
      spotifyUrl: null,
    };
  }
}
