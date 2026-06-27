# Quickstart & Validation: Discover (Trending by Category)

Validates feature 003. References [data-model.md](./data-model.md) and
[contracts/openapi.yaml](./contracts/openapi.yaml). Builds on the running 001/002
stack (`docker compose up -d`, `backend/.env`, `pnpm install`, `prisma migrate dev`).

## Provider credentials (local)

Add to `backend/.env` (Apple/iTunes needs none):

| Variable | Source |
|----------|--------|
| `NYT_API_KEY` | https://developer.nytimes.com (Books API) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | https://developer.spotify.com (app, client-credentials) |
| `DISCOVER_TTL_SECONDS` | optional; default ~10800 (3h) |

## Run

```bash
pnpm dev          # API :8080, SPA :5173
```

## Automated test gates (Principle II)

```bash
pnpm test:unit          # provider adapters (mocked HTTP via undici MockAgent) + cache/stale logic
pnpm test:contract      # GET /api/discover/{category} vs contracts/openapi.yaml
pnpm test:integration   # cache hit, lazy refresh on expiry, stale fallback on provider failure
pnpm --filter @dml/frontend test   # Discover page: list, stale banner, empty state, start-activity
```

## Manual validation scenarios (map to acceptance criteria)

1. **Discover by category** (US1 / FR-001–FR-003, SC-001)
   - Books → Discover, Music → Discover, Audiobooks → Discover.
   - Expect: each shows trending items (title + creator, cover when available), category-appropriate, within ~2s.

2. **Served from cache** (FR-003/FR-005, SC-002)
   - Open the same Discover view twice quickly.
   - Expect: the second load is served from cache (no new provider call — verify via logs: cache hit), fast.

3. **Stale-on-failure** (FR-006, SC-003)
   - Simulate the provider being unavailable (e.g., invalid key / network block) after a successful load.
   - Expect: the last-known-good results still render with a "may be out of date" indication — not an error page.

4. **Cold unavailable state** (FR-007)
   - Provider unavailable with no cached data.
   - Expect: a clear unavailable/empty state, no crash.

5. **Plain-text safety** (FR-009)
   - Any provider text with markup-like characters renders as literal text.

6. **No direct provider calls** (FR-004)
   - Grep: only files under `backend/src/providers/` reference provider hosts/SDKs.

7. **Start an activity from an item** (US2 / FR-008/FR-009, SC-004)
   - From a Discover item choose "I'm reading/listening to this".
   - Expect: the compose overlay opens pre-filled with the item's media type/title/creator; submitting posts it and it appears in the feed.

8. **Quota safety** (SC-005)
   - Navigate between Discover views repeatedly within the TTL window.
   - Expect: provider call count stays flat (cache serves); logs show hits, not new fetches.

## Cloud notes

`terraform apply` provisions the new Secret Manager secrets (`NYT_API_KEY`,
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) and grants the runtime service account
accessor; populate the secret values out-of-band. Confirm provider-call and cache
hit/miss logs appear in Cloud Logging.
