# Feature Specification: Conversations (Update Comments & Replies)

**Feature Branch**: `006-conversations`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "Conversations on activity updates — (1) an optional author comment/note on an update when posting, shown with the update; (2) other users can reply to an update and reply to replies, forming Twitter-style threaded conversations; replies show author, text, relative time; visible to all authenticated users; users delete their own replies; plain-text only; rate-limited like posts. The previously-deferred 'comments on feed updates' feature. Out of scope: likes/reactions, edit-after-post, @mentions, notifications."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reply to an update (Priority: P1)

A signed-in user reads an activity update in the feed and replies to it with a
short message. Their reply appears in a conversation thread attached to that
update, showing the replier's avatar/initials, the reply text, and a relative
timestamp. All authenticated users viewing that update see the reply.

**Why this priority**: Replying is the core of this feature — it turns the feed
from broadcast-only into a conversation. It is independently demonstrable as soon
as one reply can be posted and seen.

**Independent Test**: As user A, reply to an update; as user B, open the same
update and verify A's reply appears in the thread with A's name/avatar and a
timestamp.

**Acceptance Scenarios**:

1. **Given** a signed-in user viewing an update, **When** they submit a reply, **Then** the reply appears in that update's conversation thread attributed to them, with their avatar/initials and a relative time.
2. **Given** an update with replies, **When** any authenticated user views it, **Then** they see the replies in conversation order.
3. **Given** a reply composer, **When** the user submits empty/whitespace-only text, **Then** the reply is rejected with a clear message and nothing is posted.
4. **Given** a user replying repeatedly, **When** they exceed the per-user rate limit, **Then** further replies are rejected with a friendly retry message until the limit window resets.
5. **Given** an update with no replies, **When** a user views it, **Then** they see an inviting prompt to start the conversation.

---

### User Story 2 - Reply within a thread (nested) (Priority: P2)

A user replies to an existing reply (not just the top-level update), building a
nested, Twitter-style conversation. Replies show their relationship to what they
answer, with nesting indicated visually up to a sensible depth.

**Why this priority**: Threaded back-and-forth makes conversations coherent, but
top-level replies (US1) already deliver value; nesting builds on it.

**Independent Test**: Reply to an update, then reply to that reply; verify the
second reply is shown as a response to the first within the same thread.

**Acceptance Scenarios**:

1. **Given** a reply in a thread, **When** a user replies to it, **Then** the new reply is associated with that parent reply and displayed within the same conversation, visually indicating it answers the parent.
2. **Given** a deeply nested exchange, **When** it is displayed, **Then** nesting is shown up to a sensible maximum indent, beyond which further replies continue without runaway indentation (the thread remains readable).

---

### User Story 3 - Add a note when posting an update (Priority: P2)

When posting a "currently reading/listening" update, the author can include an
optional free-text comment/note with their thoughts. The note is shown together
with the update wherever the update appears.

**Why this priority**: Lets authors add context to their updates; independent of
replies and valuable on its own, but the update itself works without it.

**Independent Test**: Post an update with a note; verify the note appears with the
update in the feed and the author's own items.

**Acceptance Scenarios**:

1. **Given** the update compose form, **When** the author adds a note and posts, **Then** the update shows the note alongside its media details.
2. **Given** the compose form, **When** the author leaves the note empty, **Then** the update posts normally without a note.
3. **Given** an over-length note, **When** the author submits, **Then** it is rejected with a clear message (length-limited).

---

### User Story 4 - Delete your own reply (Priority: P3)

A user removes a reply they posted; it disappears from the conversation for
everyone.

**Why this priority**: Important for user control, but the conversation works
before deletion exists.

**Independent Test**: Post a reply, delete it, and verify it no longer appears for
the author or other users.

**Acceptance Scenarios**:

1. **Given** a reply the user authored, **When** they delete it, **Then** it no longer appears in the thread for any user.
2. **Given** a reply authored by someone else, **When** a user views it, **Then** they have no option to delete it, and any direct attempt is rejected.
3. **Given** a reply that has nested child replies, **When** the author deletes it, **Then** the thread remains coherent (per the deletion rule in Assumptions).

---

### Edge Cases

