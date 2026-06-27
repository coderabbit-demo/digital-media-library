import type { ContentProvider, TrendingItem } from './content-provider.js';

/**
 * Dedup key across providers. Includes genre so the same book can legitimately
 * appear under different genres (e.g., on more than one bestseller list), while
 * duplicates within the same genre are collapsed.
 */
function dedupeKey(item: TrendingItem): string {
  return `${(item.genre ?? '').toLowerCase().trim()}|${item.title.toLowerCase().trim()}|${(item.creator ?? '').toLowerCase().trim()}`;
}

/**
 * Aggregates multiple book sources (e.g., NYT all-genre bestsellers + Google
 * Books) into one trending list: queries them in parallel, tolerates per-source
 * failures (uses whatever succeeded), interleaves for variety, and dedupes the
 * same title/author across sources. Throws only when every source fails.
 */
export class CompositeBooksProvider implements ContentProvider {
  readonly name = 'composite-books';

  constructor(private readonly sources: ContentProvider[]) {}

  async getTrending(limit: number): Promise<TrendingItem[]> {
    const settled = await Promise.allSettled(this.sources.map((s) => s.getTrending(limit)));
    const lists = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (lists.length === 0) throw new Error('all book sources failed');

    const out: TrendingItem[] = [];
    const seen = new Set<string>();
    const maxLen = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < maxLen && out.length < limit; i++) {
      for (const list of lists) {
        const item = list[i];
        if (!item) continue;
        const key = dedupeKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= limit) break;
      }
    }
    return out;
  }
}
