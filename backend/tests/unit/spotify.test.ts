import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpotifyLinkProvider } from '../../src/providers/spotify.js';
import { testConfig } from '../helpers/test-app.js';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function mockSpotify(searchBody: unknown, status = 200) {
  const calls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('accounts.spotify.com/api/token')) {
      return json({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 });
    }
    return json(searchBody, status);
  });
  return calls;
}

const configured = () =>
  new SpotifyLinkProvider(testConfig({ SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret' }));

describe('SpotifyLinkProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the album URL for music', async () => {
    mockSpotify({ albums: { items: [{ external_urls: { spotify: 'https://open.spotify.com/album/1' } }] } });
    const url = await configured().findUrl('music', 'Random Access Memories', 'Daft Punk');
    expect(url).toBe('https://open.spotify.com/album/1');
  });

  it('uses the show bucket for podcasts and audiobook bucket for audiobooks', async () => {
    mockSpotify({ shows: { items: [{ external_urls: { spotify: 'https://open.spotify.com/show/9' } }] } });
    expect(await configured().findUrl('podcast', 'The Daily', 'NYT')).toBe('https://open.spotify.com/show/9');

    mockSpotify({ audiobooks: { items: [{ external_urls: { spotify: 'https://open.spotify.com/audiobook/7' } }] } });
    expect(await configured().findUrl('audiobook', 'Becoming', 'Michelle Obama')).toBe(
      'https://open.spotify.com/audiobook/7',
    );
  });

  it('returns null for books and when not configured (no network)', async () => {
    const calls = mockSpotify({ albums: { items: [] } });
    expect(await configured().findUrl('book', 'Dune', 'Herbert')).toBeNull();
    // Not configured: never calls the API.
    const off = new SpotifyLinkProvider(testConfig());
    expect(await off.findUrl('music', 'Dune', 'Herbert')).toBeNull();
    expect(calls.length).toBe(0);
  });

  it('returns null on an empty result or upstream error (additive, never throws)', async () => {
    mockSpotify({ albums: { items: [] } });
    expect(await configured().findUrl('music', 'Nope', null)).toBeNull();

    mockSpotify({}, 500);
    expect(await configured().findUrl('music', 'Boom', null)).toBeNull();
  });
});
