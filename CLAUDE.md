<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-auth-activity-feed/plan.md`

Active feature: 001-auth-activity-feed (Google OIDC auth + global activity feed).
Stack: TypeScript pnpm monorepo — React/Vite SPA (`frontend/`), Fastify/Node 22 API
(`backend/`), shared types (`packages/shared`); CloudSQL PostgreSQL + Prisma;
Memorystore Redis cache; Terraform infra (`infra/`) on GCP (`us-central1`) with
Cloud Logging. See also `specs/001-auth-activity-feed/{research,data-model,quickstart}.md`
and `contracts/openapi.yaml`.
<!-- SPECKIT END -->
