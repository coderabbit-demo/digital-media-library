<!--
SYNC IMPACT REPORT
==================
Version change: 1.2.0 → 1.3.0
Bump rationale: MINOR — set GitHub Issues as the requirements/task-tracking tool in
  Development Workflow & Quality Gates. Materially revised workflow guidance; no
  principle removed or redefined.

History:
  - 1.0.0 (2026-06-26) — initial adoption of Core Principles (I–V), Technology &
    Architecture Constraints, Development Workflow & Quality Gates, and Governance.
  - 1.1.0 (2026-06-26) — added requirements/task-tracking and CodeRabbit (code
    review) guidance to Development Workflow & Quality Gates.
  - 1.2.0 (2026-06-26) — added Terraform IaC requirement and Logging & observability
    requirement (Cloud Logging via Terraform).

Modified sections (1.3.0):
  - Development Workflow & Quality Gates — set GitHub Issues as the
    requirements/task tracker (CodeRabbit code review unchanged).

Added sections: None
Removed sections: None

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (Constitution Check gate is
    generic and resolves against this file; no edit required)
  - .specify/templates/spec-template.md ✅ aligned (no new mandatory spec sections
    introduced)
  - .specify/templates/tasks-template.md ✅ aligned (principle-driven task types —
    testing, caching, security, observability — already expressible)
  - CLAUDE.md ✅ aligned (defers to current plan; no principle references to update)

Follow-up TODOs: None
-->

# Digital Media Library Constitution

## Core Principles

### I. Spec-Driven Development (NON-NEGOTIABLE)

Every feature MUST flow through the Spec Kit lifecycle before implementation:
constitution → specify → clarify (when ambiguous) → plan → tasks → implement.
Code MUST NOT be written for a feature that lacks an approved `spec.md` and
`plan.md`. Specifications MUST describe user-facing behavior and requirements
without prescribing implementation; plans MUST resolve every `NEEDS
CLARIFICATION` marker before tasks are generated.

**Rationale**: The project is built on Spec Kit precisely so intent is captured
and reviewed before effort is spent. Skipping the flow reintroduces the ambiguity
the framework exists to eliminate.

### II. Test-First Quality Gates

Tests MUST be authored before or alongside the code they cover, and MUST fail
before the implementation makes them pass. Every feature MUST include: contract
tests for each API endpoint, integration tests for multi-user flows (auth, feed,
comments), and unit tests for business logic. No task is "done" while its tests
are red or absent. CI MUST run the full suite on every pull request and block
merge on failure.

**Rationale**: A multi-user social system with external data sources has many
interacting parts; regressions are cheap to introduce and expensive to discover
in production. Tests are the only durable guarantee of behavior.

### III. Resilient Integrations & Aggressive Caching

All external content providers (trending books, music, audiobooks) MUST be
accessed through a single internal abstraction layer — application code MUST NOT
call a provider SDK or HTTP endpoint directly. Every provider response MUST be
cached with an explicit TTL, and the system MUST serve stale-but-cached data
rather than fail when a provider is unavailable or rate-limited. Provider
selection MUST favor stable, documented APIs with predictable quotas.

**Rationale**: Third-party APIs impose rate limits and incur cost on overage, and
they fail independently of our system. Caching and an abstraction boundary make
the product cheap to run, resilient to outages, and able to swap providers
without rippling changes through the codebase.

### IV. Security & Privacy by Default

Authentication MUST use Google OAuth 2.0 / OIDC; the system MUST NOT store user
passwords. Secrets (OAuth client secrets, DB credentials, API keys) MUST come
from a managed secret store or injected environment, never from source control.
All traffic MUST be served over TLS. User-generated content (feed activity,
comments) MUST be authorization-checked on every mutating request so a user can
only modify their own data. Personally identifiable information MUST be limited
to what the feature requires.

**Rationale**: This is a multi-user social product handling identities and
user-generated content. A single missing authorization check or leaked secret
compromises every user; security cannot be retrofitted.

### V. Cloud-Native, Cost-Aware Operations

