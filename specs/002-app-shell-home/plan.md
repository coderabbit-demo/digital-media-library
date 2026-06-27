# Implementation Plan: App Shell, Auth Gate & Home Page

**Branch**: `002-app-shell-home` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-app-shell-home/spec.md`

## Summary

Establish the authenticated application shell and the three-column home page on top
of feature 001. Add a frontend route guard so only the sign-in/registration route is
reachable while unauthenticated; add primary navigation organized by media category
(Books, Music, Audiobooks) plus a Wishlist entry; and rebuild the home page as a
responsive three-column layout (left: the user's own current items + quick links +
counts; center: a bundled hero image above the community feed; right: a
recommendations region shown empty until feature 004). The home page is served from a
single aggregated, local-only endpoint (`GET /api/home`) that reads only our own
database — no external content-provider calls — targeting a sub-3s load. Reuses the
001 stack and GCP infra unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 (backend); TypeScript 5.x + React 18 (frontend) — unchanged from 001.

**Primary Dependencies**: Backend — Fastify, Prisma, zod, `@dml/shared`. Frontend — React 18 + Vite, TanStack Query, React Router, Material Design 3 token system (already in place).

**Storage**: CloudSQL PostgreSQL (existing). No new tables — the home reads existing `UserProfile` and `Activity` rows. Wishlist count is a placeholder (0) until feature 005; recommendations region is empty until feature 004.

**Testing**: Vitest unit; Fastify `inject` contract tests; Testcontainers-PostgreSQL integration; React Testing Library component tests. (Playwright e2e for the auth-gate + home flow is optional here and can ride with later features.)

**Target Platform**: Modern web browsers (SPA); backend on Cloud Run. Unchanged.

**Performance Goals**: Home page ready in **under 3000 ms** (SC-003) with **zero external content-provider calls** — served by one aggregated local DB-backed endpoint.

**Constraints**: App-wide auth (only sign-in public); home uses local data only (our DB + bundled assets); per-user data scoped to the current user; user-provided text rendered as plain text; responsive three-column → single-column stacking.

**Scale/Scope**: Same launch target as 001 (~100 concurrent). No new infra.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.3.0:

| Principle / Constraint | Status | How this plan complies |
|------------------------|--------|------------------------|
| I. Spec-Driven Development | ✅ Pass | Built from the approved 002 spec; plan precedes code; no open clarifications. |
| II. Test-First Quality Gates | ✅ Pass | Contract test for `GET /api/home`; integration tests (own-items scoping, counts, auth-required); frontend component tests (route guard redirect, three-column render, recommendations empty state) authored first. |
| III. Resilient Integrations & Caching | ✅ Pass (N/A) | This feature integrates **no external providers** (those arrive in 003); the home is deliberately local-only, so there is nothing to abstract or cache here. The boundary is introduced in 003. |
| IV. Security & Privacy by Default | ✅ Pass | App-wide auth gate (only sign-in public); `GET /api/home` is auth-guarded and returns only the current user's own items; community feed reuses 001's rules; all text rendered as plain text. |
| V. Cloud-Native, Cost-Aware Operations | ✅ Pass | Stateless; a single aggregated local DB read minimizes round-trips for the <3s goal; structured logs reused; no new standing resources. |
| Constraint: Terraform IaC | ✅ Pass | No infra change; SPA + API deploy via existing pipeline. The hero is a bundled SPA asset (served by the existing bucket/CDN). |
| Constraint: Cloud Logging | ✅ Pass | Reuses existing logging. |
| Workflow: GitHub Issues + CodeRabbit | ✅ Pass | Tasks tracked as issues; PR runs CodeRabbit. |

**Result**: PASS — no violations. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-app-shell-home/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (read model; no schema changes)
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # GET /api/home
└── checklists/requirements.md
```

### Source Code (repository root) — additions to the existing monorepo

```text
backend/src/
├── api/home.ts             # GET /api/home (auth-guarded, aggregates local data)
└── services/home.ts        # assembles own items + counts + community feed page

frontend/src/
├── assets/hero.png         # bundled hero image (added during implementation)
├── components/
│   ├── AppShell.tsx        # top app bar + primary nav (categories + Wishlist)
│   ├── ProtectedRoute.tsx  # redirect-to-/signin guard
│   ├── HomeLeftColumn.tsx  # own current items + quick links + counts
│   └── RecommendationsPanel.tsx # right column (empty state for now)
├── pages/
│   ├── HomeFeed.tsx        # rebuilt as three-column layout
│   └── CategoryPlaceholder.tsx # Books/Music/Audiobooks Discover placeholders (filled in 003)
└── services/home.ts        # useHome() query for GET /api/home

packages/shared/src/index.ts # add HomeData / HomeCounts DTOs
```

**Structure Decision**: Extends the existing web monorepo from 001 — no new projects
or infra. The only backend addition is one aggregating read endpoint; the rest is
frontend shell/routing/layout plus shared DTOs.

## Complexity Tracking

> No constitutional violations — intentionally empty.
