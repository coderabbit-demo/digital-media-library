# Feature Specification: Wishlist

**Feature Branch**: `005-wishlist`

**Created**: 2026-06-26

**Status**: Draft

**Input**: Split from the original content-discovery spec. A personal wishlist:
"Add to Wishlist" on media items, and a dedicated, all-media Wishlist page with
filters. Private per user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add to wishlist and manage it (Priority: P1)

A signed-in user finds a media item (via search or Discover) and adds it to their
personal wishlist with an "Add to Wishlist" action. They visit a dedicated Wishlist
page — a single view spanning all media types — where they can filter items (e.g.,
by media type) and remove items they no longer want.

**Why this priority**: A wishlist is a high-value personal utility and is the entire
purpose of this feature; it is independently testable end to end.

**Independent Test**: Add an item to the wishlist, open the Wishlist page and verify
it appears; filter by its media type and verify scoping; remove it and verify it
disappears.

**Acceptance Scenarios**:

1. **Given** a search result or Discover item, **When** the user chooses "Add to Wishlist", **Then** the item is added to their personal wishlist and the control reflects that it's saved.
2. **Given** the user opens the Wishlist page, **When** it loads, **Then** they see their wishlist items across all media types in a single list.
3. **Given** a wishlist with mixed media types, **When** the user applies a media-type filter, **Then** only items of that type are shown; clearing the filter restores all items.
4. **Given** an item on the wishlist, **When** the user removes it, **Then** it no longer appears.
5. **Given** an item already on the user's wishlist, **When** they add it again, **Then** it is not duplicated (idempotent; control indicates it's already saved).
6. **Given** another user's wishlist, **When** the current user is signed in, **Then** they cannot see it — wishlists are private to their owner.

---

### User Story 2 - Start an activity from a wishlist item (Priority: P2)

From an item on their wishlist, a signed-in user starts a "currently
reading/listening" activity for it, reusing the feature-001 posting flow.

**Why this priority**: Convenient bridge from "saved for later" to "currently
engaging", but the wishlist delivers value without it.

**Independent Test**: From a wishlist item, start an activity and verify it appears
in the feed attributed to the user.

**Acceptance Scenarios**:

1. **Given** a wishlist item, **When** the user chooses to start an activity, **Then** the compose flow opens pre-filled with the item's details and, on submit, the activity appears in the feed.

---

### Edge Cases

- **Empty wishlist**: A user with no saved items sees an inviting empty state.
- **Filter with no matches**: A filter matching nothing shows a clear "no items match" state; clearing restores the list.
- **Duplicate add**: Adding an item already on the wishlist does not create a duplicate.
- **Privacy**: A user can never see another user's wishlist.
- **Externally sourced text**: Item text rendered as plain text, never as markup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Media items (in Discover views and search results) MUST expose an "Add to Wishlist" action that adds the item to the signed-in user's personal wishlist.
- **FR-002**: A dedicated Wishlist page, reachable from the primary navigation, MUST list the user's wishlist items across all media types in a single view.
- **FR-003**: The Wishlist page MUST provide filters to scope the list, at minimum by media type.
- **FR-004**: Users MUST be able to remove items from their wishlist, after which the item no longer appears.
- **FR-005**: Adding an item already on the wishlist MUST NOT create a duplicate (idempotent), and the control MUST indicate the item is already saved.
- **FR-006**: A user's wishlist MUST be private — visible only to its owner.
- **FR-007**: From a wishlist item, the user MUST be able to start a "currently reading/listening" activity (reusing the feature-001 posting flow).

### Key Entities *(include if feature involves data)*

- **Wishlist Item**: A media item a user has saved for later. Attributes: the owner user, the media item (media type, title, creator, optional cover art, provider identifier), and when it was added. Private to the owner; unique per (owner, item).
- **Media Item (referenced)**: From feature 003 — sourced via the shared provider abstraction + cache when shown in Discover/search.
- **Activity Update (referenced)**: From feature 001 — a wishlist item can seed one.

## Success Criteria *(mandatory)*

- **SC-001**: A user can add an item (from search or Discover) to their wishlist in under 15 seconds and see it on the Wishlist page.
- **SC-002**: A user's wishlist is visible only to its owner (zero cross-user exposure in verification testing).
- **SC-003**: Applying a media-type filter shows only matching items in 100% of cases, and clearing restores the full list.
- **SC-004**: Removing an item removes it from the wishlist in 100% of cases.

## Assumptions

- **Builds on features 001, 002, 003**: Posting (001), the authenticated shell + Wishlist nav entry (002), and the media items surfaced by Discover/search via the provider abstraction (003) exist.
- **Wishlist is personal/private**: No sharing of wishlists in this feature.
- **All-media single page**: One Wishlist page spans all media types with filtering, rather than per-category wishlists.

## Dependencies

- Features 001 (posting), 002 (shell + Wishlist nav), 003 (media items via provider abstraction). Items are commonly added from search (feature 004) and Discover (003).
