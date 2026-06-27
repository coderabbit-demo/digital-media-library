import { describe, it, expect } from 'vitest';
import {
  createActivitySchema,
  feedQuerySchema,
  mediaTypeSchema,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  TITLE_MAX_LENGTH,
} from '../src/index';

describe('createActivitySchema', () => {
  it('accepts a valid book activity and trims the title', () => {
    const parsed = createActivitySchema.parse({ mediaType: 'book', title: '  Dune  ' });
    expect(parsed).toEqual({ mediaType: 'book', title: 'Dune' });
  });

  it('rejects an empty/whitespace title', () => {
    expect(createActivitySchema.safeParse({ mediaType: 'music', title: '   ' }).success).toBe(false);
  });

  it('rejects a title over the max length', () => {
    const title = 'x'.repeat(TITLE_MAX_LENGTH + 1);
    expect(createActivitySchema.safeParse({ mediaType: 'book', title }).success).toBe(false);
  });

  it('rejects an unknown media type', () => {
    expect(createActivitySchema.safeParse({ mediaType: 'magazine', title: 'X' }).success).toBe(false);
  });

  it('accepts the podcast media type', () => {
    expect(createActivitySchema.safeParse({ mediaType: 'podcast', title: 'The Daily' }).success).toBe(true);
  });

  it('allows an optional itemAuthor', () => {
    const parsed = createActivitySchema.parse({
      mediaType: 'audiobook',
      title: 'Project Hail Mary',
      itemAuthor: 'Andy Weir',
    });
    expect(parsed.itemAuthor).toBe('Andy Weir');
  });
});

describe('feedQuerySchema', () => {
  it('defaults the limit when omitted', () => {
    expect(feedQuerySchema.parse({}).limit).toBe(FEED_DEFAULT_LIMIT);
  });

  it('coerces a string limit to a number', () => {
    expect(feedQuerySchema.parse({ limit: '25' }).limit).toBe(25);
  });

  it('rejects a limit above the max', () => {
    expect(feedQuerySchema.safeParse({ limit: FEED_MAX_LIMIT + 1 }).success).toBe(false);
  });

  it('passes through an opaque cursor', () => {
    expect(feedQuerySchema.parse({ cursor: 'abc' }).cursor).toBe('abc');
  });
});

describe('mediaTypeSchema', () => {
  it('accepts the three supported media types', () => {
    for (const t of ['book', 'music', 'audiobook'] as const) {
      expect(mediaTypeSchema.parse(t)).toBe(t);
    }
  });
});
