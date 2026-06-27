# Phase 0 Research: App Shell, Auth Gate & Home Page

The stack is inherited from feature 001 (TypeScript monorepo; Fastify + Prisma +
CloudSQL; React + Vite + TanStack Query + Material Design 3). Only the decisions new
to this feature are recorded here; no `NEEDS CLARIFICATION` remain.

## 1. App-wide authentication gate (frontend)

- **Decision**: Enforce the gate in the SPA router with a `ProtectedRoute` wrapper.
  Only `/signin` and the OAuth callback route are public; every other route renders
  inside the guard, which redirects to `/signin` when `GET /api/me` resolves
  unauthenticated. The backend continues to enforce auth per-endpoint (401), so the
  guard is UX, not the security boundary.
- **Rationale**: Defense in depth — the API already rejects unauthenticated requests
  (Principle IV); the router guard prevents any authenticated UI from rendering or
  flashing before redirect (FR-001). Centralizing it in one wrapper avoids per-page
  checks drifting.
- **Alternatives considered**: Per-page `useMe` redirects (already used by HomeFeed in
  001) — works but duplicates logic and risks a page being added without a guard.

## 2. Home data fetch — single aggregated local endpoint

- **Decision**: Add `GET /api/home` (auth-guarded) returning, in one response: the
  current user's own current items, the community feed's first page, and counts
  (currently-on; wishlisted = 0 until feature 005). The SPA loads the home from this
  one call.
- **Rationale**: The spec requires a sub-3s home built from **local data only**
  (FR-006/FR-007). One aggregated DB-backed call minimizes round-trips and external
  exposure (there are no external providers here). It reuses 001's feed query for the
  community page and adds an owner-scoped query for the user's items.
- **Alternatives considered**: Multiple parallel calls (`/api/me`, `/api/feed`,
  `/api/me/activities`) — more round-trips and more moving parts for the same data;
  the aggregate keeps the home fast and simple. (The individual endpoints remain
  available for other screens.)

## 3. Own current items vs. the global feed

- **Decision**: Add an owner-scoped activity query (the current user's activities,
  newest first, small limit) surfaced inside `GET /api/home`. The global community
  feed continues to come from the existing keyset feed query.
- **Rationale**: The left column shows "your current items" distinct from the center
  community feed; both are reads over the existing `Activity` table — no schema
  change. Owner scoping (`userId = currentUser`) keeps it private and cheap.
- **Alternatives considered**: Filtering the global feed client-side — wasteful and
  unreliable across pagination.

## 4. Navigation scaffold for not-yet-built destinations

- **Decision**: The app shell renders primary nav (Books, Music, Audiobooks, Wishlist)
  now; the category Discover routes render a lightweight "coming soon" placeholder
  page (delivered in 003) and the Wishlist route a placeholder (delivered in 005).
- **Rationale**: Establishes the information architecture and lets the home's quick
  links/nav exist without blocking on later features; placeholders are clearly marked.
- **Alternatives considered**: Hiding nav entries until their feature ships — causes
  nav churn across features and a less stable shell.

## 5. Hero image asset

- **Decision**: Ship the provided hero illustration as a **bundled frontend asset**
  (`frontend/src/assets/hero.png`), imported by the home page so Vite fingerprints and
  serves it from the existing static bucket/CDN. Use responsive `max-width`/`object-fit`
  so the wide image (~2816×1536) renders as a banner.
- **Rationale**: A bundled local asset satisfies "local files only" for the home
  (FR-006) and incurs no third-party request (consistent with the fonts decision).
  Cache-busting and CDN delivery come for free via the existing pipeline.
- **Alternatives considered**: Hosting the hero on an external/CDN URL — adds a
  third-party request and violates the home's local-only rule.
- **Open item**: confirm the exact source path before copying (user-provided path had a
  likely typo; see project memory).

## 6. Three-column responsive layout (Material Design 3)

- **Decision**: Implement the three-column home with a CSS grid that collapses to a
  single stacked column (center content first) on narrow viewports, styled with the
  existing MD3 tokens (surfaces, shape, type). Each region is an independent component
  that renders its own loading/empty/error state.
- **Rationale**: Satisfies FR-003/FR-004 (structure + independent regions + stacking)
  and reuses the MD3 system already in the SPA. Region independence prevents one
  empty/failed area from blanking the page.
- **Alternatives considered**: A heavyweight CSS framework/grid library — unnecessary
  given the MD3 token system and a simple grid.

## Resolved unknowns

No `NEEDS CLARIFICATION` remain. Provider/caching concerns are explicitly out of scope
for this feature (introduced in 003). The only follow-up is confirming the hero source
path at implementation time.
