<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/006-conversations/plan.md`

Active feature: 006 **Conversations** (update notes + threaded replies). Adds an
optional author **note** on an update, and **replies** to updates (nested/Twitter-
style; plain text; rate-limited 10/min like posts; length-limited). Replies are
visible to all authenticated users; users delete their own (hard-delete when
childless, tombstone when it has children); deleting an update cascades its
conversation; each update shows a reply count. Adds `Reply` model + `Activity.note`,
`GET/POST /api/activities/:id/replies` + `DELETE /api/replies/:id`, feed/home carry
`note`+`replyCount`. Out of scope: likes, edit, @mentions, notifications. Builds on
shipped 001–005.

Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`, Material Design 3),
Fastify/Node 22 API (`backend/`), shared types (`packages/shared`); CloudSQL
PostgreSQL + Prisma; Memorystore Redis; Terraform infra (`infra/`) on GCP
(`us-central1`) with Cloud Logging. Discovery roadmap: 002 ✅ → 003 ✅ → 004 ✅ →
005-wishlist → 006-conversations. See
`specs/005-wishlist/{research,data-model,quickstart}.md` and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