- **Reply to a deleted update**: If an update is removed, its conversation is removed with it.
- **Plain-text safety**: All comment/reply text is rendered as plain text, never as markup.
- **Very long replies/notes**: Length-limited; over-limit input is rejected with a message.
- **Rapid replying (spam)**: Per-user rate limiting applies to replies as it does to posts.
- **Deleting a parent reply with children**: Handled per the chosen deletion rule (see Assumptions) so the thread stays readable.
- **Concurrent replies**: New replies appearing while viewing don't duplicate or reorder existing ones incoherently.
- **Empty thread**: An update with no replies shows an inviting "start the conversation" state.

## Requirements *(mandatory)*

### Functional Requirements

#### Update note (author comment)

- **FR-001**: The update compose form MUST allow an optional free-text note; updates MUST be postable with or without one.
- **FR-002**: An update's note MUST be displayed with the update wherever the update appears (feed, the author's own items).
- **FR-003**: The note MUST be length-limited, with over-limit input rejected with a clear message, and stored/rendered as plain text only.

#### Replies / threads

- **FR-004**: Authenticated users MUST be able to reply to an activity update with free-text content.
- **FR-005**: Users MUST be able to reply to an existing reply, forming a nested conversation; each reply records what it answers (an update or a parent reply).
- **FR-006**: A reply MUST display its author (avatar/initials), text, and a relative timestamp, and MUST be visible to all authenticated users viewing the update.
- **FR-007**: Replies MUST be presented as a conversation thread attached to their update, with nesting indicated up to a sensible maximum visual depth.
- **FR-008**: Reply content MUST be validated (non-empty, length-limited) and rejected with a clear message when invalid.
- **FR-009**: All reply/note text MUST be treated and rendered as plain text, never as executable markup.
- **FR-010**: Replies MUST be rate-limited per user (consistent with the posting limit) to protect against spam.
- **FR-011**: Users MUST be able to delete their own replies, after which the reply no longer appears for any user; users MUST NOT be able to delete others' replies.
- **FR-012**: Deleting an update MUST remove its entire conversation (all replies).
- **FR-013**: Each update SHOULD display a reply count (or equivalent affordance) so users can see there is a conversation.

### Key Entities *(include if feature involves data)*

- **Activity Update (extended)**: From feature 001; gains an optional **note** (author's free-text comment), length-limited, plain text.
- **Reply**: A message in a conversation. Attributes: the authoring user, the target it answers (an update or a parent reply), the text, and when it was posted. Belongs to exactly one update's conversation; may have a parent reply (nested). A user may delete their own.
- **User Profile (referenced)**: From feature 001 — identifies reply/note authors (shown as avatar/initials).

## Success Criteria *(mandatory)*

- **SC-001**: A signed-in user can post a reply to an update and see it in the thread within 3 seconds.
- **SC-002**: A reply posted by one user is visible to another user viewing the same update.
- **SC-003**: 100% of attempts to delete another user's reply are rejected; deleting one's own reply removes it for everyone in 100% of cases.
- **SC-004**: 100% of comment/reply text containing markup-like characters renders as literal text (never executed).
- **SC-005**: Nested replies remain readable — visual indentation stops at the defined maximum depth (no runaway indentation), verified at depth beyond the cap.
- **SC-006**: An author can add a note to an update and it appears with that update in 100% of cases.
- **SC-007**: Per-user reply rate limiting rejects replies beyond the limit and resumes after the window, matching the posting limit.

## Assumptions

- **Builds on features 001 + 002**: Activities, profiles, auth, the feed, and the home/feed UI exist and are reused. The avatar/initials display (feature 002) is reused for reply authors.
- **Rate limit**: Replies use the same per-user rate (10/minute) as posts, for consistency.
- **Nesting depth**: Replies may nest arbitrarily in data, but visual indentation caps at a sensible depth (e.g., a few levels); deeper replies render at the cap to keep threads readable.
- **Deletion rule for parents with children**: Deleting a reply that has child replies removes the reply's content but preserves the thread's coherence — a tombstone/"deleted" placeholder is shown so child replies retain context (rather than cascading-deleting the children). The exact presentation is a design detail for planning.
- **Lengths**: Notes and replies are length-limited with sensible maximums (defined during planning), consistent with the existing title/author limits.
- **Out of scope**: likes/reactions, editing after posting, @mentions, and notifications.

## Dependencies

- Features 001 (activities, profiles, auth, posting/rate-limit) and 002 (feed/home UI, avatar display).
