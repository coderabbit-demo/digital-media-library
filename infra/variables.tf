# Input variables for the Digital Media Library infrastructure.
# Defaults are the smallest viable tiers for ~100 concurrent users (cost-aware);
# every sizing knob is parameterized so scale-up is a variable change, not a rewrite.

variable "project_id" {
  description = "GCP project ID to deploy into. Required."
  type        = string
}

variable "region" {
  description = "Primary GCP region for all regional resources."
  type        = string
  default     = "us-central1"
}

variable "env" {
  description = "Environment name (e.g. dev, staging, prod). Used as a resource name suffix and label."
  type        = string
  default     = "dev"
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

variable "subnet_cidr" {
  description = "Primary CIDR range for the application subnet."
  type        = string
  default     = "10.10.0.0/24"
}

variable "vpc_connector_cidr" {
  description = "Dedicated /28 CIDR for the Serverless VPC Access connector. Must not overlap subnet_cidr."
  type        = string
  default     = "10.10.8.0/28"
}

variable "vpc_connector_min_instances" {
  description = "Minimum instances for the Serverless VPC Access connector."
  type        = number
  default     = 2
}

variable "vpc_connector_max_instances" {
  description = "Maximum instances for the Serverless VPC Access connector."
  type        = number
  default     = 3
}

variable "vpc_connector_machine_type" {
  description = "Machine type for the Serverless VPC Access connector (smallest is e2-micro)."
  type        = string
  default     = "e2-micro"
}

# ---------------------------------------------------------------------------
# CloudSQL (PostgreSQL)
# ---------------------------------------------------------------------------

variable "cloudsql_tier" {
  description = "CloudSQL machine tier. Smallest shared-core default; e.g. db-custom-1-3840 for a dedicated vCPU."
  type        = string
  default     = "db-f1-micro"
}

variable "cloudsql_edition" {
  description = "CloudSQL edition. ENTERPRISE supports shared-core tiers (db-f1-micro); ENTERPRISE_PLUS requires db-perf-optimized tiers."
  type        = string
  default     = "ENTERPRISE"
}

variable "cloudsql_ha" {
  description = "Enable CloudSQL high availability (REGIONAL). Carries ~2x standing cost; off by default."
  type        = bool
  default     = false
}

variable "cloudsql_disk_size_gb" {
  description = "Initial CloudSQL data disk size in GB."
  type        = number
  default     = 10
}

variable "cloudsql_disk_autoresize" {
  description = "Allow CloudSQL to automatically grow the data disk."
  type        = bool
  default     = true
}

variable "cloudsql_version" {
  description = "CloudSQL PostgreSQL database version."
  type        = string
  default     = "POSTGRES_16"
}

variable "cloudsql_deletion_protection" {
  description = "Protect the CloudSQL instance from accidental deletion."
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Application database name."
  type        = string
  default     = "dml"
}

variable "db_user" {
  description = "Application database user name."
  type        = string
  default     = "dml"
}

# ---------------------------------------------------------------------------
# Memorystore (Redis)
# ---------------------------------------------------------------------------

variable "enable_redis" {
  description = "Provision Memorystore for Redis. Basic tier carries standing cost; toggle off for cheap demos."
  type        = bool
  default     = true
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis capacity in GB (Basic tier minimum is 1)."
  type        = number
  default     = 1
}

variable "redis_version" {
  description = "Memorystore Redis version."
  type        = string
  default     = "REDIS_7_0"
}

# ---------------------------------------------------------------------------
# Cloud Run (API)
# ---------------------------------------------------------------------------

variable "cloud_run_min_instances" {
  description = "Cloud Run minimum instances. 0 = scale to zero (cheapest, cold starts). Set >=1 to keep warm."
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Cloud Run maximum instances (autoscaling ceiling)."
  type        = number
  default     = 4
}

variable "cloud_run_cpu" {
  description = "Cloud Run CPU per instance (e.g. \"1\", \"2\")."
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run memory per instance (e.g. \"512Mi\", \"1Gi\")."
  type        = string
  default     = "512Mi"
}

variable "cloud_run_concurrency" {
  description = "Max concurrent requests per Cloud Run instance."
  type        = number
  default     = 80
}

variable "image_tag" {
  description = "Container image tag for the API to deploy (built and pushed to Artifact Registry separately)."
  type        = string
  default     = "latest"
}

variable "api_image_name" {
  description = "Image name (repository path component) for the API image within Artifact Registry."
  type        = string
  default     = "api"
}

variable "migrate_image_name" {
  description = "Image name for the Prisma migration runner (built from backend/Dockerfile --target migrate). Used by the one-off migration Cloud Run Job."
  type        = string
  default     = "migrate"
}

# ---------------------------------------------------------------------------
# SPA hosting / Load Balancer / TLS
# ---------------------------------------------------------------------------

variable "domain" {
  description = "Custom domain for the Google-managed TLS certificate (e.g. app.example.com). Empty disables the managed cert and HTTPS proxy."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Application runtime config (non-secret env)
# ---------------------------------------------------------------------------

variable "google_client_id" {
  description = "Google OIDC client ID (not a secret; the client SECRET goes to Secret Manager)."
  type        = string
  default     = ""
}

variable "spotify_client_id" {
  description = "Spotify Web API client ID for item-page 'Listen on Spotify' links (not a secret; the client SECRET goes to Secret Manager). Empty disables the links."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

variable "log_retention_days" {
  description = "Retention (days) for the dedicated Cloud Logging bucket."
  type        = number
  default     = 30
}
