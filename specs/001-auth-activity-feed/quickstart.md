# Quickstart & Validation: Authentication & Activity Feed

This guide validates the feature end-to-end. It references [data-model.md](./data-model.md)
and [contracts/openapi.yaml](./contracts/openapi.yaml) rather than restating them.
Implementation details live in `tasks.md` and the code.

## Prerequisites

- Node.js 22 LTS and pnpm
- Docker (for Testcontainers-PostgreSQL and a local Redis)
- A Google OAuth 2.0 Client (Web) with redirect URI `http://localhost:8080/api/auth/google/callback`
- For cloud validation: `gcloud` authenticated, and Terraform ≥ 1.6

## Local environment

Required environment / secrets (local values via `.env`, cloud values via Secret Manager):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OIDC client |
| `OAUTH_REDIRECT_URI` | Must match the registered redirect URI |
| `SESSION_SIGNING_KEY` | Signs the session cookie |
| `APP_BASE_URL` | SPA origin for post-login redirect |

## Setup & run (local)

```bash
pnpm install
pnpm --filter backend prisma migrate dev      # apply schema from data-model.md
pnpm --filter backend dev                      # API on :8080
pnpm --filter frontend dev                     # SPA on :5173 (proxies /api -> :8080)
```

## Automated test gates (must pass — Principle II)

```bash
pnpm test:unit          # services + validation
pnpm test:contract      # each endpoint vs contracts/openapi.yaml
pnpm test:integration   # auth callback, feed pagination, post/delete authz (Testcontainers)
pnpm test:e2e           # Playwright: sign-in -> post -> see-in-feed
```

## Manual validation scenarios (map to acceptance criteria)

1. **First sign-in creates a profile** (US1 / FR-002)
   - Visit the SPA → "Sign in with Google" → consent.
   - Expect: redirected back authenticated; `GET /api/me` returns a profile; a new `UserProfile` row exists.

2. **Returning sign-in reuses the profile** (US1 / FR-003, SC-003)
   - Sign out (`POST /api/auth/logout`), sign in again with the same Google account.
   - Expect: same profile `id`; still exactly one row for that `google_sub`.

3. **Declined consent** (US1 / FR-006)
   - Start sign-in, cancel at Google's consent screen.
   - Expect: returned unauthenticated with a clear message; no profile created.

4. **Empty feed state** (US2 / FR-010)
   - With no activities, load the home page.
   - Expect: empty-state invite to post the first update.

5. **Post an update appears at top** (US3 / FR-013, SC-004)
   - `POST /api/activities` with `{mediaType, title}`.
   - Expect: `201`; the item is first in `GET /api/feed`, attributed to you, within 3s.

6. **Validation rejects bad posts** (US3 / FR-014)
   - Post with missing `title` or missing `mediaType`.
   - Expect: `400` with a clear message; nothing saved.

7. **Cross-user visibility** (US2/US3 / FR-012)
   - As user B, load the feed.
   - Expect: user A's update is visible, attributed to A, with `canDelete=false`.

8. **Authorization on delete** (US3 / FR-016, FR-017, SC-006)
   - As user B, `DELETE /api/activities/{A's id}` → expect `403`.
   - As user A, delete own activity → `204`; it disappears from every feed.

9. **Keyset pagination is stable** (US2 / FR-011)
   - Seed > `limit` activities; page with `nextCursor`; insert a new activity mid-paging.
   - Expect: no duplicates and no skipped items across pages.

10. **Plain-text safety** (FR-018)
    - Post a title containing HTML/script-like text.
    - Expect: it renders as literal text in the feed, never as markup.

11. **Rate limiting** (FR-019)
    - Post more than 10 times within one minute as the same user.
    - Expect: `429` on the 11th post, with a retry indication; allowed again after the window resets.

## Cloud validation (Terraform)

```bash
cd infra
terraform init
terraform plan  -var="project_id=<PROJECT>" -var="region=us-central1"
terraform apply -var="project_id=<PROJECT>" -var="region=us-central1"
```

Expect provisioning of: Artifact Registry, Cloud Run (API), CloudSQL PostgreSQL
(private IP), Serverless VPC connector, Memorystore Redis, Cloud Storage + HTTPS LB
+ CDN (SPA), Secret Manager entries, runtime service account, and Cloud Logging
sinks/retention. After apply, hit the load-balancer URL and repeat scenarios 1–11.

**Observability check**: confirm structured request logs (including cache hit/miss)
appear in Cloud Logging for the Cloud Run service (Principle V / logging constraint).
