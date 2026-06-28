# GCP Deployment (Planned)

The canonical production target: a fully-private GCP stack provisioned by Terraform in [`infra/`](../../infra/) and deployed by [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).

**What Terraform creates** (see [`infra/README.md`](../../infra/README.md)): Artifact Registry, VPC + Serverless VPC Access connector + Private Services Access, **CloudSQL PostgreSQL** (private IP), **Memorystore Redis**, **Cloud Run v2** API (least-privilege SA, secrets from Secret Manager, LB-only ingress), **SPA hosting** (GCS bucket + global external HTTPS LB + Cloud CDN, URL map sends `/api/*` → Cloud Run, everything else → bucket), **Secret Manager**, and **Cloud Logging**.

> Region defaults to `us-central1`; everything is sized smallest-by-default and parameterized. Cost knobs: `enable_redis=false`, `cloud_run_min_instances=0`.

---

## Prerequisites

- [ ] Terraform ≥ 1.6 and `gcloud` installed
- [ ] **Application Default Credentials** for Terraform: `gcloud auth application-default login`. This is **separate** from the `gcloud` CLI login — Terraform uses ADC, and an expired/reauth-required ADC session fails with `invalid_grant ... invalid_rapt`. (Optionally `gcloud auth application-default set-quota-project <project>`.)
- [ ] A GCP project with **billing enabled** (Terraform enables the needed APIs)
- [ ] Docker with **buildx** (the API runs on Cloud Run = linux/amd64; on Apple Silicon you **must** build `--platform linux/amd64`), or rely on the CI workflow
- [ ] A **Google OAuth 2.0 client** (Web application) — needed for sign-in. Sign-in also needs **HTTPS**, which the LB only gets with a `domain` (managed cert). You can deploy IP-only first and add the domain + OAuth client afterward.

---

> **Order matters (chicken-and-egg).** The Cloud Run service references the API image and the OAuth secret's `latest` version, so both must exist *before* a full `terraform apply`, and the Artifact Registry repo (which holds the image) is itself created by Terraform. So: bootstrap the repo + OAuth secret → build/push images + seed the OAuth secret → full apply. The steps below follow that order.

## 1. Configure + initialize

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
```

- [ ] Set `project_id`, `env` (e.g. `prod`), `region`
- [ ] `google_client_id` — set the real OAuth client ID, **or a placeholder like `placeholder.apps.googleusercontent.com`** for an IP-only first deploy (the app's config requires a non-empty value to boot; sign-in stays inert until a real ID + domain are set)
- [ ] `domain` — `app.example.com` for managed TLS + HTTP→HTTPS redirect (then point an `A` record at the `load_balancer_ip` output), or `""` to serve over the LB IP (HTTP)
- [ ] Sizing reviewed: `cloud_run_min_instances` (0 = scale-to-zero/cold starts; ≥1 = warm), `enable_redis`, `cloudsql_ha`, `cloudsql_deletion_protection`
- [ ] `cloudsql_edition` defaults to `ENTERPRISE` (required for shared-core tiers like `db-f1-micro`; new projects otherwise default to ENTERPRISE_PLUS, which rejects them)

## 1a. Bootstrap the registry + OAuth secret container

```bash
terraform apply \
  -target=google_artifact_registry_repository.api \
  -target=google_secret_manager_secret.google_oauth_client_secret
```

- [ ] Repo + OAuth secret container created; note `artifact_registry_repo`

Then seed the OAuth client secret **before** the service is created (Cloud Run can't start if `<env>-google-oauth-client-secret` has no version — a placeholder is fine for an IP-only deploy):

```bash
printf '%s' 'THE-CLIENT-SECRET-OR-placeholder' | \
  gcloud secrets versions add ${ENV}-google-oauth-client-secret --project=$PROJECT --data-file=-
```

## 1b. Full apply

After pushing both images (§3) and seeding the OAuth secret above:

```bash
terraform apply      # uses terraform.tfvars
```

- [ ] `terraform apply` completed (**CloudSQL alone takes ~10–15 min**)
- [ ] Note outputs: `load_balancer_ip` (the app URL), `artifact_registry_repo`, `spa_bucket_name`, `migrate_job_name`

## 2. Secrets (Secret Manager)

Terraform generates `db-password`, `session-signing-key`, `database-url`, and `redis-url` itself, and creates **placeholder** versions for the provider keys. The OAuth client secret is seeded in §1a. The optional provider keys can be replaced any time:

```bash
printf '%s' 'NYT_KEY'          | gcloud secrets versions add ${ENV}-nyt-api-key          --project=$PROJECT --data-file=-
printf '%s' 'GOOGLE_BOOKS_KEY' | gcloud secrets versions add ${ENV}-google-books-api-key --project=$PROJECT --data-file=-
```

- [ ] `${ENV}-google-oauth-client-secret` has a version (seeded in §1a; replace placeholder with the real value when OAuth is set up)
- [ ] `${ENV}-nyt-api-key` / `${ENV}-google-books-api-key` set (optional; placeholders are inert — Discover still works via keyless Google Books/Apple)
- [ ] Runtime SA has `secretAccessor` on each (Terraform grants this via `runtime_secret_ids`)

> **Adding/replacing a secret version requires a new Cloud Run revision to pick it up** — secrets are resolved at deploy time. After updating a secret, redeploy: `gcloud run services update ${ENV}-dml-api --region $REGION` (or re-run `terraform apply`).

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

## 3. Build & push the images (before §1b)

Both the API and migration images are the multi-stage [`backend/Dockerfile`](../../backend/Dockerfile) (built from the repo root for workspace context). **Build for linux/amd64** — Cloud Run won't run an arm64 image (Apple Silicon default):

```bash
REPO=$(cd infra && terraform output -raw artifact_registry_repo)
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
# API (runtime) image
docker buildx build --platform linux/amd64 -f backend/Dockerfile -t "$REPO/api:${TAG}" --push .
# Migration image (Prisma CLI; used by the migrate Job)
docker buildx build --platform linux/amd64 -f backend/Dockerfile --target migrate -t "$REPO/migrate:${TAG}" --push .
```

- [ ] Both images built `--platform linux/amd64` and pushed (`${TAG}` matches `image_tag`, default `latest`)
- [ ] Proceed to **§1b** (full apply), which creates the Cloud Run service from `api:${TAG}`

## 4. Publish the SPA

Build with the API on the same origin (so `VITE_API_BASE_URL` defaults to `/api`) and sync to the hosting bucket:

```bash
BUCKET=$(cd infra && terraform output -raw spa_bucket_name)
corepack pnpm --filter @dml/frontend build
gcloud storage rsync frontend/dist gs://$BUCKET \
  --recursive --delete-unmatched-destination-objects
gcloud compute url-maps invalidate-cdn-cache ${ENV}-dml-urlmap --path "/*" --async || true
```

- [ ] SPA built and synced to the bucket (`spa_bucket_name` output)
- [ ] CDN cache invalidated (url map `${ENV}-dml-urlmap`)

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
