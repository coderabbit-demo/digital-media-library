import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleBooksSearchProvider } from '../../src/providers/google-books-search.js';
import { ItunesSearchProvider } from '../../src/providers/itunes-search.js';
import { SearchService } from '../../src/services/search.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import type { SearchProvider } from '../../src/providers/search-provider.js';
import type { MediaType } from '@dml/shared';
import { testConfig } from '../helpers/test-app.js';

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('search providers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('GoogleBooksSearchProvider normalizes volumes and dedupes by id', async () => {
    mockFetch({
      items: [
        { id: 'g1', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], categories: ['Fiction'], imageLinks: { thumbnail: 'http://img/d.jpg' } } },
        { id: 'g1', volumeInfo: { title: 'Dune (dup)' } },
        { id: 'g2', volumeInfo: { title: 'Dune Messiah', authors: ['Frank Herbert'] } },
      ],
    });
    const items = await new GoogleBooksSearchProvider(testConfig()).search('dune', 10);
    expect(items.map((i) => i.providerId)).toEqual(['g1', 'g2']);
    expect(items[0]).toMatchObject({ mediaType: 'book', title: 'Dune', creator: 'Frank Herbert', genre: 'Fiction' });
  });

  it('ItunesSearchProvider maps album results with genre', async () => {
    mockFetch({
      results: [
        { collectionId: 42, collectionName: 'Dune (Soundtrack)', artistName: 'Hans Zimmer', artworkUrl100: 'http://img/z.jpg', primaryGenreName: 'Soundtrack' },
      ],
    });
    const items = await new ItunesSearchProvider('music').search('dune', 10);
    expect(items[0]).toMatchObject({
      mediaType: 'music',
      title: 'Dune (Soundtrack)',
      creator: 'Hans Zimmer',
      providerId: '42',
      genre: 'Soundtrack',
    });
  });

  it('ItunesSearchProvider falls back to trackName/trackId for podcasts', async () => {
    mockFetch({ results: [{ trackId: 7, trackName: 'The Daily', artistName: 'The New York Times' }] });
    const items = await new ItunesSearchProvider('podcast').search('daily', 10);
    expect(items[0]).toMatchObject({ mediaType: 'podcast', title: 'The Daily', providerId: '7' });
  });
});

describe('SearchService (cache-aside)', () => {
  afterEach(() => vi.restoreAllMocks());

  function makeService(provider: SearchProvider, cache = new InMemoryCacheService()) {
    const providers = { book: provider, music: provider, audiobook: provider, podcast: provider } as Record<MediaType, SearchProvider>;
    return { svc: new SearchService(cache, providers, testConfig()), cache };
  }

  it('serves the second identical query from cache (one provider call)', async () => {
    const provider: SearchProvider & { calls: number } = {
      name: 'fake',
      calls: 0,
      async search() {
        this.calls++;
        return [{ mediaType: 'book', title: 'Dune', creator: null, coverUrl: null, providerId: 'b1', provider: 'fake', genre: null }];
      },
    };
    const { svc } = makeService(provider);
    const a = await svc.search('book', 'Dune', 10);
    const b = await svc.search('book', '  dune  ', 10); // normalized to same key
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(provider.calls).toBe(1);
  });

  it('propagates a provider failure (distinct from a zero-result search)', async () => {
    const provider: SearchProvider = {
      name: 'fake',
      async search() {
        throw new Error('provider down');
      },
    };
    const { svc } = makeService(provider);
    await expect(svc.search('music', 'anything', 10)).rejects.toThrow('provider down');
  });

  it('still returns provider results when the cache read/write fails (best-effort)', async () => {
    const flakyCache = {
      get: async () => {
        throw new Error('redis down');
      },
      set: async () => {
        throw new Error('redis down');
      },
      delByPrefix: async () => undefined,
    } as unknown as InMemoryCacheService;
    const provider: SearchProvider = {
      name: 'fake',
      async search() {
        return [{ mediaType: 'book', title: 'Dune', creator: null, coverUrl: null, providerId: 'b1', provider: 'fake', genre: null }];
      },
    };
    const { svc } = makeService(provider, flakyCache);
    const items = await svc.search('book', 'dune', 10);
    expect(items).toHaveLength(1);
  });

  it('returns empty for a blank query without calling the provider', async () => {
    const provider: SearchProvider & { calls: number } = {
      name: 'fake',
      calls: 0,
      async search() {
        this.calls++;
        return [];
      },
    };
    const { svc } = makeService(provider);
    expect(await svc.search('book', '   ', 10)).toEqual([]);
    expect(provider.calls).toBe(0);
  });
});
