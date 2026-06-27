# Feature Specification: App Shell, Auth Gate & Home Page

**Feature Branch**: `002-app-shell-home`

**Created**: 2026-06-26

**Status**: Draft

**Input**: Split from the original content-discovery spec. Establishes the
authenticated application shell (app-wide auth gate + category navigation) and the
three-column home page. Discover, search/recommendations, and wishlist are separate
features (003, 004, 005).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App-wide authentication gate (Priority: P1)

The entire application is restricted to authenticated users. An unauthenticated
visitor can reach only the registration/login page; any other location redirects
them there. After signing in, they reach the application shell.

**Why this priority**: This is the security boundary every other screen relies on;
it must exist before any authenticated content is shown.

**Independent Test**: While signed out, attempt to open the home page and other
in-app URLs; verify each redirects to login and no content is shown. Sign in and
verify access is granted.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they request any in-app location other than login/registration, **Then** they are redirected to the registration/login page and no other content is visible.
2. **Given** a signed-in user, **When** they navigate the app, **Then** authenticated content is shown.
3. **Given** a user signs out, **When** they then request an in-app location, **Then** they are redirected to login.

---

### User Story 2 - Home page (three-column layout) (Priority: P1)

A signed-in user lands on the home page, organized as a **three-column layout**
following the provided Goodreads-style reference:

- **Left column** — the user's own "currently reading/listening" items (cover, title,
  creator), quick links to post an update and to open their Wishlist, and simple
  counts (currently-on count, wishlisted count).
- **Center column** — a hero image/banner at the top, with the community activity
  feed ("Updates", from feature 001) below it.
- **Right column** — the recommendations section. In this feature the region is
  present but populated by user recommendations delivered in feature 004; until then
  it shows an inviting empty state.

On smaller screens the columns stack into a single scrollable column (center first),
preserving all regions.

**Why this priority**: The home page is the primary entry point and the frame the
rest of the product renders within.

**Independent Test**: Sign in and load the home page; verify the three columns and
their content (own items + Wishlist link on the left, hero + community feed in the
center, recommendations region on the right) and that they stack on a narrow viewport.

**Acceptance Scenarios**:

1. **Given** a signed-in user with posted activity, **When** they open the home page, **Then** the left column shows their own current "currently reading/listening" items plus quick links (post an update, open Wishlist) and simple counts.
2. **Given** community activity exists, **When** the home page loads, **Then** the center column shows a hero/banner at the top and the community feed below it.
3. **Given** the home page loads, **When** rendered, **Then** the right column shows a recommendations region (an inviting empty state until feature 004 populates it) — never auto-generated picks.
4. **Given** a narrow/mobile viewport, **When** the home page loads, **Then** the columns stack into one scrollable column with all regions present.
5. **Given** the user has no activity of their own yet, **When** they open the home page, **Then** the left column shows an inviting empty state while the other columns still render.
6. **Given** the home page loads, **When** its data is fetched, **Then** only local sources are used (the app's own database and bundled assets) with zero external content-provider calls, and the page is ready in under 3 seconds.

---

### Edge Cases

- **Unauthenticated access**: Any in-app URL while signed out redirects to login; nothing else is visible.
- **Region independence**: A failure or empty state in one home-page region does not prevent the others from rendering.
- **No own activity / no community activity**: Each region shows its own inviting empty state.
- **Narrow viewport**: Columns stack without losing any region.
- **User-provided text**: All text is rendered as plain text, never as markup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entire application MUST be restricted to authenticated users; unauthenticated visitors MUST see only the registration/login page and MUST be redirected there from any other location.
- **FR-002**: The application shell MUST provide primary navigation organized by media category — Books, Music, Audiobooks — plus access to the Wishlist. (The Discover destinations are delivered in feature 003 and the Wishlist page in feature 005; this feature provides the navigation scaffold.)
- **FR-003**: The home page MUST present a three-column layout: a left column with the user's own current "currently reading/listening" items, quick links (post an update, open Wishlist), and simple counts; a center column with a hero/banner above the community activity feed (feature 001); and a right column with a recommendations region.
- **FR-004**: Each home-page region MUST render independently — a failure or empty state in one MUST NOT prevent the others from rendering. On smaller viewports the columns MUST stack into a single scrollable column (center prioritized), retaining all regions.
- **FR-005**: The recommendations region MUST show an inviting empty state in this feature; it is populated only by user-initiated recommendations (feature 004) and MUST NEVER contain auto-generated/algorithmic picks.
- **FR-006**: The home page MUST be assembled exclusively from local data sources — the application's own database and bundled/static assets (e.g., the hero image) — and MUST NOT make any external content-provider calls.
- **FR-007**: The home page MUST be ready (all local-data regions populated) in under 3000 ms under normal conditions.

### Key Entities *(include if feature involves data)*

- **User Profile (referenced)**: From feature 001 — identifies the signed-in user whose own items and counts are shown.
- **Activity Update (referenced)**: From feature 001 — the user's own current items and the community feed.
- **Media Category**: One of Books, Music, Audiobooks; organizes primary navigation.

## Success Criteria *(mandatory)*

- **SC-001**: 100% of attempts to access any non-login part of the app while unauthenticated are redirected to login (no content leakage).
- **SC-002**: The home page presents all regions (hero, own items + Wishlist link, community feed, recommendations region) on load for a signed-in user.
- **SC-003**: The home page loads in under 3 seconds (3000 ms) under normal conditions, making zero external content-provider calls (only local database/asset reads).
- **SC-004**: On a narrow viewport, all home-page regions remain present and reachable in a single stacked column.

## Assumptions

- **Builds on feature 001**: Authentication (Google sign-in), profiles, and the activity feed exist and are reused.
- **Home layout reference**: The Goodreads home page is the reference for the three-column structure and region placement only; Goodreads-specific widgets (reading challenges, star ratings, "News & Interviews", Read/DNF shelves) are out of scope. Visual styling uses the project's Material Design 3 system.
- **Hero content**: The hero is a provided static illustration (anime-style reader on a San Francisco beach at sunset with the Golden Gate Bridge, ~2816×1536), added as a bundled frontend asset. Rotating/personalized hero imagery is not required.
- **Recommendations & Wishlist links**: Present in the shell/home now; their destinations/content are delivered in features 004 and 005 respectively.
- **Web SPA, authenticated**: Same platform/identity assumptions as feature 001; Google is the sole identity provider.

## Dependencies

- Feature 001 (authentication, profiles, activity feed).
