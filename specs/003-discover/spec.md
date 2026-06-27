# Feature Specification: Discover (Trending by Category)

**Feature Branch**: `003-discover`

**Created**: 2026-06-26

**Status**: Draft

**Input**: Split from the original content-discovery spec. Per-category Discover
views of trending content from external providers. **Introduces the provider
abstraction + caching layer** reused by later features. Also lets a user start a
"currently reading/listening" activity from a discovered item.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover trending content by category (Priority: P1)

A signed-in user selects a media category from the primary navigation — Books,
Music, or Audiobooks — and opens its **Discover** view, seeing a list of
trending/popular items for that media type (title, creator, and cover art where
available), refreshed periodically. Each category's Discover view is independent.

**Why this priority**: Discovery of trending content is the core value of this
feature and is independently demonstrable as soon as one category returns items.

**Independent Test**: Sign in, open Books → Discover and verify trending books with
titles and creators; repeat for Music and Audiobooks and verify each is independent.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open Books → Discover, **Then** they see trending books, each with at least a title and author (and cover art when the provider supplies it).
2. **Given** a signed-in user, **When** they open Music → Discover then Audiobooks → Discover, **Then** each shows items appropriate to that media type, independent of the others.
3. **Given** trending data was recently retrieved, **When** another user opens the same Discover view shortly after, **Then** results are served from cache quickly without re-fetching from the provider.
4. **Given** the provider for a category is unavailable or rate-limited, **When** a user opens that Discover view, **Then** the most recent cached results are shown (stale-but-available) with an indication they may be out of date, rather than an error.
5. **Given** no data is available at all for a category (cold start, provider down), **When** the user opens it, **Then** they see a clear unavailable/empty state, not a crash.

---

### User Story 2 - Start an activity from a discovered item (Priority: P2)

While browsing a Discover view, a signed-in user chooses an item and starts a
"currently reading/listening" activity for it. The feature-001 compose flow opens
pre-filled with the item's media type, title, and creator; on submission the
activity appears in the community feed and the user's own items.

**Why this priority**: Connects discovery to the social feed and increases posting,
but Discover delivers value without it; builds on US1 and feature-001 posting.

**Independent Test**: From Books → Discover choose an item, start an activity, verify
the compose flow is pre-filled and the submitted activity appears in the feed.

**Acceptance Scenarios**:

1. **Given** a user viewing a Discover item, **When** they choose "I'm reading/listening to this", **Then** a compose flow opens pre-filled with the item's media type, title, and creator.
2. **Given** the pre-filled compose flow, **When** the user submits, **Then** the activity is created (subject to existing posting rules and rate limit) and appears at the top of the feed attributed to them.
3. **Given** the pre-filled fields, **When** the user edits them before submitting, **Then** the edited values are saved.

---

### Edge Cases

- **Provider partial failure**: One category's provider is down while others are healthy — only the affected category serves stale/empty state.
- **Stale data indication**: Cached data served past its freshness window (provider down) is marked as possibly out of date.
- **Sparse/odd provider data**: Items missing cover art or creator, or with very long titles, render gracefully (placeholders, safe truncation).
- **Externally sourced text**: Rendered as plain text, never as markup.
- **Duplicate trending items** across refreshes do not produce visual duplicates within a view.
- **Navigation churn**: Repeated navigation between Discover views does not trigger provider calls beyond the refresh cadence.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-000**: Every Discover view and its data endpoint MUST require authentication (consistent with the app-wide auth gate from feature 002); unauthenticated requests are rejected/redirected and receive no trending data.
- **FR-001**: Each Discover view MUST present trending/popular items for its media type, showing at least a title and creator (author/artist), plus cover art when available.
- **FR-002**: Trending content MUST be sourced from external content providers exclusively through an internal provider-abstraction layer; no part of the product calls a provider directly.
- **FR-003**: Provider responses MUST be cached with a defined freshness window (TTL); within that window, Discover views MUST be served from cache without contacting the provider.
- **FR-004**: When a provider is unavailable or rate-limited, the system MUST serve the most recent cached results (stale-but-available) and indicate they may be out of date, rather than failing.
- **FR-005**: When no data (fresh or cached) is available for a category, the system MUST show a clear unavailable/empty state.
- **FR-006**: All externally sourced text MUST be rendered as plain text, never as executable markup.
- **FR-007**: User navigation MUST NOT cause external-provider calls beyond the defined refresh cadence (protecting against API overages).
- **FR-008**: From a Discover item, an authenticated user MUST be able to start a "currently reading/listening" activity pre-filled with that item's media type, title, and creator, reusing the feature-001 posting flow (validation and rate limit included).
- **FR-009**: A pre-filled activity MUST be editable before submission and, on submission, MUST appear in the community feed and the user's own items, attributed to the user.

### Key Entities *(include if feature involves data)*

- **Media Category (referenced)**: Books, Music, Audiobooks — scopes a Discover view and its trending source (nav from feature 002).
- **Trending Item**: An externally sourced content item within a category. Attributes: media type, title, creator, optional cover-art reference, provider identifier. Cached, not authoritative; rebuildable from the provider.
- **Activity Update (referenced)**: From feature 001 — a Discover item can seed one.

## Success Criteria *(mandatory)*

- **SC-001**: A signed-in user can open any category's Discover view and see trending items within 2 seconds under normal conditions.
- **SC-002**: At least 95% of Discover views are served from cache (no live provider call) during steady-state usage.
- **SC-003**: When a provider is unavailable, 100% of Discover views for that category still render (cached or a clear unavailable state) — zero error pages.
- **SC-004**: A user can go from a Discover item to a posted activity in under 30 seconds.
- **SC-005**: External-provider call volume stays within the chosen providers' free/low-cost quota during steady-state usage at the launch scale (~100 concurrent users).

## Assumptions

- **Builds on features 001 and 002**: Auth/posting (001) and the authenticated shell + category navigation (002) exist.
- **Provider selection deferred to planning**: Concrete trending providers per category are chosen during `/speckit-plan`; assumed stable, documented, with predictable quotas.
- **Trending cadence**: A periodic refresh window (minutes-to-hours) is acceptable; real-time trending is not required.
- **Read-only external content**: Discovered items are for browsing and seeding activities; no full catalog, purchasing, or buy links.
- This feature establishes the provider-abstraction + caching layer (constitution Principle III) reused by features 004 and 005.

## Dependencies

- Features 001 (posting) and 002 (auth shell + navigation).
- External content providers for trending data (selected during planning).
- The caching layer / provider-abstraction boundary mandated by the constitution (Principle III).
