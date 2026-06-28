# Useful outputs for operators and CI.

output "load_balancer_ip" {
  description = "Global external IP of the HTTPS load balancer. Point DNS for var.domain at this."
  value       = google_compute_global_address.lb_ip.address
}

output "app_url" {
  description = "Public application base URL (https://<domain> if set, else http://<lb-ip>)."
  value       = local.app_base_url
}

output "cloud_run_url" {
  description = "Direct Cloud Run service URL (ingress is LB-only; primarily for debugging/CI)."
  value       = google_cloud_run_v2_service.api.uri
}

output "cloudsql_connection_name" {
  description = "CloudSQL instance connection name (project:region:instance)."
  value       = google_sql_database_instance.main.connection_name
}

output "cloudsql_private_ip" {
  description = "Private IP address of the CloudSQL instance."
  value       = google_sql_database_instance.main.private_ip_address
}

output "artifact_registry_repo" {
  description = "Artifact Registry Docker repository for the API image."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}"
}

output "spa_bucket_name" {
  description = "Cloud Storage bucket hosting the built SPA. Upload static assets here."
  value       = google_storage_bucket.spa.name
}

output "redis_host" {
  description = "Memorystore Redis host (empty when enable_redis = false)."
  value       = var.enable_redis ? google_redis_instance.cache[0].host : ""
}

output "runtime_service_account" {
  description = "Email of the least-privilege Cloud Run runtime service account."
  value       = google_service_account.runtime.email
}

output "migrate_job_name" {
  description = "Cloud Run Job that applies Prisma migrations. Run: gcloud run jobs execute <name> --region <region> --wait"
  value       = google_cloud_run_v2_job.migrate.name
}

output "managed_cert_domain" {
  description = "Domain on the Google-managed TLS certificate (empty when no domain is configured)."
  value       = var.domain
}
