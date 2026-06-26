import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../../src/services/feed.js';
import { HttpError } from '../../src/plugins/errors.js';

describe('unit: feed cursor', () => {
  it('round-trips an opaque cursor', () => {
    const payload = { createdAt: '2026-06-26T10:00:00.000Z', id: 'abc-123' };
    const cursor = encodeCursor(payload);
    // Opaque: should not be human-readable plain JSON.
    expect(cursor).not.toContain('createdAt');
    expect(decodeCursor(cursor)).toEqual(payload);
  });

  it('throws a 400 HttpError on malformed cursor', () => {
    expect(() => decodeCursor('not-base64-$$$')).toThrow(HttpError);
    try {
      decodeCursor('eyJ4IjoxfQ'); // base64 for {"x":1} — missing required fields
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(400);
    }
  });
});
