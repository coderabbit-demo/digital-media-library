# Cloud Logging: explicit retention bucket + project sink (constitution: logging
# enabled via Terraform, retention configured). Cloud Logging is on by default;
# here we make retention and routing explicit and version-controlled.

# Dedicated log bucket with configurable retention.
resource "google_logging_project_bucket_config" "app_logs" {
  project        = var.project_id
  location       = "global"
  bucket_id      = "${var.env}-dml-app-logs"
  retention_days = var.log_retention_days
  description    = "Application + infra logs for Digital Media Library (${var.env})."

  depends_on = [google_project_service.services]
}

# Route Cloud Run service logs and relevant resource logs into the bucket above.
resource "google_logging_project_sink" "app_sink" {
  name        = "${var.env}-dml-app-sink"
  description = "Routes Cloud Run + CloudSQL + Redis + LB logs to the app log bucket."

  # Destination is the dedicated log bucket created above.
  destination = "logging.googleapis.com/${google_logging_project_bucket_config.app_logs.id}"

  # Filter: Cloud Run service, CloudSQL, Memorystore, and the HTTPS load balancer.
  filter = join(" OR ", [
    "resource.type=\"cloud_run_revision\"",
    "resource.type=\"cloudsql_database\"",
    "resource.type=\"redis_instance\"",
    "resource.type=\"http_load_balancer\"",
  ])

  # Sink writing into a log bucket in the same project does not require a
  # separate writer identity grant, but we keep a unique writer identity.
  unique_writer_identity = true
}
