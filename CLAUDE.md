<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/005-wishlist/plan.md`

Active feature: 005-wishlist (personal, **private** wishlist). "Add to Wishlist" on
every media item (Discover + Search), a dedicated all-media Wishlist page with a
media-type filter, idempotent add, owner-only remove, and start-activity from an item.
Local-data only (items snapshotted; no external providers/secrets). Adds a `WishlistItem`
model, `GET/POST /api/wishlist` + `DELETE /api/wishlist/:id`, fills the home `wishlisted`
count, and replaces the Wishlist placeholder page. Builds on shipped 001–004.

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Material Design 3),
Fastify/Node 22 API (`backend/`), shared types (`packages/shared`); CloudSQL
PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Discovery roadmap: 002 ✅ → 003 ✅ → 004 ✅ →
005-wishlist → 006-conversations. See
`specs/005-wishlist/{research,data-model,quickstart}.md` and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
