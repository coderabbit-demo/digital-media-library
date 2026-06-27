<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/002-app-shell-home/plan.md`

Active feature: 002-app-shell-home (app-wide auth gate + category nav + three-column
home page; local-data only, <3s; bundled hero image). Builds on 001 (shipped: Google
OIDC auth + activity feed). Adds one aggregated local endpoint `GET /api/home` and
frontend shell/routing/layout; no new infra, no external providers (those arrive in
003-discover).

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Material Design 3),
Fastify/Node 22 API (`backend/`), shared types (`packages/shared`); CloudSQL
PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Discovery roadmap: 002 → 003-discover →
004-search-recommend → 005-wishlist. See `specs/002-app-shell-home/{research,data-model,quickstart}.md`
and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
