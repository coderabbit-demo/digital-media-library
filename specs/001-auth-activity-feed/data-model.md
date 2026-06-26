# Phase 1 Data Model: Authentication & Activity Feed

Source of truth: CloudSQL for PostgreSQL. Entities derive from the spec's Key
Entities and Functional Requirements. Redis holds only derived/cacheable data
(feed page cache, rate-limit counters) — never authoritative state.

## Entity: UserProfile

A person who has signed in with Google. One profile per Google identity.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (PK) | App-internal identifier; used for all foreign keys. |
| `google_sub` | text, UNIQUE, NOT NULL | Google OIDC `sub` claim; the dedup key (FR-003). |
| `email` | text, NULL | Captured for contact/display only; NOT used as identity key. |
| `display_name` | text, NOT NULL | From Google profile; default placeholder if absent (edge case). |
| `avatar_url` | text, NULL | From Google profile; UI shows placeholder if null. |
| `created_at` | timestamptz, NOT NULL, default now() | Profile creation time (FR-002). |
| `updated_at` | timestamptz, NOT NULL | Touched when profile fields refresh on login. |

**Rules**
- `google_sub` UNIQUE enforces "no duplicate profiles" (FR-003) at the database level.
- On login: upsert by `google_sub`; refresh `display_name`/`avatar_url`; never create a second row for the same `sub`.
- PII is limited to `email`, `display_name`, `avatar_url` (Principle IV / FR-007).

## Entity: Activity

A single "currently reading/listening" update, authored by one profile.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → UserProfile.id), NOT NULL | Author; `ON DELETE CASCADE`. |
| `media_type` | enum(`book`,`music`,`audiobook`), NOT NULL | FR-013/FR-014. |
| `title` | text, NOT NULL, 1–300 chars | Item title; validated + length-limited. |
| `author` | text, NULL, ≤200 chars | Optional author/artist. |
| `created_at` | timestamptz, NOT NULL, default now() | Post time; feed ordering key. |

**Rules**
- `media_type` and `title` are required; blank/whitespace `title` rejected (FR-014).
- `title`/`author` length-limited; over-limit input rejected, not silently truncated server-side (display may truncate).
- Text stored verbatim and returned as plain text; never interpreted as markup (FR-018).
- A user may delete only their own activities — enforced by `WHERE id = ? AND user_id = currentUser` (FR-016/FR-017).
- `ON DELETE CASCADE` from UserProfile removes a deleted user's activities from the feed (edge case).

**Indexes**
- `idx_activity_feed` on `(created_at DESC, id DESC)` — powers keyset feed pagination (FR-008/FR-011).
- `idx_activity_user` on `(user_id)` — author lookups and cascade efficiency.

## Entity: Session

A server-side session referenced by the signed httpOnly cookie.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (PK) | Opaque session id stored (signed) in the cookie. |
| `user_id` | UUID (FK → UserProfile.id), NOT NULL | `ON DELETE CASCADE`. |
| `created_at` | timestamptz, NOT NULL, default now() | |
| `expires_at` | timestamptz, NOT NULL | Sliding/absolute expiry; expired sessions are invalid. |
| `last_seen_at` | timestamptz, NOT NULL | Updated on use; supports idle timeout. |

**Rules**
- Sign-out and account deletion delete the session row (revocation — Principle IV).
- Lookups ignore rows past `expires_at`; an expired/absent session ⇒ unauthenticated (FR-005, FR-006).
- Stored in PostgreSQL so any Cloud Run instance can validate it (statelessness — Principle V).

**Index**
- `idx_session_user` on `(user_id)`; periodic cleanup of expired rows.

## Relationships

```text
UserProfile 1 ──< Activity        (author; cascade delete)
UserProfile 1 ──< Session         (cascade delete)
```

## Derived / non-authoritative state (Redis)

- **Feed page cache**: key for the global feed's first page; short TTL; invalidated on Activity insert/delete. Rebuildable from PostgreSQL.
- **Rate-limit counters**: per-user post counters with a 1-minute expiry window enforcing the 10-posts/minute limit (FR-019). Ephemeral.

## Validation summary (shared zod schemas — `packages/shared`)

- `CreateActivity`: `{ mediaType: 'book'|'music'|'audiobook'; title: string(1..300, trimmed non-empty); author?: string(<=200) }`.
- Feed query: `{ cursor?: string; limit?: int(1..50, default 20) }`.
- Profile (response): `{ id, displayName, avatarUrl|null }` — `google_sub` and session ids are never exposed to clients.
