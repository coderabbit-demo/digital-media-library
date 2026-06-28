import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleBooksItemProvider } from '../../src/providers/google-books-item.js';
import { testConfig } from '../helpers/test-app.js';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const volume = (id: string, title: string) => ({ id, volumeInfo: { title, authors: ['A. Writer'] } });

describe('GoogleBooksItemProvider.getItem', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves a Google volume id via the volume-by-id endpoint', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((u: RequestInfo | URL) => {
      calls.push(String(u));
      return json(volume('uq8hzgEACAAJ', 'The Scarlet Letter'));
    });
    const d = await new GoogleBooksItemProvider(testConfig()).getItem('uq8hzgEACAAJ');
    expect(d?.title).toBe('The Scarlet Letter');
    expect(d?.providerId).toBe('uq8hzgEACAAJ');
    expect(calls[0]).toContain('/volumes/uq8hzgEACAAJ');
  });

  it('resolves an ISBN (NYT-sourced id) via search, keeping the ISBN as providerId', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((u: RequestInfo | URL) => {
      calls.push(String(u));
      return json({ items: [volume('GVID123', 'Bestseller')] });
    });
    const d = await new GoogleBooksItemProvider(testConfig()).getItem('9781603935470');
    expect(d?.title).toBe('Bestseller');
    // The app's id (ISBN) is preserved so shelf/rating controls line up.
    expect(d?.providerId).toBe('9781603935470');
    expect(calls[0]).toContain('q=isbn:9781603935470');
    expect(calls[0]).not.toContain('/volumes/9781603935470'); // never hits volume-by-id for an ISBN
  });

  it('returns null when the ISBN is not in Google Books', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ totalItems: 0, items: [] }));
    const d = await new GoogleBooksItemProvider(testConfig()).getItem('9781603935470');
    expect(d).toBeNull();
  });
});
