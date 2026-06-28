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

### Spotify (feature 007 item-page links) — optional, wired into Terraform

The `${ENV}-spotify-client-secret` secret (placeholder), the `SPOTIFY_CLIENT_ID` env, and the `SPOTIFY_CLIENT_SECRET` secret ref are provisioned by Terraform. To enable the "Listen on Spotify" links:

- [ ] Set `spotify_client_id` in `terraform.tfvars` (non-secret) and `terraform apply`
- [ ] Add the real client secret value:
  ```bash
  printf '%s' 'SPOTIFY_SECRET' | gcloud secrets versions add ${ENV}-spotify-client-secret \
    --project=$PROJECT --data-file=-
  ```
- [ ] Leave `spotify_client_id` empty to disable — the app no-ops and the link is omitted (a placeholder secret is inert without the ID).

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

Migrations run as a **one-off Cloud Run Job** (`${ENV}-dml-migrate`, provisioned by Terraform) that executes `prisma migrate deploy` inside the VPC against private CloudSQL — no proxy needed. It uses a dedicated **migration image** built from `backend/Dockerfile --target migrate` (the slim API runtime image prunes the Prisma CLI).

Build/push the migration image and run the job (the CI workflow does this automatically — see §7):

```bash
REPO=$(cd infra && terraform output -raw artifact_registry_repo)
JOB=$(cd infra && terraform output -raw migrate_job_name)
docker build -f backend/Dockerfile --target migrate -t "$REPO/migrate:v1" .
docker push "$REPO/migrate:v1"
# Point the job at the freshly-built image, then run it.
gcloud run jobs update "$JOB" --image "$REPO/migrate:v1" --region $REGION --quiet
gcloud run jobs execute "$JOB" --region $REGION --wait
```

- [ ] Migration image built and pushed (tag matches `image_tag`)
- [ ] Migration job executed and **completed successfully** before deploying new API code
- [ ] (Fallback) Cloud SQL Auth Proxy from a VPC-connected host if you must run migrations manually

## 6. OAuth configuration

- [ ] In the Google Cloud Console OAuth client, add **Authorized redirect URI** `https://<domain>/api/auth/google/callback`
- [ ] Add **Authorized JavaScript origin** `https://<domain>`
- [ ] Confirm `APP_BASE_URL` and `OAUTH_REDIRECT_URI` env on Cloud Run match the domain (Terraform sets these from `domain`)

## 7. CI/CD (GitHub Actions)

[`deploy.yml`](../../.github/workflows/deploy.yml) is `workflow_dispatch` by default and authenticates via **Workload Identity Federation** (no long-lived keys). Configure repo/org settings:

- [ ] Repo **variables**: `GCP_PROJECT_ID`, `GCP_REGION`, `ARTIFACT_REPO`, `GCS_SPA_BUCKET`, `CLOUD_RUN_SERVICE`, `CLOUD_RUN_MIGRATE_JOB` (e.g. `prod-dml-migrate`), `WORKLOAD_IDENTITY_PROVIDER`, `DEPLOY_SERVICE_ACCOUNT`
- [ ] Workload Identity pool/provider bound to the deploy service account (roles: Artifact Registry writer, Cloud Run admin, Storage admin, Service Account user)
- [ ] Run the workflow (`image_tag`) and confirm it: builds + pushes the API and migration images, **runs the migration job (waits for success)**, deploys Cloud Run, syncs the SPA, and invalidates the CDN
- [ ] (Optional) flip the trigger to `push: branches: [main]` once verified

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
