<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/003-discover/plan.md`

Active feature: 003-discover (per-category trending Discover; **introduces the
provider-abstraction + Redis cache + stale-on-failure layer** — Principle III).
Providers: Books→NYT Books API, Music→Spotify Web API, Audiobooks→Apple/iTunes; keys
in Secret Manager (Terraform). Adds `GET /api/discover/{category}` and `backend/src/providers/`
adapters; reuses 001 posting for "start activity from item". Builds on shipped 001
(auth+feed), MD3, 002 (shell/home).

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Material Design 3),
Fastify/Node 22 API (`backend/`), shared types (`packages/shared`); CloudSQL
PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Discovery roadmap: 002 ✅ → 003-discover →
004-search-recommend → 005-wishlist → 006-conversations. See
`specs/003-discover/{research,data-model,quickstart}.md` and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