Services MUST be stateless and horizontally scalable to run correctly on Cloud
Run (any request may hit any instance; no in-process session state). Persistent
state lives only in CloudSQL (PostgreSQL) or the caching layer. Database access
MUST use connection pooling appropriate to Cloud Run's instance model. Structured
logs MUST be emitted for requests, errors, and external-provider calls (including
cache hit/miss), so behavior and spend are observable. Designs MUST prefer the
lower-cost option that meets requirements.

**Rationale**: The deployment target (Cloud Run + CloudSQL) and the goal of
avoiding API overages make statelessness, observability, and cost-awareness
architectural requirements, not afterthoughts.

## Technology & Architecture Constraints

- **Frontend**: Single Page Application (SPA).
- **Backend**: Stateless service deployed to Google Cloud Run.
- **Database**: Google CloudSQL for PostgreSQL — the single source of truth for
  user, activity-feed, and comment data.
- **Caching**: A dedicated caching layer fronting all external-provider data and
  expensive queries; cache strategy and TTLs are specified per feature in
  `plan.md`.
- **Authentication**: Google accounts via OAuth 2.0 / OIDC.
- **External data**: Trending content sourced through the provider abstraction
  defined in Principle III; concrete providers chosen during planning and
  recorded in `research.md`.
- **Infrastructure as Code**: All GCP resources (Cloud Run services, CloudSQL
  instances, networking, IAM, secrets, and logging/monitoring) MUST be provisioned
  and version-controlled with **Terraform**. Manual provisioning via the console or
  ad-hoc CLI is prohibited except for break-glass incidents, which MUST be
  reconciled back into Terraform. Terraform configuration lives in the repository
  (e.g., `infra/`) and concrete resource definitions are produced during planning.
- **Logging & observability**: Cloud Logging MUST be enabled for all services and
  infrastructure, provisioned through Terraform. Application services emit the
  structured logs required by Principle V; infrastructure and access logs are
  retained per standard practice.
- Deviations from this stack MUST be justified in the plan's Complexity Tracking
  table.

## Development Workflow & Quality Gates

- Work proceeds via the Spec Kit commands; each feature lives under
  `specs/[###-feature-name]/`.
- **Requirements and task tracking** are managed with **GitHub Issues**. Spec Kit
  artifacts (`spec.md`, `plan.md`, `tasks.md`) remain the source of truth for
  behavior and design; GitHub Issues track the work to deliver them and SHOULD
  reference the corresponding feature directory, and pull requests SHOULD reference
  their issue.
- The plan's **Constitution Check** gate MUST pass before Phase 0 research and be
  re-verified after Phase 1 design. Violations MUST be recorded and justified in
  Complexity Tracking or the design MUST change.
- Pull requests MUST: reference their spec/feature (and GitHub Issue), keep the test
  suite green, and demonstrate compliance with the principles relevant to the
  change (auth checks, caching, observability).
- **Code review** uses **CodeRabbit** as the automated reviewer on every pull
  request. CodeRabbit review MUST run before merge; its findings are triaged and
  resolved or explicitly dismissed with rationale. Automated review supplements,
  and does not replace, human review of security-sensitive changes.
- Human code review MUST explicitly confirm Principle IV (security/authorization)
  for any change touching authentication, user data, or comments.

## Governance

This constitution supersedes other development practices. When guidance conflicts,
the constitution wins.

- **Amendments** MUST be proposed as a documented change to this file, reviewed,
  and accompanied by any required migration of dependent templates and code.
- **Versioning** follows semantic versioning: MAJOR for backward-incompatible
  principle removals or redefinitions, MINOR for new principles or materially
  expanded guidance, PATCH for clarifications and non-semantic refinements.
- **Compliance** is reviewed at every plan Constitution Check and every pull
  request. Unjustified violations block merge.
- Runtime, feature-specific development guidance lives in the current feature's
  `plan.md` (see `CLAUDE.md`), which MUST remain consistent with this document.

**Version**: 1.3.0 | **Ratified**: 2026-06-26 | **Last Amended**: 2026-06-26
