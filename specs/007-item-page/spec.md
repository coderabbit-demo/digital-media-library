# Feature Specification: Item Detail Page

**Feature Branch**: `007-item-page`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "Goodreads-style item detail page. A dedicated, deep-linkable page for a single media item (book, music, audiobook, or podcast) reached by clicking an item's cover or title from Discover, Search, My Library, and feed activity cards … community sections computed from our own database … Out of scope: separate long-form reviews, multiple editions, external purchase links, providers requiring user-auth or API keys."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View an item's detail page (Priority: P1)

A signed-in user clicks an item's cover or title anywhere it appears (Discover, Search, My Library, a feed activity card) and lands on a dedicated page for that item showing its cover, title, creator, media type, full synopsis, and genres. The page has a stable address, so refreshing it or sharing the link reopens the same item. Returning to the previous list (via the browser back button) restores that list's prior state — in particular, Search results and the query remain intact rather than being cleared.

**Why this priority**: This is the core of the feature — a single canonical place to learn about an item. Without it, none of the other stories have a home. It delivers value on its own: richer detail than a card can hold, and a shareable/bookmarkable destination.

**Independent Test**: Navigate to an item page from a Discover card and from a direct URL (fresh load); confirm the item's cover, title, creator, media badge, expandable synopsis, and genres render, an unknown item id shows a graceful "not found" state, and that navigating back from an item opened via Search returns to the populated results.

**Acceptance Scenarios**:

1. **Given** a trending item on Discover, **When** the user clicks its cover or title, **Then** the item detail page for that item opens at its own URL.
2. **Given** an item detail page URL, **When** the user loads it directly (or refreshes), **Then** the same item's details render without requiring prior navigation.
3. **Given** a long synopsis, **When** the page renders, **Then** it is truncated with a "show more"/"show less" control that expands and collapses the full text.
4. **Given** an item whose provider supplies genres, **When** the page renders, **Then** the genres are listed; **and** when the provider supplies none, the genres area is omitted (no empty label).
5. **Given** an item id that no provider can resolve, **When** the page loads, **Then** a clear "we couldn't find this item" state is shown with a way back to browsing.
6. **Given** a user who searched and opened an item from the results, **When** they press the browser back button, **Then** the search results and the entered query are still displayed (not reset to an empty search page).

---

### User Story 2 - Act on the item from its page (Priority: P1)

From the item page, the signed-in user can manage the item exactly as they can from a card: place or move it on a shelf (Want to Read/Listen, Currently Reading/Listening, Read/Listened, Did Not Finish), mark "I'm reading/listening to this" (which shelves it as currently reading and offers to share an update), recommend it, and rate it 1–5 stars (clicking the current rating again clears it). The controls reflect the user's existing state for the item.

**Why this priority**: A detail page that can't act on the item forces users back to cards for every action. Parity with the existing card controls is essential for the page to replace the card as the item's home, and it reuses already-shipped behavior (shelves 005, recommend 004, ratings 001).

**Independent Test**: On an item page, set a shelf and confirm it appears on that shelf in My Library; rate the item and confirm the rating persists on reload; recommend it and confirm it appears in recommendations — each verified against the signed-in user only.

**Acceptance Scenarios**:

1. **Given** an item not yet on a shelf, **When** the user picks a shelf, **Then** the item is added to that shelf and the control reflects the new shelf.
2. **Given** an item on a shelf, **When** the user chooses "Currently Reading/Listening" (via the shelf control or the dedicated action), **Then** the item moves to that shelf and the user is offered the option to share an update.
3. **Given** an item, **When** the user selects a star rating, **Then** the rating is saved for that user; **and** when they click the same star again, **Then** the rating is cleared.
4. **Given** an item the user has already recommended, **When** the page renders, **Then** the recommend control shows it as already recommended.
5. **Given** two different users, **When** each rates or shelves the same item, **Then** each user's actions affect only their own state.

---

### User Story 3 - See community context for the item (Priority: P2)

On the item page, the user sees aggregate context drawn from the community: the average rating and the number of ratings, how many users hold the item on each shelf (e.g., "N currently reading", "N want to read"), and a list of recent activity about the item (recent feed updates/notes referencing it, each showing who and when).

**Why this priority**: Community signals are what make the page feel alive and aid decisions, but the page is already useful (P1) without them. They layer social proof on top of the core detail + actions.

**Independent Test**: Seed ratings, shelf placements, and feed activity for an item across multiple users; open the page and confirm the average rating, rating count, per-shelf counts, and recent-activity list match the seeded data; confirm an item with no community data shows sensible "no ratings yet"/"no activity yet" states.

**Acceptance Scenarios**:

1. **Given** an item with ratings from several users, **When** the page renders, **Then** it shows the average rating (one decimal) and the total number of ratings.
2. **Given** an item held on shelves by several users, **When** the page renders, **Then** it shows the count of users per shelf.
3. **Given** an item referenced by recent feed updates, **When** the page renders, **Then** it lists recent activity (author and relative time), newest first, capped to a reasonable number.
4. **Given** an item with no ratings/activity, **When** the page renders, **Then** community sections show empty states rather than zeros presented as data or broken sections.

---

### Edge Cases

