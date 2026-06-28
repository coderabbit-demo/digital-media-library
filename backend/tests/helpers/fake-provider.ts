import type { MediaType } from '@dml/shared';
import type { ContentProvider, TrendingItem } from '../../src/providers/content-provider.js';

/** A controllable in-memory ContentProvider for tests (no network). */
export class FakeProvider implements ContentProvider {
  readonly name = 'fake';
  fail = false;
  calls = 0;

  constructor(private readonly items: TrendingItem[]) {}

  async getTrending(limit: number): Promise<TrendingItem[]> {
    this.calls += 1;
    if (this.fail) throw new Error('fake provider down');
    return this.items.slice(0, limit);
  }
}

/** Build `count` normalized items for a media type (books cycle through genres). */
export function makeItems(mediaType: MediaType, count: number): TrendingItem[] {
  // Books, music, and podcasts carry genres (sectioned in the UI); audiobooks don't.
  const genres = mediaType === 'audiobook' ? [null] : ['Fiction', 'Nonfiction', 'Mystery'];
  return Array.from({ length: count }, (_, i) => ({
    mediaType,
    title: `${mediaType} ${i + 1}`,
    creator: `Creator ${i + 1}`,
    coverUrl: `https://img.example/${mediaType}/${i + 1}.jpg`,
    providerId: `${mediaType}-${i + 1}`,
    provider: 'fake',
    genre: genres[i % genres.length] ?? null,
    description: null,
    providerUrl: null,
  }));
}

/** A full providers map of FakeProviders (one per category). */
export function fakeProviders(): Record<MediaType, FakeProvider> {
  return {
    book: new FakeProvider(makeItems('book', 25)),
    music: new FakeProvider(makeItems('music', 25)),
    audiobook: new FakeProvider(makeItems('audiobook', 25)),
    podcast: new FakeProvider(makeItems('podcast', 25)),
  };
}

import type { ItemDetail, ItemProvider } from '../../src/providers/item-provider.js';

/** A controllable in-memory ItemProvider for tests (no network). */
export class FakeItemProvider implements ItemProvider {
  readonly name = 'fake-item';
  fail = false;
  calls = 0;

  constructor(private readonly item: ItemDetail | null) {}

  async getItem(_providerId: string): Promise<ItemDetail | null> {
    this.calls += 1;
    if (this.fail) throw new Error('fake item provider down');
    return this.item;
  }
}

/** Build a normalized ItemDetail for tests. */
export function makeItemDetail(
  mediaType: MediaType,
  providerId: string,
  overrides: Partial<ItemDetail> = {},
): ItemDetail {
  return {
    mediaType,
    providerId,
    title: `${mediaType} ${providerId}`,
    creator: 'Creator',
    coverUrl: `https://img.example/${mediaType}/${providerId}.jpg`,
    description: 'A synopsis.',
    genres: mediaType === 'audiobook' ? [] : ['Fiction', 'Mystery'],
    providerUrl: `https://provider.example/${providerId}`,
    series: null,
    ...overrides,
  };
}

/** A full item-providers map returning a detail for any id, per media type. */
export function fakeItemProviders(): Record<MediaType, FakeItemProvider> {
  return {
    book: new FakeItemProvider(makeItemDetail('book', 'b1')),
    music: new FakeItemProvider(makeItemDetail('music', 'm1')),
    audiobook: new FakeItemProvider(makeItemDetail('audiobook', 'a1')),
    podcast: new FakeItemProvider(makeItemDetail('podcast', 'p1')),
  };
}
