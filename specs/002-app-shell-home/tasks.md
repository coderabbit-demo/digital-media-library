---
description: "Task list for feature 002-app-shell-home"
---

# Tasks: App Shell, Auth Gate & Home Page

**Input**: Design documents from `/specs/002-app-shell-home/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: INCLUDED — the constitution (Principle II) mandates contract + integration + unit/component tests authored before/with implementation.

**Tracking**: Each task maps to a GitHub Issue; PRs reference their issue and run CodeRabbit before merge.

**Builds on**: feature 001 (auth, profiles, activity feed). No new tables, no new infra, no external providers.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task → can run in parallel.
- **[Story]**: US1 (auth gate) / US2 (three-column home). Setup/Foundational/Polish carry no story label.

## Path Conventions

Existing pnpm monorepo: `backend/`, `frontend/`, `packages/shared/`.

---

## Phase 1: Setup

**Purpose**: Shared types and assets this feature needs

- [X] T001 [P] Add `HomeData`, `HomeCounts`, and a placeholder `RecommendationDTO` (typed, always-empty for now) to `packages/shared/src/index.ts`
- [X] T002 [P] Add the bundled hero image at `frontend/src/assets/hero.png` (confirm the source path before copying — see project memory)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: App shell and routes both user stories build on

**⚠️ CRITICAL**: No user-story work begins until this phase is complete

- [X] T003 Build the app shell (top app bar + primary nav: Books, Music, Audiobooks, Wishlist; user/sign-out) in `frontend/src/components/AppShell.tsx`
- [X] T004 [P] Add a category Discover placeholder page ("coming soon", filled by feature 003) in `frontend/src/pages/CategoryPlaceholder.tsx`
- [X] T005 [P] Add a Wishlist placeholder page (filled by feature 005) in `frontend/src/pages/WishlistPlaceholder.tsx`

**Checkpoint**: Shell + placeholder destinations exist so navigation resolves.

---

## Phase 3: User Story 1 - App-wide authentication gate (Priority: P1) 🎯 MVP

**Goal**: Only the sign-in/registration route is reachable while unauthenticated; every other route redirects to `/signin`. Signed-in users reach the shell.

**Independent Test**: While signed out, visit `/`, `/books`, `/wishlist` → each redirects to `/signin` with no content; sign in → access granted; sign out → protected routes redirect again.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T006 [P] [US1] Component test: `ProtectedRoute` redirects to `/signin` when unauthenticated and renders children when authenticated, in `frontend/tests/ProtectedRoute.test.tsx`

### Implementation for User Story 1

- [X] T007 [US1] Implement `ProtectedRoute` (uses `useMe`; redirect to `/signin` while unauthenticated; render nothing/spinner during load) in `frontend/src/components/ProtectedRoute.tsx`
- [X] T008 [US1] Configure the SPA router so only `/signin` and `/auth/callback` are public and all other routes are wrapped in `ProtectedRoute` + `AppShell`, in `frontend/src/App.tsx` (depends on T003, T007)
- [X] T009 [US1] Ensure sign-out routes to `/signin` and protected routes are unreachable afterward, in `frontend/src/services/auth.ts` and `frontend/src/App.tsx`

**Checkpoint**: The auth gate is enforced app-wide and independently demoable.

---

## Phase 4: User Story 2 - Home page (three-column layout) (Priority: P1)

**Goal**: A responsive three-column home — left: own current items + quick links + counts; center: hero above the community feed; right: recommendations region (empty for now) — served by a single local-only `GET /api/home` in under 3s.

**Independent Test**: Load the home page → three columns render with their content; recommendations + own-items empty states show appropriately; the page uses only `GET /api/home`/bundled assets (no external calls) and stacks to one column on a narrow viewport.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T010 [P] [US2] Contract test for `GET /api/home` vs contracts/openapi.yaml in `backend/tests/contract/home.test.ts`
- [X] T011 [P] [US2] Integration test (Testcontainers): `/api/home` scopes `ownItems`/`currentlyOn` to the current user, includes the community feed page and `wishlisted: 0`, and returns 401 when unauthenticated, in `backend/tests/integration/home.test.ts`
- [X] T012 [P] [US2] Component tests: three-column layout renders all regions; recommendations empty state; own-items empty state; single-column stacking on narrow viewport, in `frontend/tests/HomeFeed.test.tsx`

### Implementation for User Story 2

- [X] T013 [US2] Implement `HomeService` aggregating own current items + counts + community feed page from the local DB in `backend/src/services/home.ts`
- [X] T014 [US2] Implement auth-guarded `GET /api/home` returning `HomeData` (and register it) in `backend/src/api/home.ts` + `backend/src/app.ts` (depends on T013)
- [X] T015 [US2] Emit structured logs for home requests in `backend/src/api/home.ts`
- [X] T016 [P] [US2] Add `useHome()` query for `GET /api/home` in `frontend/src/services/home.ts`
- [X] T017 [P] [US2] Build `HomeLeftColumn` (own current items + counts + quick links: post update, open Wishlist) in `frontend/src/components/HomeLeftColumn.tsx`
- [X] T018 [P] [US2] Build `RecommendationsPanel` (right column with an inviting empty state) in `frontend/src/components/RecommendationsPanel.tsx`
- [X] T019 [US2] Rebuild `HomeFeed` as the three-column layout (left = HomeLeftColumn; center = hero image + community feed; right = RecommendationsPanel) in `frontend/src/pages/HomeFeed.tsx` (depends on T016, T017, T018)
- [X] T020 [US2] Add MD3 three-column responsive styles (CSS grid + single-column stacking) in `frontend/src/index.css`

**Checkpoint**: Home renders all regions from local data, fast, and stacks responsively.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T021 [P] Unit tests for `HomeService` aggregation and the shared Home DTOs in `backend/tests/unit/` and `packages/shared/tests/`
- [X] T022 Accessibility pass: keyboard navigation + aria labels on the shell nav and home regions; confirm all user-provided text renders as plain text, in `frontend/src/components/`
- [X] T023 [P] Update `README.md` (Features table → 002) and `AGENTS.md` if setup/stack notes changed
- [ ] T024 Run quickstart.md validation scenarios 1–8 (auth gate, three-column, empty states, local-only/<3s, privacy, stacking) — needs a live stack with real Google OIDC; automated tests cover the gate redirect, three-column render, and the local-only `/api/home` contract

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — blocks both stories.
- **US1 (Phase 3)** and **US2 (Phase 4)**: both depend on Foundational. They are largely independent (US1 = routing/guard in `App.tsx`/`ProtectedRoute`; US2 = `/api/home` + home columns) and can proceed in parallel; only T008 (router wiring) and T019 (home page) both touch routing/home, so sequence those if one person does both.
- **Polish (Phase 5)**: after the targeted stories.

### Within Each User Story

- Tests first (must fail) → implementation. Backend: service → endpoint → logging. Frontend: query/hook → column components → page assembly → styles.

### Parallel Opportunities

- Setup: T001, T002 together.
- Foundational: T004, T005 together (after/with T003).
- US2 tests: T010, T011, T012 together. US2 frontend pieces: T016, T017, T018 together; then T019.
- US1 and US2 can be built by different people once Foundational is done.

---

## Parallel Example: User Story 2

```bash
# Tests first (parallel):
Task: "Contract test GET /api/home in backend/tests/contract/home.test.ts"
Task: "Integration test /api/home in backend/tests/integration/home.test.ts"
Task: "Home component tests in frontend/tests/HomeFeed.test.tsx"

# Then parallel build of independent pieces:
Task: "useHome() in frontend/src/services/home.ts"
Task: "HomeLeftColumn in frontend/src/components/HomeLeftColumn.tsx"
Task: "RecommendationsPanel in frontend/src/components/RecommendationsPanel.tsx"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Setup → 2. Foundational → 3. US1 (auth gate) → 4. US2 (three-column home).
5. **STOP and VALIDATE**: auth gate redirects; home renders all regions from local data in <3s. Deploy/demo.

### Incremental Delivery

- Setup + Foundational → shell ready.
- US1 → app-wide auth gate (demo: redirects).
- US2 → three-column home (demo: full home).
- Polish → a11y, docs, quickstart validation.

---

## Notes

- Each task maps to a GitHub Issue; commit per task or logical group; PRs run CodeRabbit and keep the suite green.
- Verify tests fail before implementing (Principle II).
- Recommendations region and `counts.wishlisted` are intentional placeholders (features 004/005).
