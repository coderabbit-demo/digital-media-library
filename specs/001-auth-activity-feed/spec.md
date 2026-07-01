# Feature Specification: Authentication & Activity Feed

**Feature Branch**: `001-auth-activity-feed`

**Created**: 2026-06-26

**Status**: Implemented

**Input**: User description: "Google account login/registration plus a Goodreads-style activity feed. Authenticated users sign in with their Google account; on first sign-in a profile is created. The home page shows a feed of activity updates describing what users are currently reading or listening to (books, music, audiobooks). Users can post their own 'currently reading/listening' activity updates and see updates from others. Scope: authentication and the activity feed only. Out of scope for this feature (planned later): trending-content discovery from external providers, and commenting on feed updates."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with Google and get a profile (Priority: P1)

A new visitor lands on the site and chooses to sign in with their Google account.
After granting consent, they are signed in. If this is their first time, a profile
is automatically created for them using basic information from their Google
account (display name and avatar). Returning users are recognized and signed back
into their existing profile.

**Why this priority**: Identity is the foundation of the product. Without sign-in
and a profile, no personalized feed, no attribution of activity, and no social
experience is possible. This is the minimum that delivers standalone value
(a user can establish a presence in the system).

**Independent Test**: Can be fully tested by signing in with a Google account on a
clean system (verifying a new profile is created), signing out, and signing in
again (verifying the same profile is reused and no duplicate is created).

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor with no existing profile, **When** they sign in with Google and grant consent, **Then** a new profile is created from their Google display name and avatar and they land authenticated on the home page.
2. **Given** a returning user who previously signed in, **When** they sign in with Google again, **Then** they are matched to their existing profile and no duplicate profile is created.
3. **Given** a visitor on the Google consent screen, **When** they decline consent or cancel, **Then** they are returned to the site unauthenticated with a clear message and no profile is created.
4. **Given** an authenticated user, **When** they sign out, **Then** their session ends and protected content is no longer accessible until they sign in again.

---

### User Story 2 - View the activity feed (Priority: P1)

An authenticated user opens the home page and sees a feed of recent activity
updates from users, each showing who is reading or listening to what (book, music,
or audiobook), with the item title, the media type, and how recently it was
posted. The feed is ordered with the most recent activity first.

**Why this priority**: The feed is the core home-page experience and the reason
users return. Combined with sign-in it forms the viable MVP: a user can sign in
and immediately see what the community is engaging with.

**Independent Test**: Can be tested by seeding several activity updates from
different users, loading the home page as an authenticated user, and verifying the
updates appear newest-first with author, media type, and item title.

**Acceptance Scenarios**:

1. **Given** activity updates exist from multiple users, **When** an authenticated user opens the home page, **Then** they see those updates ordered most-recent-first, each showing author, media type (book/music/audiobook), item title, and a relative timestamp.
2. **Given** no activity updates exist yet, **When** a user opens the home page, **Then** they see an empty-state message inviting them to post their first update.
3. **Given** a feed with more updates than fit on one page, **When** the user reaches the end of the loaded updates, **Then** older updates can be loaded without losing their place.
4. **Given** an unauthenticated visitor, **When** they attempt to open the home feed, **Then** they are prompted to sign in before the feed is shown.

---

### User Story 3 - Post & delete a "currently reading/listening" update (Priority: P2)

An authenticated user posts an activity update stating what they are currently
reading or listening to. They specify the media type (book, music, or audiobook)
and the item (title, and where known an author/artist). Once posted, the update
appears at the top of the feed attributed to them and is visible to other users.

**Why this priority**: Posting is what populates the feed, but the feed and
sign-in can be demonstrated with seeded data first; user-generated posting builds
directly on top of P1 and turns the experience from read-only into participatory.

**Independent Test**: Can be tested by signing in, posting an update with a chosen
media type and title, and verifying it appears at the top of the feed attributed
to the posting user and is visible to a second user's feed.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they post an update with a media type and item title, **Then** the update is saved, attributed to them, and appears at the top of the feed.
2. **Given** an authenticated user composing an update, **When** they submit without a media type or without an item title, **Then** the update is rejected with a clear validation message and nothing is posted.
3. **Given** a user has posted an update, **When** another user loads the feed, **Then** that update is visible to them attributed to its author.
4. **Given** a user viewing their own update in the feed, **When** they choose to remove it, **Then** it is deleted and no longer appears in any user's feed.

---

### Edge Cases

- **Google account with no profile photo or name**: A profile is still created; a default display name and placeholder avatar are used.
- **Revoked or expired Google consent**: The user is treated as unauthenticated and prompted to sign in again; no partial/duplicate profile results.
- **Email already associated with a profile**: The user is matched to the single existing profile rather than creating a second one.
- **Very long item titles or author names**: Input is length-limited and safely truncated for display; over-limit input is rejected with a message.
- **Activity content with HTML/script-like text**: User-provided text is treated as plain text and never rendered as markup.
- **Rapid repeated posting (spam)**: The system limits a single user to no more than 10 posts per minute to protect feed quality; excess posts are rejected with a clear message until the limit resets.
- **A user deletes their account / is removed**: Their activity updates no longer appear in the feed.
- **Concurrent feed loads while new updates arrive**: Pagination remains stable and does not show duplicates or skip items.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & Profile

