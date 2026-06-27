# Data Model: Conversations (006)

## Extended entity: Activity (001)

`Activity` gains one optional field; everything else is unchanged.

| Field | Type    | Notes                                                          |
|-------|---------|----------------------------------------------------------------|
| note  | String? | optional author comment, plain text, ≤ NOTE_MAX_LENGTH (1000) |

- Shown with the update wherever it appears (feed, home, the author's own items).
- Set at post time via the existing `POST /api/activities` body (now accepts `note`).

## New entity: Reply

A message in an update's conversation. May be top-level (answers the update) or
nested (answers a parent reply). Authored by one user; visible to all authenticated
users; deletable only by its author.

| Field      | Type      | Notes                                                            |
|------------|-----------|------------------------------------------------------------------|
| id         | uuid (PK) | generated                                                        |
| activityId | uuid (FK) | → Activity.id, onDelete Cascade; the conversation it belongs to  |
| userId     | uuid (FK) | → UserProfile.id, onDelete Cascade; the author                   |
| parentId   | uuid? (FK)| → Reply.id (self), onDelete Cascade; `null` = top-level reply    |
| body       | String    | plain text, 1..REPLY_MAX_LENGTH (1000)                           |
| createdAt  | DateTime  | timestamptz, default now()                                       |
| deletedAt  | DateTime? | timestamptz; non-null = soft-deleted tombstone                   |

- **Deletion rule** (owner-only): a reply with **no children** is **hard-deleted**
  (row removed). A reply **with children** is **soft-deleted** (`deletedAt` set; body
  rendered as a "[deleted]" tombstone) so descendants keep context.
- **Cascade**: deleting the parent `Activity` (or a parent `Reply`) cascades to its
  replies — deleting an update removes its whole conversation (FR-012).
- **Indexes**: `(activityId, createdAt)` for thread listing; `(parentId)` for tree
  assembly / child lookups.
- **Prisma**: `@@map("reply")`, snake_cased columns; migration `add_conversations`
  (adds `note` to `activity`, creates `reply`).

## DTOs (`packages/shared`)

- Constants: `NOTE_MAX_LENGTH = 1000`, `REPLY_MAX_LENGTH = 1000`.
- `createActivitySchema` gains optional `note` (≤1000, plain text).
- `ActivityDTO` gains `note: string | null` and `replyCount: number` (non-deleted
  replies).
- `ReplyDTO { id, activityId, parentId: string | null, author: ActivityAuthorDTO,
  body: string, createdAt: string, deleted: boolean, canDelete: boolean }`
  — when `deleted` is true, `body` is `""` and the client renders a tombstone;
  `canDelete` is true only for the current user's own (non-deleted) replies.
- `ReplyThreadDTO { activityId: string, replies: ReplyDTO[], count: number }`
  — flat list (client builds the tree from `parentId`); `count` excludes deleted.
- `createReplySchema = { body: string(1..1000), parentId?: string | null }` (zod;
  `parentId`, if given, must reference a reply on the same activity).

## Referenced entities

- **UserProfile** (001) — the reply author (avatar/initials via `ActivityAuthorDTO`,
  reused from 002).
- **Activity** (001) — the update a conversation hangs off of; deleting it cascades
  to the conversation.
