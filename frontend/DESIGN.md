# Design

Visual system for the Digital Media Library SPA. Media-forward, system-adaptive
(light + dark; dark is the signature). Replaces Material Design 3. Covers/artwork and
people carry the color; chrome is quiet; one warm amber accent marks the key action.

## Theme & color strategy

- **Strategy:** Restrained — neutral surfaces + one amber accent. Content (cover art,
  avatars) supplies the rest of the color.
- **Brand seed:** `oklch(0.784 0.144 79.8)` (warm amber/honey). Primary stays within ±10° of hue 80.
- OKLCH throughout. Light = pure white surfaces; dark = chroma-0 near-black. Warmth lives
  in the accent + type, never in the surface.

### Tokens (semantic; `:root` = light, `@media (prefers-color-scheme: dark)` overrides)

Light:
```
--bg: oklch(1 0 0);            --surface: oklch(0.985 0 0);   --surface-2: oklch(0.955 0 0);
--ink: oklch(0.20 0 0);        --ink-muted: oklch(0.46 0 0);  --border: oklch(0.90 0 0);
--primary: oklch(0.80 0.144 80);   --on-primary: oklch(0.20 0.03 80);
--primary-ink: oklch(0.52 0.12 72);  /* amber as TEXT (AA on white) */
--ring: oklch(0.62 0.14 75);   --danger: oklch(0.55 0.20 25);  --star: oklch(0.74 0.15 80);
```
Dark:
```
--bg: oklch(0.15 0 0);         --surface: oklch(0.20 0 0);    --surface-2: oklch(0.255 0 0);
--ink: oklch(0.97 0 0);        --ink-muted: oklch(0.72 0 0);  --border: oklch(0.31 0 0);
--primary: oklch(0.80 0.144 80);   --on-primary: oklch(0.18 0.03 80);
--primary-ink: oklch(0.82 0.13 80);  /* amber as TEXT (AA on near-black) */
--ring: oklch(0.80 0.144 80);  --danger: oklch(0.68 0.19 25);  --star: oklch(0.82 0.15 80);
```
Contrast verified: ink/ink-muted on bg ≥ 4.5:1 both themes; on-primary on primary ≥ 4.5:1;
primary-ink on bg ≥ 4.5:1. Likes/ratings/badges pair color with an icon or label (never color alone).

## Typography

- One variable family in multiple weights (no risky sans-pairing): **Inter** (self-hosted/woff2),
  system fallback `ui-sans-serif, system-ui, sans-serif`.
- Scale (clamp, fluid): display `clamp(1.6rem, 1.2rem+1.6vw, 2.4rem)` / 700 / tracking -0.02em;
  h2 `1.25rem`/650; h3 `1rem`/600; body `0.9375rem`/400; small `0.8125rem`. Body line-length ≤ 72ch.
  `text-wrap: balance` on headings.

## Shape, depth, motion

- Radii: `--r-sm 8px`, `--r 12px`, `--r-lg 16px`, `--r-full 9999px`. Cards ≤ 16px. No 24px+ on cards.
- Depth via surface steps (bg → surface → surface-2), not heavy shadows. At most one soft shadow
  (≤ 8px blur) on overlays; never border + wide shadow together.
- Z-index scale: dropdown 100 · sticky 200 · modal-backdrop 300 · modal 400 · toast 500 · tooltip 600.
- Motion: ease-out (`cubic-bezier(0.16,1,0.3,1)`), 150–260ms; list staggers ≤ 40ms; every transition has a
  `@media (prefers-reduced-motion: reduce)` crossfade/instant fallback.

## Components (restyle targets, replacing MD3)

- **App shell / top bar:** quiet `--surface` bar, brand wordmark, nav (Home · Discover ▾ · My Library · 🔍),
  avatar. Sticky; thin bottom hairline. Dropdown via fixed/portal (no clip).
- **Buttons:** primary = amber fill + `--on-primary`; secondary = `--surface-2` + `--ink`; ghost/link = text in
  `--primary-ink`. 36–40px, `--r-full` for pills, `--r` for blocky. Remove `.btn-primary/ghost` MD look.
- **Inputs / select:** 1px `--border`, `--surface`, focus → `--ring`. Search field is prominent on the Search page.
- **Chips (filters):** pill, `--surface-2`; active = amber-tinted + `--primary-ink`.
- **Cover art:** crisp `object-fit: contain` on `--surface-2`, `--r-sm`; the brightest element on a card.
- **Feed card (ActivityCard):** author line, cover, title/creator, shelf control, note, synopsis+Continue,
  Preview link, ★ rating, ♥ Like, Comment. Hairline divider for actions; no nested cards.
- **Icons:** drop Material Symbols → inline SVG (search, sign-out, delete, chevron, heart, star).

## Iconography & assets

Inline SVG icons (stroke 1.5, currentColor). Self-host Inter woff2 (no render-blocking font CDN).
Keep `referrerPolicy="no-referrer"` on provider images.
