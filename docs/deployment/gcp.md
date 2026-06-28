# GCP Deployment (Planned)

The canonical production target: a fully-private GCP stack provisioned by Terraform in [`infra/`](../../infra/) and deployed by [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).

**What Terraform creates** (see [`infra/README.md`](../../infra/README.md)): Artifact Registry, VPC + Serverless VPC Access connector + Private Services Access, **CloudSQL PostgreSQL** (private IP), **Memorystore Redis**, **Cloud Run v2** API (least-privilege SA, secrets from Secret Manager, LB-only ingress), **SPA hosting** (GCS bucket + global external HTTPS LB + Cloud CDN, URL map sends `/api/*` → Cloud Run, everything else → bucket), **Secret Manager**, and **Cloud Logging**.

> Region defaults to `us-central1`; everything is sized smallest-by-default and parameterized. Cost knobs: `enable_redis=false`, `cloud_run_min_instances=0`.

---

## Prerequisites

- [ ] Terraform ≥ 1.6 and `gcloud` installed
- [ ] `gcloud auth application-default login` with rights to create the resources above
- [ ] A GCP project with **billing enabled** (Terraform enables the needed APIs)
- [ ] A **Google OAuth 2.0 client** (Web application) created in the Cloud Console
- [ ] Docker installed (to build the API image), or rely on the CI workflow
- [ ] A domain you control (for managed TLS) — optional but recommended

---

## 1. Provision infrastructure (Terraform)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform plan  -var project_id=YOUR_PROJECT_ID
terraform apply -var project_id=YOUR_PROJECT_ID
```

- [ ] Set `project_id`, `env` (e.g. `prod`), `region`
- [ ] Set `google_client_id` (the OAuth **client ID**)
- [ ] Set `domain=app.example.com` to provision a Google-managed cert + HTTP→HTTPS redirect (then point an `A` record at the `load_balancer_ip` output)
- [ ] Production sizing reviewed: `cloud_run_min_instances ≥ 1` (avoid cold starts), `enable_redis=true`, `cloudsql_ha` and `cloudsql_deletion_protection` as desired
- [ ] `terraform apply` completed; note the outputs (`artifact_registry_repo`, `load_balancer_ip`, bucket, service name)

## 2. Populate secrets (Secret Manager)

Terraform creates the secret **containers**; it generates `db-password`, `session-signing-key`, `database-url`, and `redis-url` values itself. You must add the externally-issued values:

```bash
# OAuth client secret (issued by Google; never stored in source)
printf '%s' 'THE-CLIENT-SECRET' | gcloud secrets versions add ${ENV}-google-oauth-client-secret \
  --project=$PROJECT --data-file=-

# Optional provider keys (placeholders are created; replace to activate)
printf '%s' 'NYT_KEY'          | gcloud secrets versions add ${ENV}-nyt-api-key          --project=$PROJECT --data-file=-
printf '%s' 'GOOGLE_BOOKS_KEY' | gcloud secrets versions add ${ENV}-google-books-api-key --project=$PROJECT --data-file=-
```

- [ ] `${ENV}-google-oauth-client-secret` has a version (**required** — Cloud Run won't start without it)
- [ ] `${ENV}-nyt-api-key` / `${ENV}-google-books-api-key` set (optional; leave placeholder to run without)
- [ ] Verify the runtime service account has `secretAccessor` on each (Terraform grants this via `runtime_secret_ids`)

### ⚠️ Spotify secrets are not yet in Terraform

The Spotify item-page links (`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`) were added after the infra was authored and are **not** wired into `infra/secrets.tf` / `infra/main.tf` yet. To enable them in production, either:

- [ ] **Recommended:** add a `${ENV}-spotify-client-secret` secret + the `SPOTIFY_CLIENT_ID` env / `SPOTIFY_CLIENT_SECRET` secret to the Cloud Run env block in `infra/main.tf` (mirroring the `google_books_api_key` wiring), `terraform apply`, then add the secret version; **or**
- [ ] **Quick path:** set them directly on the service — `gcloud run services update ${ENV}-dml-api --update-env-vars SPOTIFY_CLIENT_ID=... ` and a secret mount for the secret (note: a manual env change is reconciled away on the next `terraform apply`, so prefer wiring it in).
- [ ] If left unset, the app runs fine — the "Listen on Spotify" link is simply omitted.

> The optional TTL knobs (`ITEM_TTL_SECONDS`, `SEARCH_TTL_SECONDS`, etc.) have sane defaults and need no wiring unless you want to override them.

## 3. Build & push the API image

The image is the multi-stage [`backend/Dockerfile`](../../backend/Dockerfile) (built from the repo root for workspace context).

```bash
REPO=$(cd infra && terraform output -raw artifact_registry_repo)
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
docker build -f backend/Dockerfile -t "$REPO/api:v1" .
docker push "$REPO/api:v1"
```

- [ ] Image built and pushed
- [ ] `terraform apply -var image_tag=v1` to roll Cloud Run to the new tag

## 4. Publish the SPA

Build with the API on the same origin (so `VITE_API_BASE_URL` defaults to `/api`) and sync to the hosting bucket:

```bash
corepack pnpm --filter @dml/frontend build
gcloud storage rsync frontend/dist gs://${ENV}-dml-spa-bucket \
  --recursive --delete-unmatched-destination-objects
