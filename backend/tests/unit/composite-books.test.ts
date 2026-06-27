import { describe, expect, it } from 'vitest';
import { CompositeBooksProvider } from '../../src/providers/composite-books.js';
import type { ContentProvider, TrendingItem } from '../../src/providers/content-provider.js';

function item(title: string, creator: string, id: string, genre = 'Fiction'): TrendingItem {
  return { mediaType: 'book', title, creator, coverUrl: null, providerId: id, provider: 'x', genre };
}

class StubSource implements ContentProvider {
  readonly name = 'stub';
  constructor(
    private readonly items: TrendingItem[],
    private readonly fail = false,
  ) {}
  async getTrending(limit: number): Promise<TrendingItem[]> {
    if (this.fail) throw new Error('source down');
    return this.items.slice(0, limit);
  }
}

describe('CompositeBooksProvider', () => {
  it('merges sources and dedupes the same title/author across them', async () => {
    const a = new StubSource([item('Dune', 'Herbert', 'a1'), item('Sapiens', 'Harari', 'a2')]);
    const b = new StubSource([item('Dune', 'Herbert', 'b9'), item('1984', 'Orwell', 'b2')]);
    const out = await new CompositeBooksProvider([a, b]).getTrending(10);
    const titles = out.map((i) => i.title).sort();
    expect(titles).toEqual(['1984', 'Dune', 'Sapiens']); // Dune deduped across sources
  });

  it('tolerates a failing source and returns the other source\'s items', async () => {
    const ok = new StubSource([item('Dune', 'Herbert', 'a1')]);
    const down = new StubSource([], true);
    const out = await new CompositeBooksProvider([ok, down]).getTrending(10);
    expect(out.map((i) => i.title)).toEqual(['Dune']);
  });

  it('throws only when every source fails', async () => {
    const down1 = new StubSource([], true);
    const down2 = new StubSource([], true);
    await expect(new CompositeBooksProvider([down1, down2]).getTrending(10)).rejects.toThrow();
  });

  it('respects the limit', async () => {
    const a = new StubSource([item('A', 'x', '1'), item('B', 'x', '2'), item('C', 'x', '3')]);
    const out = await new CompositeBooksProvider([a]).getTrending(2);
    expect(out).toHaveLength(2);
  });
});
