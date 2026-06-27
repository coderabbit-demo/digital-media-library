# Quickstart: Conversations (006)

## Prerequisites

- Features 001–005 running locally (`pnpm dev`), signed in. No new env, no secrets.

## Apply the migration

```bash
corepack pnpm -C backend exec prisma migrate dev --name add_conversations
```

This adds the `note` column to `activity` and creates the `reply` table (FKs on
`activityId`, `userId`, `parentId`, all cascade-on-delete; indexes on
`(activityId, createdAt)` and `(parentId)`).

## Manual validation

1. **Reply to an update (US1)**: As user A, post/open an update and submit a reply →
   it appears in the thread with A's avatar/initials, text, and a relative time. As
   user B, open the same update → A's reply is visible.
2. **Empty/whitespace (US1)**: Submit an empty or whitespace-only reply → rejected
   with a clear message; nothing posted.
3. **Rate limit (US1)**: Post replies rapidly past 10/min → further replies are
   rejected with a friendly retry message (429 + `Retry-After`) until the window
   resets.
4. **Empty thread (US1)**: Open an update with no replies → an inviting "start the
   conversation" state and a zero reply count.
5. **Nested reply (US2)**: Reply to an existing reply → the new reply renders under
   its parent in the same thread.
6. **Capped indent (US2)**: Build a deeply nested exchange (beyond 4 levels) →
   indentation stops at the cap; deeper replies render at the cap (no runaway
   indentation), thread stays readable.
7. **Note on an update (US3)**: Compose an update with a note → it shows alongside
   the update in the feed and the author's own items. Leave the note empty → posts
   normally without a note. Over-length note → rejected with a clear message.
8. **Reply count (US3 affordance)**: An update with replies shows a reply count;
   tombstoned replies are excluded from the count.
9. **Delete own reply, no children (US4)**: Delete a reply you authored that has no
   children → it disappears for everyone.
10. **Delete own reply, with children (US4)**: Delete a reply you authored that has
    nested children → it shows a "[deleted]" tombstone; the children remain.
11. **Cannot delete others' (US4)**: A reply by another user offers no delete
    control; a direct delete attempt is rejected (403/404).
12. **Delete the update**: Remove an update → its entire conversation is removed.
13. **Plain-text safety**: A reply/note containing markup-like characters renders as
    literal text, never executed.

## Automated checks

```bash
corepack pnpm -r test:unit
corepack pnpm -C backend exec vitest run tests/contract/replies.test.ts
corepack pnpm -C backend exec vitest run tests/unit/replies.test.ts
corepack pnpm -w lint && corepack pnpm -r build
```

See `contracts/openapi.yaml` and `data-model.md`.
