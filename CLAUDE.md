<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/007-item-page/plan.md`

Active feature: 007 **Item Detail Page** — a deep-linkable page at
`/item/:mediaType/:providerId` for one media item, reached by clicking an item's
cover/title from Discover, Search, My Library, and feed cards. Backed by a new
provider-backed item lookup (`getItem` by id; cache-aside + stale fallback;
keyless Google Books volume + iTunes lookup). Shows cover/title/creator/badge,
expandable synopsis, genres, the shared item controls (shelf, currently-reading
+ share, recommend, star rating), and community sections from our own DB:
average rating + count (Rating), per-shelf user counts (LibraryItem), recent
activity (Activity). Adds `GET /api/items/:mediaType/:providerId` → `{ item,
detailAvailable, stats }`; no new tables. Also: Search results persist on
back-navigation (query moves to the URL). Out of scope: long-form reviews,
editions, purchase links, key/auth providers. Builds on shipped 001–006.

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Impeccable design
system), Fastify/Node 22 API (`backend/`), shared types (`packages/shared`);
CloudSQL PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Roadmap: 002 ✅ → 003 ✅ → 004 ✅ → 005 ✅ →
006 ✅ → 007-item-page. See
`specs/007-item-page/{research,data-model,quickstart}.md` and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
