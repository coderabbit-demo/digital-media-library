# Quickstart & Validation: App Shell, Auth Gate & Home Page

Validates feature 002 end-to-end. References [data-model.md](./data-model.md) and
[contracts/openapi.yaml](./contracts/openapi.yaml). Builds on the running feature-001
stack (see `specs/001-auth-activity-feed/quickstart.md` for local setup: `docker
compose up -d`, `backend/.env`, `pnpm install`, `prisma migrate dev`).

## Run

```bash
pnpm dev          # API :8080, SPA :5173
```

## Automated test gates (must pass — Principle II)

```bash
pnpm test:unit          # services + DTO validation
pnpm test:contract      # GET /api/home vs contracts/openapi.yaml
pnpm test:integration   # home aggregation: own-items scoping, counts, auth-required
pnpm --filter @dml/frontend test   # component tests (route guard, three-column, empty states)
```

## Manual validation scenarios (map to acceptance criteria)

1. **Auth gate redirects** (US1 / FR-001, SC-001)
   - While signed out, visit `/`, `/books`, `/wishlist`.
   - Expect: each redirects to `/signin`; no app content shown.

2. **Signed-in access** (US1)
   - Sign in (feature 001 Google flow), then navigate.
   - Expect: authenticated shell with primary nav (Books, Music, Audiobooks, Wishlist).

3. **Three-column home** (US2 / FR-003, SC-002)
   - Load the home page.
   - Expect: left = your own current items + quick links (post update, Wishlist) + counts; center = hero banner above the community feed; right = recommendations region.

4. **Recommendations region empty state** (FR-005)
   - Expect: the right column shows an inviting empty state (no auto-generated picks); it is populated later by feature 004.

5. **Region independence + empty states** (FR-004)
   - As a brand-new user with no activity, load home.
   - Expect: left column shows an inviting empty state while center/right still render.

6. **Responsive stacking** (US2 / SC-004)
   - Narrow the viewport (mobile width).
   - Expect: columns stack into one scrollable column (center first); all regions present.

7. **Local-only, fast home** (FR-006/FR-007, SC-003)
   - Load home with the network panel open.
   - Expect: data comes from `GET /api/home` (our API/DB) and bundled assets only — **no external content-provider calls**; page ready in under 3 seconds.

8. **Own-items privacy** (Principle IV)
   - As user B, confirm the left column shows only B's own items (never A's).

## Notes

- `GET /api/home` is the single local-data source for the page (own items + community
  feed page + counts). `counts.wishlisted` is 0 and `recommendations` is empty until
  features 005 and 004 respectively.
- The hero is a bundled SPA asset; confirm the source file path before adding it.
