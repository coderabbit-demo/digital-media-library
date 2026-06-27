import { afterEach, describe, expect, it, vi } from 'vitest';
import { NytBooksProvider } from '../../src/providers/nyt-books.js';
import { GoogleBooksProvider } from '../../src/providers/google-books.js';
import { AppleAudiobookProvider } from '../../src/providers/apple-audiobooks.js';
import { SpotifyMusicProvider } from '../../src/providers/spotify-music.js';
import { InMemoryCacheService } from '../../src/services/cache.js';
import { testConfig } from '../helpers/test-app.js';

function mockFetchOnce(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('provider adapters', () => {
  afterEach(() => vi.restoreAllMocks());

  it('NytBooksProvider normalizes bestseller books and dedupes by isbn', async () => {
    mockFetchOnce({
      results: {
        lists: [
          {
            list_name: 'Hardcover Fiction',
            books: [
              { title: 'Dune', author: 'Frank Herbert', book_image: 'http://img/d.jpg', primary_isbn13: '111' },
              { title: 'Dune', author: 'Frank Herbert', primary_isbn13: '111' }, // dup
              { title: 'Sapiens', author: 'Y. N. Harari', primary_isbn13: '222' },
            ],
          },
        ],
      },
    });
    const items = await new NytBooksProvider(testConfig({ NYT_API_KEY: 'k' })).getTrending(10);
    expect(items.map((i) => i.title)).toEqual(['Dune', 'Sapiens']);
    expect(items[0]).toMatchObject({
      mediaType: 'book',
      creator: 'Frank Herbert',
      providerId: '111',
      genre: 'Hardcover Fiction',
    });
  });

  it('NytBooksProvider throws when no API key is configured', async () => {
    await expect(new NytBooksProvider(testConfig({ NYT_API_KEY: undefined })).getTrending(5)).rejects.toThrow();
  });

  it('AppleAudiobookProvider normalizes the RSS feed', async () => {
    mockFetchOnce({
      feed: { results: [{ id: 'a1', name: 'Becoming', artistName: 'Michelle Obama', artworkUrl100: 'http://img/a.jpg' }] },
    });
    const items = await new AppleAudiobookProvider().getTrending(10);
    expect(items[0]).toMatchObject({
      mediaType: 'audiobook',
      title: 'Becoming',
      creator: 'Michelle Obama',
      providerId: 'a1',
    });
  });

  it('SpotifyMusicProvider fetches a token then maps new releases', async () => {
    const cache = new InMemoryCacheService();
    const releases = () =>
      new Response(
        JSON.stringify({
          albums: { items: [{ id: 'al1', name: 'Blue', artists: [{ name: 'Joni Mitchell' }], images: [{ url: 'http://img/b.jpg' }] }] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(releases()) // first getTrending → releases
      .mockResolvedValueOnce(releases()); // second getTrending → releases (token cached)
    const provider = new SpotifyMusicProvider(
      testConfig({ SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret' }),
      cache,
    );
    const items = await provider.getTrending(10);
    expect(items[0]).toMatchObject({ mediaType: 'music', title: 'Blue', creator: 'Joni Mitchell', providerId: 'al1' });
    expect(spy).toHaveBeenCalledTimes(2);
    // Token cached → a second call reuses it (only the releases request).
    await provider.getTrending(10);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('GoogleBooksProvider normalizes volumes (deduped across genres)', async () => {
    mockFetchOnce({
      items: [
        { id: 'g1', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], imageLinks: { thumbnail: 'http://img/d.jpg' } } },
      ],
    });
    const items = await new GoogleBooksProvider(testConfig()).getTrending(10);
    // Same item returned for every genre query → deduped to one.
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      mediaType: 'book',
      title: 'Dune',
      creator: 'Frank Herbert',
      providerId: 'g1',
    });
    // Genre is the title-cased subject (first query is "fiction" → "Fiction").
    expect(items[0]!.genre).toBe('Fiction');
  });

  it('GoogleBooksProvider throws when every genre query fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(new GoogleBooksProvider(testConfig()).getTrending(5)).rejects.toThrow();
  });

  it('SpotifyMusicProvider throws without credentials', async () => {
    const provider = new SpotifyMusicProvider(
      testConfig({ SPOTIFY_CLIENT_ID: undefined, SPOTIFY_CLIENT_SECRET: undefined }),
      new InMemoryCacheService(),
    );
    await expect(provider.getTrending(5)).rejects.toThrow();
  });
});
