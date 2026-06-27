<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/004-search-recommend/plan.md`

Active feature: 004-search-recommend (media **search** + user-driven
**recommendations** populating the home recommendations region). Search reuses the
003 provider-abstraction + cache (Principle III) with keyless providers: Books→Google
Books volumes search (optional key), Music/Audiobooks/Podcasts→Apple iTunes Search API
(keyless). Adds `GET /api/search`, `POST/DELETE /api/recommendations`, a `Recommendation`
model, and a Search page; "Recommend" lives on the shared DiscoverItemCard (Discover +
Search). Reuses 001 posting for "start activity from item". Builds on shipped 001–003.

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Material Design 3),
Fastify/Node 22 API (`backend/`), shared types (`packages/shared`); CloudSQL
PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Discovery roadmap: 002 ✅ → 003 ✅ →
004-search-recommend → 005-wishlist → 006-conversations. See
`specs/004-search-recommend/{research,data-model,quickstart}.md` and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
