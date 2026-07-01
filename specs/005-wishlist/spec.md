# Feature Specification: My Library

**Feature Branch**: `005-wishlist`

**Created**: 2026-06-26

**Status**: Implemented

**Input**: Split from the original content-discovery spec, then refactored from a
flat "Wishlist" into **"My Library"** — a Goodreads-style, per-user collection
organized into shelves. "Add to Library" on media items, a dedicated all-media
My Library page with shelf tabs and a media-type filter, the ability to move an
item between shelves, and a bridge that offers to share an activity to the feed
when an item starts being read/listened to. Private per user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add to library and organize it on shelves (Priority: P1)

A signed-in user finds a media item (via search or Discover) and adds it to their
personal library with an "Add to Library" action; the item lands on the
**Want to Read** shelf by default. They visit a dedicated My Library page — a single
collection spanning all media types — where each item sits on exactly one shelf
(Want to Read, Currently Reading, Read, or Did Not Finish). They can move an item
to another shelf, browse by shelf (plus an "All" view that unions every shelf),
filter by media type, and remove items they no longer want.

**Why this priority**: An organized personal library is a high-value utility and is
the entire purpose of this feature; it is independently testable end to end.

**Independent Test**: Add an item to the library and verify it appears on Want to
Read; move it to another shelf and verify it relocates; filter by media type and
verify scoping; remove it and verify it disappears.

**Acceptance Scenarios**:

1. **Given** a search result or Discover item, **When** the user chooses "Add to Library", **Then** the item is added to their library on the **Want to Read** shelf and the control reflects that it's saved ("In Library ✓").
2. **Given** the user opens the My Library page, **When** it loads, **Then** they see their items across all media types, each on exactly one shelf, with shelf tabs (All + the four shelves).
3. **Given** an item on one shelf, **When** the user moves it to another shelf, **Then** it appears only on the new shelf and no longer on the old one.
4. **Given** a library with mixed media types, **When** the user applies a media-type filter, **Then** only items of that type are shown; clearing the filter restores all items.
5. **Given** an item in the library, **When** the user removes it, **Then** it no longer appears.
6. **Given** an item already in the user's library, **When** they add it again, **Then** it is not duplicated (idempotent; control indicates it's already saved).
7. **Given** another user's library, **When** the current user is signed in, **Then** they cannot see it — libraries are private to their owner.

---

### User Story 2 - Share an activity when you start an item (Priority: P2)

When a signed-in user moves a library item onto the **Currently Reading** shelf,
the app offers to share a "currently reading/listening" activity to the feed,
reusing the feature-001 compose flow. The library shelf is the source of truth;
sharing is optional and never automatic.

**Why this priority**: A convenient bridge from "saved/started" to a feed activity,
but the library delivers value without it.

**Independent Test**: Move a library item to Currently Reading, accept the offer to
share, and verify the activity appears in the feed attributed to the user; decline
the offer and verify nothing is posted while the item stays on Currently Reading.

**Acceptance Scenarios**:

1. **Given** a library item, **When** the user moves it to **Currently Reading**, **Then** the app offers to share an activity and the compose flow opens pre-filled with the item's details; on submit, the activity appears in the feed.
2. **Given** the offer to share, **When** the user declines, **Then** no activity is posted and the item remains on the Currently Reading shelf.

---

### Edge Cases

- **Empty library**: A user with no saved items sees an inviting empty state.
- **Empty shelf**: A shelf with no items shows a clear empty state; switching shelves restores content.
- **Filter with no matches**: A media-type filter matching nothing shows a clear "no items match" state; clearing restores the list.
- **Duplicate add**: Adding an item already in the library does not create a duplicate.
- **Privacy**: A user can never see another user's library.
- **Externally sourced text**: Item text rendered as plain text, never as markup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Media items (in Discover views and search results) MUST expose an "Add to Library" action that adds the item to the signed-in user's personal library on the **Want to Read** shelf by default.
- **FR-002**: A dedicated My Library page, reachable from the primary navigation, MUST list the user's items across all media types, each on exactly one shelf.
- **FR-003**: The My Library page MUST let the user browse by shelf — Want to Read, Currently Reading, Read, and Did Not Finish — plus an "All" view that shows every shelf together.
- **FR-004**: Each item MUST belong to exactly one shelf at a time, and the user MUST be able to move an item from one shelf to another.
- **FR-005**: The My Library page MUST provide a media-type filter that scopes the list independently of the selected shelf.
- **FR-006**: Users MUST be able to remove items from their library, after which the item no longer appears.
- **FR-007**: Adding an item already in the library MUST NOT create a duplicate (idempotent), and the control MUST indicate the item is already saved.
- **FR-008**: A user's library MUST be private — visible only to its owner.
- **FR-009**: When the user moves an item onto the **Currently Reading** shelf, the app MUST offer to share a "currently reading/listening" activity to the feed (reusing the feature-001 compose flow); sharing MUST be optional and MUST NOT happen automatically.
- **FR-010**: Shelf labels MUST be media-aware (e.g., "Want to Read" / "Read" for books vs. "Want to Listen" / "Listened" for music, audiobooks, and podcasts) while the underlying shelf is stored generically.

### Key Entities *(include if feature involves data)*

- **Library Item**: A media item a user has saved, on exactly one shelf. Attributes: the owner user, the media item (media type, title, creator, optional cover art, provider identifier), the shelf it sits on (Want to Read, Currently Reading, Read, or Did Not Finish), and when it was added and last moved. Private to the owner; unique per (owner, item).
- **Shelf**: One of Want to Read, Currently Reading, Read, or Did Not Finish. "All" is a view that unions every shelf, not a shelf an item can sit on.
- **Media Item (referenced)**: From feature 003 — sourced via the shared provider abstraction + cache when shown in Discover/search.
- **Activity Update (referenced)**: From feature 001 — moving an item to Currently Reading can seed one (offered, never automatic).

## Success Criteria *(mandatory)*

- **SC-001**: A user can add an item (from search or Discover) to their library in under 15 seconds and see it on the Want to Read shelf of the My Library page.
- **SC-002**: A user's library is visible only to its owner (zero cross-user exposure in verification testing).
- **SC-003**: Moving an item between shelves relocates it (it leaves the old shelf and appears on the new one) in 100% of cases.
- **SC-004**: Applying a media-type filter shows only matching items in 100% of cases, and clearing restores the full list.
- **SC-005**: Removing an item removes it from the library in 100% of cases.

## Assumptions

- **Builds on features 001, 002, 003**: Posting (001), the authenticated shell + library nav entry (002), and the media items surfaced by Discover/search via the provider abstraction (003) exist.
- **Library is personal/private**: No sharing of libraries in this feature.
- **All-media single page**: One My Library page spans all media types with shelf tabs and a media-type filter, rather than per-category libraries.
- **Supersedes the flat wishlist**: The former "Wishlist" becomes the **Want to Read** shelf; existing wishlist items migrate there.

## Dependencies

- Features 001 (posting), 002 (shell + library nav), 003 (media items via provider abstraction). Items are commonly added from search (feature 004) and Discover (003).
