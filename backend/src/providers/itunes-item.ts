import type { MediaType } from '@dml/shared';
import type { ItemDetail, ItemProvider } from './item-provider.js';
import { fetchJson } from './http.js';
import { stripHtml } from './text.js';

interface ItunesResult {
  wrapperType?: string;
  kind?: string;
  collectionId?: number;
  trackId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  primaryGenreName?: string;
  genres?: string[];
  description?: string;
  longDescription?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
}

interface ItunesResponse {
  resultCount?: number;
  results?: ItunesResult[];
}

/**
 * Item detail for music albums, audiobooks, or podcasts via Apple's keyless
 * iTunes Lookup API (`/lookup?id=`). One instance per media type. Returns null
 * when the id resolves to nothing; throws on upstream failure.
 */
export class ItunesItemProvider implements ItemProvider {
  readonly name: string;

  constructor(private readonly mediaType: 'music' | 'audiobook' | 'podcast') {
    this.name = `itunes-item-${mediaType}`;
  }

  /** True when an iTunes result belongs to this adapter's media family. */
  private matchesMediaType(r: ItunesResult): boolean {
    switch (this.mediaType) {
      case 'music':
        // Albums come back as collections (kind "song" for individual tracks).
        return r.wrapperType === 'collection' || r.kind === 'song';
      case 'audiobook':
        return r.wrapperType === 'audiobook';
      case 'podcast':
        // Podcast lookups return wrapperType "track" with kind "podcast"; key on
        // kind so a music track (also wrapperType "track") isn't misclassified.
        return r.kind === 'podcast';
    }
  }

  async getItem(providerId: string): Promise<ItemDetail | null> {
    const params = new URLSearchParams({ id: providerId, country: 'US' });
    const data = await fetchJson<ItunesResponse>(
      `https://itunes.apple.com/lookup?${params.toString()}`,
    );
    const r = data.results?.[0];
    const title = (r?.collectionName ?? r?.trackName)?.trim();
    const id = r?.collectionId ?? r?.trackId;
    if (!r || !title || id === undefined) return null;
    // A valid iTunes id from another family must not be served under this route;
    // verify the result's wrapperType/kind matches the requested media type.
    if (!this.matchesMediaType(r)) return null;
    // Prefer a single explicit genre list; fall back to the primary genre.
    const genres = (r.genres?.length ? r.genres : r.primaryGenreName ? [r.primaryGenreName] : [])
      .map((g) => g.trim())
      .filter(Boolean);
    return {
      mediaType: this.mediaType as MediaType,
      providerId: String(id),
      title,
      creator: r.artistName?.trim() || null,
      // Upgrade the thumbnail to a larger cover where available.
      coverUrl: r.artworkUrl600 ?? r.artworkUrl100?.replace('100x100', '600x600') ?? r.artworkUrl100 ?? null,
      description: stripHtml(r.longDescription ?? r.description),
      genres,
      providerUrl: r.collectionViewUrl ?? r.trackViewUrl ?? null,
      series: null,
      spotifyUrl: null, // enriched by ItemService when Spotify is configured
    };
  }
}
