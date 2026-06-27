# Tasks: Conversations (006)

## Phase 1: Setup & Foundational

- [X] T001 Add `note String?` to `Activity` + new `Reply` model (self-FK `parentId`, FKs cascade, `deletedAt`, indexes `(activityId, createdAt)` and `(parentId)`) in backend/prisma/schema.prisma + migration `add_conversations`
- [X] T002 [P] Add `NOTE_MAX_LENGTH`/`REPLY_MAX_LENGTH` (1000), `note` on `createActivitySchema`, `note`+`replyCount` on `ActivityDTO`, `ReplyDTO`, `ReplyThreadDTO`, `createReplySchema` to packages/shared/src/index.ts

## Phase 2: User Story 1 — Reply to an update & see the thread (P1)

- [X] T010 [US1] ReplyService (create top-level reply / list thread as flat list with `count` + per-row `canDelete` / non-deleted `replyCount`) in backend/src/services/replies.ts
- [X] T011 [US1] POST + GET /api/activities/:id/replies with per-user 10/min rate limit on create (separate bucket from posts, 429 + `Retry-After`), non-empty + length validation, unknown-activity 404 in backend/src/api/replies.ts
- [X] T012 [US1] Wire ReplyService into context + app.ts; include `replyCount` in feed/home/activity DTOs (backend/src/services/activities.ts, home.ts)
- [X] T013 [P] [US1] useReplies / usePostReply + cache keys (frontend/src/services/replies.ts)
- [X] T014 [P] [US1] ActivityCard: reply count + expandable thread with a top-level reply box and empty "start the conversation" state; ReplyThread component renders the flat list (frontend/src/components/ActivityCard.tsx, ReplyThread.tsx)
- [X] T015 [US1] Tests: backend unit (ReplyService) + contract (create/list/validation/visibility/rate-limit), shared schema, frontend (thread + post reply)

## Phase 3: User Story 2 — Nested replies (P2)

- [X] T020 [US2] Accept `parentId` on create; validate it belongs to the same activity (404 otherwise) in backend/src/services/replies.ts + api/replies.ts + test
- [X] T021 [P] [US2] ReplyThread builds the tree from `parentId`, renders nested replies with per-reply "Reply", and caps visual indentation at 4 levels (deeper at the cap) (frontend/src/components/ReplyThread.tsx) + test

## Phase 4: User Story 3 — Note on an update (P2)

- [X] T030 [US3] Activities create accepts optional `note` (validated ≤1000, plain text); `note` surfaced in feed/home/activity DTOs (backend/src/services/activities.ts, home.ts)
- [X] T031 [P] [US3] PostUpdateForm optional note field; ActivityCard renders the note alongside media details (frontend/src/components/PostUpdateForm.tsx, ActivityCard.tsx) + test

## Phase 5: User Story 4 — Delete your own reply (P3)

- [X] T040 [US4] Owner-only DELETE /api/replies/:id — hard delete when childless, soft delete (`deletedAt` tombstone) when it has children; 403/404 for non-owner/unknown; tombstone excluded from `count`/`replyCount` (backend/src/services/replies.ts, api/replies.ts)
- [X] T041 [P] [US4] useDeleteReply; ActivityCard/ReplyThread show a delete control on own replies (`canDelete`) and render "[deleted]" tombstones (frontend/src/services/replies.ts, ReplyThread.tsx) + test
- [X] T042 [US4] Tests: delete childless (hard) / with-children (tombstone) / non-owner rejected / deleting update cascades the conversation

## Phase 6: Polish

- [X] T050 [P] Update README.md, AGENTS.md
- [X] T051 Run gates + live verify (lint, build, unit + contract tests, quickstart walkthrough)

## MVP

User Story 1 (reply to an update, see the thread, rate-limited, plain text) is the MVP.
