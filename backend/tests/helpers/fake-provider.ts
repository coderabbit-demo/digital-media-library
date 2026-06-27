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

/** Build `count` normalized items for a media type. */
export function makeItems(mediaType: MediaType, count: number): TrendingItem[] {
  return Array.from({ length: count }, (_, i) => ({
    mediaType,
    title: `${mediaType} ${i + 1}`,
    creator: `Creator ${i + 1}`,
    coverUrl: `https://img.example/${mediaType}/${i + 1}.jpg`,
    providerId: `${mediaType}-${i + 1}`,
    provider: 'fake',
  }));
}

/** A full providers map of FakeProviders (one per category). */
export function fakeProviders(): Record<MediaType, FakeProvider> {
  return {
    book: new FakeProvider(makeItems('book', 25)),
    music: new FakeProvider(makeItems('music', 25)),
    audiobook: new FakeProvider(makeItems('audiobook', 25)),
  };
}
