# AGENTS.md

Guidance for contributors — human and AI — working in the Digital Media Library
repository. This is the general entry point; it is kept updated as the project
evolves.

## What this project is

A multi-user digital media library (trending books/music/audiobooks + a
Goodreads-style activity feed). See [README.md](README.md) for the high-level
overview and [.specify/memory/constitution.md](.specify/memory/constitution.md) for
the binding principles.

## Golden rules

1. **Spec-driven, always.** No feature code without an approved `spec.md` and
   `plan.md` under `specs/`. Follow the flow: constitution → specify → clarify →
   plan → tasks → implement. (Constitution, Principle I.)
2. **Test-first.** Write contract, integration, and unit tests before/with the code;
   they must fail first, then pass. CI is the gate. (Principle II.)
3. **Security by default.** Google OIDC only (no passwords); secrets only from
   Secret Manager; per-request authorization on every mutation; user text is plain
   text, never rendered as markup. (Principle IV.)
4. **Stateless & cost-aware.** No in-process session state — state lives in CloudSQL
   or Redis. Prefer the cheapest option that meets the requirement. (Principle V.)
5. **All infra is Terraform.** Never provision GCP resources by hand; change
   `infra/`. (Tech Constraints.)
6. **External providers go through the cache + abstraction layer** — never call a
   provider SDK/endpoint directly from feature code. (Principle III.)

## Workflow & tooling

- **Spec Kit** commands (`/speckit-*`) drive each phase. Feature artifacts live in
  `specs/<NNN>-<short-name>/`.
- **GitHub Issues** track requirements and tasks; reference the feature directory in issues.
- **CodeRabbit** reviews every PR before merge — resolve or explicitly dismiss its
  findings. Automated review supplements human review of security-sensitive changes.
- **Branches/PRs**: branch per feature/task; PRs reference their GitHub Issue and
  feature spec, keep the suite green, and note which principles the change touches.

## Tech stack (feature 001 onward)

- **Monorepo** (pnpm): `backend/` (Fastify, Node 22, TypeScript), `frontend/`
  (React + Vite), `packages/shared` (types + `zod` schemas).
- **Data**: CloudSQL PostgreSQL via Prisma (migrations in `backend`); Memorystore
  Redis for caching and rate-limit counters.
- **Infra**: Terraform in `infra/`, GCP region `us-central1`, Cloud Logging enabled.

> The stack is authoritative as of feature 001's plan and is now implemented. When a
> later plan changes it, update this section.

**Local commands** (run `corepack enable` first for pnpm):

```bash
pnpm install
pnpm --filter @dml/backend exec prisma generate
pnpm dev            # API :8080 + SPA :5173
pnpm lint && pnpm typecheck && pnpm build
pnpm test:unit && pnpm test:contract   # offline
pnpm test:integration                  # needs Docker
```

## Conventions

- TypeScript everywhere; share request/response types via `packages/shared` rather
  than redefining them per side.
- Validate all inputs server-side with shared `zod` schemas; never trust the client.
- Structured JSON logs for requests, errors, and cache hit/miss (Principle V).
- Keep secrets out of source — use Secret Manager (cloud) and untracked `.env`
  (local; see the feature quickstart for variables).

## Where to look

| Need | Location |
|------|----------|
| Project overview & setup | [README.md](README.md) |
| Binding principles | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Current feature spec/plan | [specs/001-auth-activity-feed/](specs/001-auth-activity-feed/) |
| API contract | [specs/001-auth-activity-feed/contracts/openapi.yaml](specs/001-auth-activity-feed/contracts/openapi.yaml) |
| Local run & validation | [specs/001-auth-activity-feed/quickstart.md](specs/001-auth-activity-feed/quickstart.md) |
| Agent context (Claude Code) | [CLAUDE.md](CLAUDE.md) |

---

*Maintained as the project evolves — update the stack, conventions, and links when a
new plan or feature changes them.*
