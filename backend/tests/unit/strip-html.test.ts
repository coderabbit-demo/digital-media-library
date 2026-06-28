import { describe, expect, it } from 'vitest';
import { stripHtml } from '../../src/providers/text.js';

describe('stripHtml', () => {
  it('strips tags and decodes entities to plain text', () => {
    const input = '<b>“<i>Regime Change</i> is exceptional.”</b> —David Remnick &amp; co.';
    expect(stripHtml(input)).toBe('“Regime Change is exceptional.” —David Remnick & co.');
  });

  it('converts <br/> and block-end tags to newlines, collapsing extras', () => {
    expect(stripHtml('one<br /><br />two</p>three')).toBe('one\n\ntwo\nthree');
  });

  it('returns null for empty/whitespace/markup-only input', () => {
    expect(stripHtml('')).toBeNull();
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml('   ')).toBeNull();
    expect(stripHtml('<br/>')).toBeNull();
  });
});
