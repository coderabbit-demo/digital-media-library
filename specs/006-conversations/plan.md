# Implementation Plan: Conversations (006)

## Summary

Turns the broadcast-only feed into a conversation: an optional author **note** on
an update when posting, plus **replies** to updates — including **nested**,
Twitter-style threads (reply to a reply). Replies show author (avatar/initials),
plain text, and a relative time, are visible to all authenticated users,
**rate-limited like posts** (10/min), and length-limited. Authors can **delete
their own reply** (hard delete when it has no children, tombstone "[deleted]" when
it does, to keep the thread coherent). Deleting an update removes its whole
conversation. Each update shows a **reply count**. Builds on shipped 001
(activities, profiles, auth, posting/rate-limit) and 002 (feed/home UI, avatar
display). Local-data feature — no external providers.

## Technical Context

- **Stack**: unchanged (React/Vite MD3, Fastify/Node 22, Prisma/CloudSQL, Redis).
- **No external providers, no new secrets.** Replies and notes are local data.
- **Rate limit**: reuses the existing per-user 10/min limiter pattern from posts
  (a separate counter bucket for replies is fine).

## Constitution Check

- **I (auth)**: every route requires the 001 session cookie; create/list/delete
  are authenticated. Delete is owner-only. PASS.
- **II (plain text)**: notes and reply bodies are stored and rendered as plain
  text only, never as executable markup (FR-009, SC-004). PASS.
- **V (stateless)**: notes and replies persist in PostgreSQL; the rate limiter
  uses Redis as posts do. PASS.
- **III**: no provider calls in this feature (local data only). N/A.

## Data model

- **`Activity` gains `note String?`** — optional author comment, plain text,
  length-limited (`NOTE_MAX_LENGTH = 1000`). Shown with the update everywhere it
  appears (feed, home, the author's own items).
- **New `Reply`** (table `reply`): `id` (uuid PK), `activityId` (FK → Activity,
  onDelete Cascade — deleting the update removes the conversation), `userId`
  (FK → UserProfile, onDelete Cascade; the author), `parentId` (self-FK nullable,
  onDelete Cascade; `null` = top-level reply), `body` (String, plain text,
  1..`REPLY_MAX_LENGTH` = 1000), `createdAt` (timestamptz), `deletedAt`
  (timestamptz nullable — tombstone). Indexes: `(activityId, createdAt)`,
  `(parentId)`.
- **Deletion rule** (owner-only): deleting a reply with **no children** → **hard
  delete** (disappears). Deleting a reply **with children** → **soft delete** (set
  `deletedAt`; body shown as a "[deleted]" tombstone) so the thread stays coherent.
- **Migration `add_conversations`**: adds `note` to `activity` and creates the
  `reply` table.

## API

All routes require the 001 session cookie; text is plain text.

- `POST /api/activities/{id}/replies` — create a reply. Auth + **rate limit**
  10/min (same as posts); validate non-empty + length; if `parentId` is given it
  MUST belong to the same activity. 201 → `ReplyDTO`. 400 invalid; 404 unknown
  activity/parent; 429 rate limited (`Retry-After`).
- `GET /api/activities/{id}/replies` — the conversation (`ReplyThreadDTO`), visible
  to all authenticated users.
- `DELETE /api/replies/{id}` — delete your own reply (204; owner-only → 403/404
  otherwise; tombstone if it has children, else hard delete).
- The existing `POST /api/activities` body **gains optional `note`**; the
  feed/home/activity responses now include `note` and `replyCount`.

## DTOs (`packages/shared`)

- `NOTE_MAX_LENGTH = 1000`, `REPLY_MAX_LENGTH = 1000`.
- `createActivitySchema` gains optional `note` (≤1000, plain text).
- `ActivityDTO` gains `note: string | null` and `replyCount: number`.
- `ReplyDTO { id, activityId, parentId: string|null, author: ActivityAuthorDTO,
  body, createdAt, deleted: boolean, canDelete: boolean }` (when `deleted`, `body`
  is `""` and the client renders a tombstone).
- `ReplyThreadDTO { activityId, replies: ReplyDTO[], count }` — flat list (the
  client builds the tree from `parentId`); `count` excludes deleted.
- `createReplySchema = { body: string(1..1000), parentId?: string|null }`.

## Nesting

Replies may nest arbitrarily in data. The API returns a **flat list**; the client
builds the tree from `parentId` and **caps visual indentation** at a sensible depth
(e.g. 4 levels), rendering deeper replies at the cap (no runaway indentation).

## Rate limit

Replies use a per-user **10/min** limiter consistent with posts (a separate counter
bucket from posts is fine). Over-limit requests get 429 with `Retry-After`.

## Frontend (describe; implement during tasks)

- **PostUpdateForm / compose** gains an optional **note** field (≤1000, plain text),
  passed through as `note` on `POST /api/activities`.
- **ActivityCard** shows the **note** (when present), a **reply count**, and an
  **expandable conversation thread** with:
  - a reply box (top-level and per-reply "Reply"),
  - **nested rendering** with capped visual indentation (deeper replies at the cap),
  - a **delete** control on the user's own replies (`canDelete`), and tombstone
    "[deleted]" rendering for soft-deleted parents,
  - an inviting "start the conversation" empty state.

## Project Structure (new/changed)

```
packages/shared/src/index.ts        # NOTE_MAX_LENGTH, REPLY_MAX_LENGTH; createActivitySchema +note; ActivityDTO +note +replyCount; ReplyDTO, ReplyThreadDTO, createReplySchema
backend/prisma/schema.prisma        # Activity +note; + model Reply (migration add_conversations)
backend/src/services/replies.ts     # ReplyService (create / list thread / delete own w/ tombstone rule / count)
backend/src/api/replies.ts          # POST+GET /api/activities/:id/replies, DELETE /api/replies/:id (rate limit on create)
backend/src/services/activities.ts  # accept optional note on create; include note + replyCount in DTOs
backend/src/services/home.ts        # feed/home items carry note + replyCount
frontend/src/components/PostUpdateForm.tsx   # optional note field
frontend/src/components/ActivityCard.tsx     # note + reply count + expandable thread (nested, capped indent) + delete
frontend/src/components/ReplyThread.tsx      # thread tree, reply box, tombstones, capped indent
frontend/src/services/replies.ts             # useReplies / usePostReply / useDeleteReply + cache keys
```

## Phases

- **Phase 0–1**: research.md, data-model.md, contracts/openapi.yaml, quickstart.md (done).
- **Phase 2**: tasks.md, then implement.
