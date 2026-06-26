# Least-privilege IAM (Principle IV/V).
# A dedicated runtime service account for Cloud Run with only the roles it needs:
#   - Cloud SQL Client (connect to the instance)
#   - Logging Log Writer (emit structured logs)
#   - Secret accessor is granted per-secret in secrets.tf (narrow scope)
# No broad primitive roles (owner/editor/viewer) are used.

resource "google_service_account" "runtime" {
  account_id   = "${var.env}-dml-api-run"
  display_name = "Digital Media Library API runtime (${var.env})"
  description  = "Least-privilege runtime identity for the Cloud Run API service."
}

# Connect to CloudSQL (uses private IP via the VPC connector; role still required).
resource "google_project_iam_member" "runtime_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Write application logs to Cloud Logging.
resource "google_project_iam_member" "runtime_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Memorystore access is via private IP on the VPC; no dedicated IAM role is
# required for the Redis data path. (Redis AUTH/IAM is not enabled on Basic tier.)

# Allow the runtime SA to pull the image from Artifact Registry.
resource "google_artifact_registry_repository_iam_member" "runtime_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.api.location
  repository = google_artifact_registry_repository.api.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.runtime.email}"
}
