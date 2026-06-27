import type { MediaType } from '@dml/shared';
import type { TrendingItem } from './content-provider.js';
import type { SearchProvider } from './search-provider.js';
import { fetchJson } from './http.js';

interface ItunesResponse {
  results?: Array<{
    collectionId?: number;
    trackId?: number;
    collectionName?: string;
    trackName?: string;
    artistName?: string;
    artworkUrl100?: string;
    primaryGenreName?: string;
    description?: string;
    longDescription?: string;
    trackViewUrl?: string;
    collectionViewUrl?: string;
  }>;
}

/** iTunes Search `media`/`entity` params per media type. */
const ITUNES_PARAMS: Record<'music' | 'audiobook' | 'podcast', { media: string; entity: string }> = {
  music: { media: 'music', entity: 'album' },
  audiobook: { media: 'audiobook', entity: 'audiobook' },
  podcast: { media: 'podcast', entity: 'podcast' },
};

/**
 * Search for music albums, audiobooks, or podcasts via Apple's keyless iTunes
 * Search API (no OAuth). One instance per media type. Throws on failure.
 */
export class ItunesSearchProvider implements SearchProvider {
  readonly name: string;
  private readonly mediaType: 'music' | 'audiobook' | 'podcast';

  constructor(mediaType: 'music' | 'audiobook' | 'podcast') {
    this.mediaType = mediaType;
    this.name = `itunes-search-${mediaType}`;
  }

  async search(query: string, limit: number): Promise<TrendingItem[]> {
    const { media, entity } = ITUNES_PARAMS[this.mediaType];
    const params = new URLSearchParams({
      term: query,
      media,
      entity,
      limit: String(Math.min(Math.max(limit, 1), 50)),
      country: 'US',
    });
    const data = await fetchJson<ItunesResponse>(
      `https://itunes.apple.com/search?${params.toString()}`,
    );

    const items: TrendingItem[] = [];
    const seen = new Set<string>();
    for (const r of data.results ?? []) {
      const title = (r.collectionName ?? r.trackName)?.trim();
      const id = r.collectionId ?? r.trackId;
      if (!title || id === undefined) continue;
      const providerId = String(id);
      if (seen.has(providerId)) continue;
      seen.add(providerId);
      items.push({
        mediaType: this.mediaType as MediaType,
        title,
        creator: r.artistName?.trim() || null,
        coverUrl: r.artworkUrl100 ?? null,
        providerId,
        provider: this.name,
        genre: r.primaryGenreName?.trim() || null,
        description: (r.longDescription ?? r.description)?.trim() || null,
        providerUrl: r.collectionViewUrl ?? r.trackViewUrl ?? null,
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
