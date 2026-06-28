/**
 * Convert provider HTML (iTunes/Google often embed <b>, <i>, <br/>, &amp;, …)
 * into clean plain text. We never render provider markup (constitution IV /
 * feature 007 FR-011), so descriptions are normalized to text at the boundary:
 * block/line tags become newlines, remaining tags are dropped, and common HTML
 * entities are decoded. Returns null for empty/whitespace-only input.
 */
export function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    // Line/paragraph breaks → newlines before tags are stripped.
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li)\s*>/gi, '\n')
    // Drop all remaining tags.
    .replace(/<[^>]+>/g, '')
    // Decode the handful of entities providers actually emit.
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    // Tidy whitespace: collapse runs of blank lines and trailing spaces.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}