gcloud compute url-maps invalidate-cdn-cache ${ENV}-dml-api-urlmap --path "/*" --async
```

- [ ] SPA built and synced to the bucket
- [ ] CDN cache invalidated

## 5. Database migrations

No automated migration step exists yet — run it explicitly before serving traffic. Two options:

**A. Cloud SQL Auth Proxy (from CI or a workstation):**
```bash
cloud-sql-proxy $PROJECT:$REGION:${ENV}-dml-postgres &      # private IP via proxy
DATABASE_URL='postgresql://USER:PASS@127.0.0.1:5432/DB' \
  corepack pnpm --filter @dml/backend exec prisma migrate deploy
```

**B. One-off Cloud Run Job** using the same API image with command `pnpm --filter @dml/backend exec prisma migrate deploy` and the `DATABASE_URL` secret attached (runs inside the VPC, no proxy needed).

- [ ] Migrations applied against the production database
- [ ] (Optional) automate as a pre-deploy Cloud Run Job step

## 6. OAuth configuration

- [ ] In the Google Cloud Console OAuth client, add **Authorized redirect URI** `https://<domain>/api/auth/google/callback`
- [ ] Add **Authorized JavaScript origin** `https://<domain>`
- [ ] Confirm `APP_BASE_URL` and `OAUTH_REDIRECT_URI` env on Cloud Run match the domain (Terraform sets these from `domain`)

## 7. CI/CD (GitHub Actions)

[`deploy.yml`](../../.github/workflows/deploy.yml) is `workflow_dispatch` by default and authenticates via **Workload Identity Federation** (no long-lived keys). Configure repo/org settings:

- [ ] Repo **variables**: `GCP_PROJECT_ID`, `GCP_REGION`, `ARTIFACT_REPO`, `GCS_SPA_BUCKET`, `CLOUD_RUN_SERVICE`, `WORKLOAD_IDENTITY_PROVIDER`, `DEPLOY_SERVICE_ACCOUNT`
- [ ] Workload Identity pool/provider bound to the deploy service account (roles: Artifact Registry writer, Cloud Run admin, Storage admin, Service Account user)
- [ ] Run the workflow (`image_tag`) and confirm it builds, deploys Cloud Run, syncs the SPA, and invalidates the CDN
- [ ] (Optional) add a migration job step and flip the trigger to `push: branches: [main]`

## 8. Verify & observe

- [ ] `https://<domain>` loads the SPA; the managed TLS cert is `ACTIVE`
- [ ] Sign in with Google end-to-end works
- [ ] Post an update; open Discover, Search, My Library, and an item page (incl. Spotify link if enabled)
- [ ] Cloud Logging shows structured request/provider logs (cache hit/miss) in the dedicated log bucket
- [ ] Cloud Run metrics: instances scaling, no error spikes; CloudSQL connections within pool limits

---

## Rollback

- **API:** `terraform apply -var image_tag=<previous>` (or `gcloud run services update-traffic ${ENV}-dml-api --to-revisions <REV>=100`).
- **SPA:** re-sync a previous `frontend/dist` build and invalidate the CDN.
- **DB:** migrations are forward-only; restore from a CloudSQL backup if a migration must be reverted.
