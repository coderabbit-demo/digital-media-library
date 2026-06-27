# Research: Conversations (006)

## 1. Note on an update (author comment)

**Decision**: Add an optional `note String?` to the existing `Activity` model
(plain text, `NOTE_MAX_LENGTH = 1000`) rather than a separate entity. The
`POST /api/activities` body gains an optional `note`, and `ActivityDTO` gains
`note: string | null`, surfaced wherever the update appears (feed, home, the
author's own items).

**Rationale**: The note is 1:1 with the update and authored by the same user at
post time — a column on `Activity` is the simplest faithful model and keeps the
update + its note atomic. Reuses the 001 posting path; no new endpoint.

## 2. Replies & nesting (data vs. presentation)

**Decision**: A single `Reply` model with a **self-referential nullable
`parentId`** (`null` = top-level reply, otherwise the reply it answers). Replies
nest **arbitrarily in data**. `GET …/replies` returns a **flat list**
(`ReplyThreadDTO.replies`), and the **client builds the tree** from `parentId`.

**Rationale**: A flat list with `parentId` is the simplest shape that supports
arbitrary nesting without recursive queries or adjacency-list gymnastics on the
server; the client already needs to lay out the thread, so it owns tree assembly.
Ordering is by `createdAt` within the `(activityId, createdAt)` index.

## 3. Nesting depth (capped indentation)

**Decision**: Nesting is unbounded in storage; the **UI caps visual indentation**
at a sensible depth (e.g. 4 levels). Replies deeper than the cap render at the cap
(no further indent), keeping the thread readable (SC-005).

**Rationale**: Preserving full ancestry in data keeps deletion/tombstone logic and
context intact, while the visual cap prevents runaway indentation on mobile. The
cap is a pure presentation concern — no data is lost.

## 4. Deletion rule (hard delete vs. tombstone)

**Decision**: Deleting a reply is **owner-only**:

- **No children** → **hard delete** (row removed; the reply disappears).
- **Has children** → **soft delete** — set `deletedAt`, keep the row, and render the
  body as a **"[deleted]" tombstone** so child replies keep their context.

In DTOs, a soft-deleted reply has `deleted: true` and `body: ""`; the client shows
a tombstone. `ReplyThreadDTO.count` **excludes** deleted replies.

**Rationale**: Cascading-deleting children would erase others' replies and break the
thread; a tombstone keeps descendants coherent (FR-011, spec Assumptions). Hard
delete for childless replies keeps the common case clean. Deleting the **update**
still removes the entire conversation via `onDelete: Cascade` (FR-012).

## 5. Rate limiting

**Decision**: Reply creation uses the **same per-user 10/min limiter** as posts,
with a **separate counter bucket** for replies. Over-limit requests get **429** with
a `Retry-After` header.

**Rationale**: Consistency with the posting limit (spec Assumptions, FR-010, SC-007)
while keeping replies and posts independently throttled, so a burst of replies does
not block posting and vice versa.

## 6. Plain-text safety

**Decision**: Notes and reply bodies are **stored and rendered as plain text** only;
the frontend never interprets them as markup (FR-009, SC-004). Validation: notes
≤1000; replies 1..1000 (non-empty after trimming whitespace).

## 7. Reply count

**Decision**: `ActivityDTO.replyCount: number` is the count of **non-deleted**
replies for the update, computed server-side. Shown on the card as an affordance to
expand the conversation (FR-013). Tombstoned replies are excluded from the count but
still rendered in the thread for context.

## 8. Visibility & ownership

**Decision**: All routes require the 001 session cookie. Listing a thread is visible
to **all authenticated users** (FR-006). Create attributes the reply to
`currentUser.id`. Delete is **owner-only**: a non-owner attempt is rejected
(403/404), satisfying SC-003.

## 9. Migration

**Decision**: Migration `add_conversations` adds the `note` column to `activity` and
creates the `reply` table with FKs (`activityId`, `userId`, `parentId`) all
`onDelete: Cascade`, plus indexes `(activityId, createdAt)` and `(parentId)`. No data
backfill needed (`note` defaults to null; no prior replies).

## 10. Secrets

None. Conversations are local-only; no external providers.
