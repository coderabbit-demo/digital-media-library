import { afterEach, describe, expect, it, vi } from 'vitest';
import { NytBooksProvider } from '../../src/providers/nyt-books.js';
import { GoogleBooksProvider } from '../../src/providers/google-books.js';
import { AppleAudiobookProvider } from '../../src/providers/apple-audiobooks.js';
import { AppleMusicProvider } from '../../src/providers/apple-music.js';
import { ApplePodcastProvider } from '../../src/providers/apple-podcasts.js';
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

  it('AppleMusicProvider normalizes albums and picks a genre (skipping the "Music" parent)', async () => {
    mockFetchOnce({
      feed: {
        results: [
          {
            id: 'al1',
            name: 'ICEMAN',
            artistName: 'Drake',
            artworkUrl100: 'http://img/b.jpg',
            genres: [{ name: 'Music' }, { name: 'Hip-Hop/Rap' }],
          },
        ],
      },
    });
    const items = await new AppleMusicProvider().getTrending(10);
    expect(items[0]).toMatchObject({
      mediaType: 'music',
      title: 'ICEMAN',
      creator: 'Drake',
      providerId: 'al1',
      // The generic "Music" parent is skipped in favor of the specific genre.
      genre: 'Hip-Hop/Rap',
    });
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

  it('ApplePodcastProvider normalizes shows with publisher and genre', async () => {
    mockFetchOnce({
      feed: {
        results: [
          {
            id: 'p1',
            name: 'The Daily',
            artistName: 'The New York Times',
            artworkUrl100: 'http://img/p.jpg',
            genres: [{ name: 'News' }],
          },
        ],
      },
    });
    const items = await new ApplePodcastProvider().getTrending(10);
    expect(items[0]).toMatchObject({
      mediaType: 'podcast',
      title: 'The Daily',
      creator: 'The New York Times',
      providerId: 'p1',
      genre: 'News',
    });
  });

  it('Apple RSS providers throw on upstream failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(new AppleMusicProvider().getTrending(5)).rejects.toThrow();
    await expect(new ApplePodcastProvider().getTrending(5)).rejects.toThrow();
  });
});
