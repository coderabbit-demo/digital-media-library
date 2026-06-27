<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/005-wishlist/plan.md`

Active feature: 005 **My Library** (Goodreads-style shelves; supersedes the flat
wishlist). Private per-user collection; each item on exactly one shelf (want/current/
done/dnf, stored generically, media-aware UI labels). "Add to Library" on every media
item (→ Want to Read), a My Library page with shelf tabs + media-type filter, move
between shelves, owner-only remove, and a **bridge** that offers to share an activity
to the feed when moving to Currently Reading (feed/001 unchanged). Local-data only
(snapshots; no external providers/secrets). `LibraryItem` model + `Shelf` enum,
`GET/POST /api/library` + `PATCH/DELETE /api/library/:id`; home `wishlisted` count =
Want to Read. Builds on shipped 001–004.

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Material Design 3),
Fastify/Node 22 API (`backend/`), shared types (`packages/shared`); CloudSQL
PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Discovery roadmap: 002 ✅ → 003 ✅ → 004 ✅ →
005-wishlist → 006-conversations. See
`specs/005-wishlist/{research,data-model,quickstart}.md` and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