- **Unknown or unresolvable item id**: page shows a "not found" state, not a crash or infinite spinner.
- **Provider temporarily unavailable**: if details can't be fetched but the item is otherwise known, show what is available and a retry affordance; community sections (from our own data) should still render.
- **Missing fields**: no cover (show placeholder), no creator, no synopsis, no genres — each omitted area degrades gracefully.
- **Re-clicked rating**: re-clicking the active star clears the rating (consistent with existing behavior).
- **Self vs others in counts**: shelf/rating counts include the signed-in user's own contribution; the user's personal controls still reflect their own state.
- **Untrusted text**: all provider- and user-sourced text (title, synopsis, notes) renders as plain text, never markup.
- **Deleted/aged activity**: recent activity reflects current feed state (deleted updates do not appear).
- **Back navigation from Search**: returning from an item to the Search page preserves the prior query and results; navigating back from Discover/My Library likewise restores those lists.
- **Stale community data**: counts may be eventually consistent within a short window; they need not be transactionally exact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated item detail page addressed by a stable identifier composed of media type and provider id, such that loading the address directly (or refreshing) renders the same item.
- **FR-002**: The system MUST make an item's cover or title actionable (navigating to its detail page) wherever items are listed: Discover, Search, My Library, and feed activity cards.
- **FR-003**: The system MUST retrieve item details (title, creator, cover, synopsis, genres when available, provider link, and any series/edition label the provider offers) through the existing internal provider abstraction, reusing keyless providers, and MUST cache provider responses with stale-fallback behavior.
- **FR-004**: The page MUST display the cover (or a placeholder when absent), title, creator, a media-type badge, the synopsis with an expand/collapse control when long, and genre tags when present.
- **FR-005**: The page MUST present the same item controls available on cards: a shelf selector across all four shelves, an "I'm reading/listening to this" action that shelves the item as currently reading and offers to share an update, a recommend action, and a 1–5 star rating control where re-selecting the active rating clears it.
- **FR-006**: All personal controls (shelf, rating, recommend) MUST operate only on the signed-in user's own data and MUST reflect that user's current state for the item on load.
- **FR-007**: The page MUST show the item's average rating and total rating count computed from stored ratings, with an explicit empty state when there are none.
- **FR-008**: The page MUST show, per shelf, the number of distinct users who hold the item on that shelf.
- **FR-009**: The page MUST show a list of recent feed activity referencing the item (author identity and relative time), newest first, limited to a reasonable maximum, reflecting current (non-deleted) activity, with an empty state when there is none.
- **FR-010**: The page MUST be accessible only to authenticated users, consistent with the rest of the application.
- **FR-011**: All provider- and user-sourced text MUST render as plain text (never interpreted as markup).
- **FR-012**: The page MUST degrade gracefully on missing fields, unknown item ids (not-found state), and provider errors (retry affordance while still rendering community data from our own database).
- **FR-013**: The page MUST link out to the item's external provider page when a valid link is available (existing provider URL only; no new purchase/affiliate links).
- **FR-014**: Navigating back from an item detail page MUST restore the originating list's prior state; specifically, the Search page MUST retain its entered query and results rather than resetting to an empty state.

### Key Entities *(include if feature involves data)*

- **Item detail**: the canonical view of a single media item identified by media type + provider id; attributes include title, creator, cover, synopsis, genres, provider link, and optional series/edition label. Sourced from providers (cached), not stored as a first-class owned record.
- **Rating aggregate**: derived from existing per-user ratings for an item — average and count.
- **Shelf aggregate**: derived from existing My Library shelf placements — distinct-user count per shelf for an item.
- **Recent activity**: derived from existing feed activities/notes that reference the item — author, timestamp, and the update/note text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any list (Discover, Search, My Library, feed), a user can open an item's detail page in a single click, and 100% of opened pages render the item's core details (cover/placeholder, title, creator, media type).
- **SC-002**: A directly loaded item page URL (cold load/refresh) renders the same item without prior in-app navigation in at least 95% of loads where the item is resolvable.
- **SC-003**: Every personal action available on a card (shelf, currently-reading, recommend, rate) is available and functional on the item page, verified to affect only the acting user.
- **SC-004**: Community sections (average rating + count, per-shelf counts, recent activity) match the underlying seeded data in tests, and each renders a clear empty state when no data exists.
- **SC-005**: The item page reaches an interactive state quickly on a warm cache (item detail served from cache), and never blocks community sections on a provider outage.
- **SC-006**: No provider- or user-sourced text is ever rendered as markup (verified with an injection-style payload in tests).
- **SC-007**: After opening an item from a search and pressing back, the search query and results are still present in at least 99% of such navigations.

## Assumptions

- The item is identified by `mediaType` + `providerId`, matching the identifiers already used across Discover, Search, My Library, ratings, and recommendations.
- Existing systems are reused: ratings (001), recommendations (004), My Library shelves (005), feed activities and notes (006), and the provider abstraction with caching (003). No new provider requiring user-auth or API keys is introduced.
- "Recent activity referencing the item" is matched via the item identity already stored on activities (media type + provider id); it reflects current, non-deleted feed state and is capped (default ~10 most recent).
- Community counts are aggregate and may be eventually consistent within a short caching window; they are not required to be transactionally exact at read time.
- Average rating is displayed to one decimal place; rating count is a whole number.
- The page is authenticated-only, consistent with the rest of the app; there is no public/unauthenticated view in this feature.
- Back-navigation state preservation relies on standard client navigation/caching of already-fetched list data; Search retains its query and results when the user returns from an item.
- Series/edition metadata is shown only when a provider supplies it; the feature does not add edition switching.
- Mobile/responsive layout follows the existing app conventions; this spec does not introduce a new design system.