- **FR-001**: System MUST allow visitors to sign in and register using their Google account; no separate username/password registration is offered.
- **FR-002**: System MUST create a profile automatically on a user's first successful sign-in, populated from their Google display name and avatar.
- **FR-003**: System MUST match a returning user to their existing profile on subsequent sign-ins and MUST NOT create duplicate profiles for the same Google identity.
- **FR-004**: System MUST allow authenticated users to sign out, ending their session.
- **FR-005**: System MUST restrict the activity feed and posting to authenticated users, prompting unauthenticated visitors to sign in.
- **FR-006**: System MUST handle declined or failed Google consent gracefully, leaving the visitor unauthenticated with a clear message and no profile created.
- **FR-007**: System MUST store only the minimum profile information needed for the feature — a stable account identifier, display name, avatar reference, and email address (for contact/display) — and no more.

#### Activity Feed

- **FR-008**: System MUST present a home-page feed of activity updates ordered most-recent-first.
- **FR-009**: Each feed update MUST display the author, the media type (book, music, or audiobook), the item title, and a relative timestamp.
- **FR-010**: System MUST show an inviting empty state when no activity updates exist.
- **FR-011**: System MUST allow users to load older updates beyond the initial page without losing their place and without showing duplicates.
- **FR-012**: System MUST make each user's activity updates visible to all other authenticated users in the feed.

#### Posting & Managing Updates

- **FR-013**: Users MUST be able to post an activity update specifying a media type (book, music, or audiobook) and an item title, with an optional author/artist.
- **FR-014**: System MUST validate that a media type and item title are present before accepting an update, rejecting invalid submissions with a clear message.
- **FR-015**: System MUST attribute each posted update to the authoring user and timestamp it.
- **FR-016**: Users MUST be able to delete their own activity updates, after which the update no longer appears in any feed.
- **FR-017**: System MUST prevent a user from deleting or altering another user's activity updates.
- **FR-018**: System MUST treat all user-provided text as plain text and never render it as executable markup.
- **FR-019**: System MUST limit a single user to at most 10 activity posts per minute to protect feed quality against spam, rejecting further posts with a clear message (and a retry indication) until the limit window resets.

### Key Entities *(include if feature involves data)*

- **User Profile**: Represents a person who has signed in. Key attributes: a stable account identifier tied to their Google identity, display name, avatar reference, and the date the profile was created. One profile per Google identity.
- **Activity Update**: Represents a single "currently reading/listening" post. Key attributes: the authoring user, media type (book / music / audiobook), item title, optional author/artist, and the time it was posted. Belongs to exactly one User Profile.
- **Media Item (referenced)**: The thing being read or listened to, described by a media type, a title, and optionally an author/artist. In this feature it is captured as descriptive attributes of an Activity Update rather than a catalog entry; a catalog of trending content is a future feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from landing on the site to a created profile and a visible home feed in under 60 seconds using only their Google account.
- **SC-002**: 95% of sign-in attempts that complete Google consent result in the user reaching their feed without error.
- **SC-003**: No duplicate profiles are created for the same Google identity across repeated sign-ins (0 duplicates in verification testing).
- **SC-004**: An authenticated user can post an activity update and see it at the top of their feed within 3 seconds of submitting.
- **SC-005**: The home feed presents its initial set of updates within 2 seconds for a typical user under normal load.
- **SC-006**: 100% of attempts by a user to delete or modify another user's update are rejected.
- **SC-007**: The system sustains its target launch load of ~100 concurrent active users without feed load times degrading beyond the SC-005 threshold (initial feed page within 2 seconds).

## Assumptions

- **Web SPA, modern browsers**: The experience targets current desktop and mobile web browsers; native mobile apps are out of scope for this feature.
- **Google as the sole identity provider for v1**: All users authenticate via Google accounts; other providers (email/password, other social logins) are out of scope.
- **Profile editing is minimal**: Beyond what is auto-populated from Google, in-app profile editing is not required for this feature.
- **No following/friends graph yet**: The feed shows activity from all users (a global feed); a per-user follow graph is a future enhancement.
- **Item details are user-entered**: Because trending/catalog integration is a later feature, media titles and authors/artists are captured as free text rather than validated against an external catalog.
- **Comments and trending discovery are explicitly out of scope** and will be specified as separate features.
- **Standard data-retention and privacy practices** appropriate to a consumer social web app apply; specific legal/compliance obligations are assumed standard unless raised during planning.
