import { describe, expect, it } from 'vitest';
import { createActivitySchema, feedQuerySchema } from '@dml/shared';

describe('unit: createActivitySchema', () => {
  it('accepts a valid book post', () => {
    const r = createActivitySchema.safeParse({ mediaType: 'book', title: 'Dune' });
    expect(r.success).toBe(true);
  });

  it('rejects whitespace-only title', () => {
    const r = createActivitySchema.safeParse({ mediaType: 'book', title: '   ' });
    expect(r.success).toBe(false);
  });

  it('rejects a title longer than 300 chars', () => {
    const r = createActivitySchema.safeParse({ mediaType: 'book', title: 'a'.repeat(301) });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown media type', () => {
    const r = createActivitySchema.safeParse({ mediaType: 'movie', title: 'X' });
    expect(r.success).toBe(false);
  });
});

describe('unit: feedQuerySchema', () => {
  it('defaults limit to 20', () => {
    const r = feedQuerySchema.parse({});
    expect(r.limit).toBe(20);
  });

  it('coerces and caps limit', () => {
    expect(feedQuerySchema.safeParse({ limit: '50' }).success).toBe(true);
    expect(feedQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
