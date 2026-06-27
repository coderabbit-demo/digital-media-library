# Feature Specification: Search & Recommendations

**Feature Branch**: `004-search-recommend`

**Created**: 2026-06-26

**Status**: Draft

**Input**: Split from the original content-discovery spec. Media search plus a
user-driven recommendation system that populates the home-page recommendations
region (feature 002). Also lets a user start an activity from a search result.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for media and recommend it (Priority: P1)

A signed-in user searches for a media item by title or creator, finds it in the
results, and recommends it via a "Recommend" action. Their recommendation then
appears in the community recommendations section on the home page. They can also
remove a recommendation they made.

**Why this priority**: This is what populates the (otherwise empty) home-page
recommendations region from feature 002, and is the primary value of this feature.

**Independent Test**: Search a known title, recommend a result, verify it appears in
the home recommendations section attributed to the user; remove it and verify it
disappears.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they search by title or creator, **Then** matching media items are returned (served via cache where possible), each with a "Recommend" action.
2. **Given** a search result or Discover item, **When** the user chooses "Recommend", **Then** their recommendation is recorded and appears in the home recommendations section, most recent first, attributed to them.
3. **Given** a recommendation the user made, **When** they remove it, **Then** it no longer appears.
4. **Given** a search returns no matches, **When** results render, **Then** the user sees a clear empty state, not an error.

---

### User Story 2 - Start an activity from a search result (Priority: P2)

From a search result, a signed-in user starts a "currently reading/listening"
activity for that item, reusing the feature-001 posting flow pre-filled with the
item's details.

**Why this priority**: Complements search/recommend and increases posting, but
search + recommend deliver value without it.

**Independent Test**: Search an item, choose "I'm reading/listening to this", verify
the compose flow is pre-filled and the submitted activity appears in the feed.

**Acceptance Scenarios**:

1. **Given** a search result, **When** the user chooses to start an activity, **Then** the compose flow opens pre-filled with the item's media type, title, and creator.
2. **Given** the pre-filled flow, **When** the user submits, **Then** the activity is created and appears in the feed attributed to them.

---

### Edge Cases

- **Empty/odd results**: No matches → clear empty state; results missing cover/creator render gracefully.
- **Externally sourced text**: Rendered as plain text, never as markup.
- **Duplicate recommendation**: Recommending an item already recommended by the user does not create a duplicate.
- **Empty recommendations**: When no user recommendations exist, the home recommendations region shows an inviting empty state (never auto-generated picks).
- **Search cadence**: Repeated/rapid searches respect the provider cache/refresh cadence to protect against API overages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authenticated users MUST be able to search for media items by title and/or creator within the supported categories; results MUST be sourced through the provider-abstraction layer and cached (no direct provider calls, respecting the refresh cadence).
- **FR-002**: Every media item (in search results and Discover views) MUST expose a "Recommend" action that records the signed-in user's recommendation of that item.
- **FR-003**: The home-page recommendations section MUST display media that users have recommended (community-wide), most recent first, each showing the item and who recommended it; externally sourced text rendered as plain text.
- **FR-004**: The home-page recommendations section MUST be populated solely by user-initiated recommendations; it MUST NOT contain auto-generated or algorithmic recommendations. (Auto/curated recommendations are deferred to future media-specific pages.)
- **FR-005**: A user MUST be able to remove a recommendation they previously made, after which it no longer appears.
- **FR-006**: Adding a recommendation for an item the user already recommended MUST NOT create a duplicate (idempotent).
- **FR-007**: A media item found via search MUST also support starting a "currently reading/listening" activity (reusing the feature-001 posting flow), pre-filled and editable before submission.

### Key Entities *(include if feature involves data)*

- **Trending Item / Media Item (referenced)**: From feature 003 — the searchable/recommendable content item (media type, title, creator, optional cover art, provider id), sourced through the shared provider abstraction + cache.
- **Recommendation**: A user-initiated endorsement of a media item. Attributes: the recommending user, the media item, and when it was made. Surfaced in the home recommendations region; one user may recommend a given item once and may remove it.
- **Activity Update (referenced)**: From feature 001 — a search item can seed one.

## Success Criteria *(mandatory)*

- **SC-001**: A user can search for a title and recommend a result in under 30 seconds, and the recommendation appears in the home recommendations section immediately afterward.
- **SC-002**: 100% of items in the home recommendations section originate from a user "Recommend" action (zero auto-generated entries).
- **SC-003**: At least 95% of repeat searches for the same terms are served from cache (no live provider call) during steady-state usage.
- **SC-004**: Removing a recommendation removes it from the recommendations section in 100% of cases.

## Assumptions

- **Builds on features 001, 002, 003**: Posting (001), the authenticated shell + home recommendations region (002), and the provider-abstraction + cache layer (003) exist and are reused.
- **Search scope**: Basic lookup by title/creator across supported categories via the provider abstraction; advanced faceted browsing or a full local catalog is not required.
- **Recommendations are user-generated only**: No auto-generated/algorithmic recommendations in this feature; those are deferred to future media-specific pages.

## Dependencies

- Features 001 (posting), 002 (shell + home recommendations region), 003 (provider abstraction + cache).
- External content providers for search (selected during planning).
