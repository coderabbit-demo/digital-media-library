# Core architecture for the Digital Media Library:
#   APIs -> Artifact Registry -> VPC + connector + private services access ->
#   CloudSQL (private IP) + Memorystore -> Cloud Run (API) ->
#   Cloud Storage SPA + global HTTPS LB + Cloud CDN (path-route /api/* to Cloud Run).
#
# Sized smallest-by-default for ~100 concurrent users; everything parameterized.

locals {
  common_labels = {
    app = "digital-media-library"
    env = var.env
  }

  # Region-scoped Artifact Registry image references.
  api_image     = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/${var.api_image_name}:${var.image_tag}"
  migrate_image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/${var.migrate_image_name}:${var.image_tag}"
}

# ---------------------------------------------------------------------------
# Enable required Google APIs
# ---------------------------------------------------------------------------

resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "servicenetworking.googleapis.com",
    "logging.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  # Keep APIs enabled even if removed from this set; don't disable on destroy to
  # avoid breaking shared projects.
  disable_on_destroy         = false
  disable_dependent_services = false
}

# ---------------------------------------------------------------------------
# Artifact Registry (Docker) for the API image
# ---------------------------------------------------------------------------

resource "google_artifact_registry_repository" "api" {
  location      = var.region
  repository_id = "${var.env}-dml"
  description   = "Docker images for the Digital Media Library API."
  format        = "DOCKER"
  labels        = local.common_labels

  depends_on = [google_project_service.services]
}

# ---------------------------------------------------------------------------
# VPC network + subnet
# ---------------------------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = "${var.env}-dml-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.services]
}

resource "google_compute_subnetwork" "subnet" {
  name                     = "${var.env}-dml-subnet"
  ip_cidr_range            = var.subnet_cidr
  region                   = var.region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = true
}

# ---------------------------------------------------------------------------
# Serverless VPC Access connector (Cloud Run -> private CloudSQL/Redis)
# ---------------------------------------------------------------------------

resource "google_vpc_access_connector" "connector" {
  name          = "${var.env}-dml-vpc-conn"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = var.vpc_connector_cidr

  min_instances = var.vpc_connector_min_instances
  max_instances = var.vpc_connector_max_instances
  machine_type  = var.vpc_connector_machine_type

  depends_on = [google_project_service.services]
}

# ---------------------------------------------------------------------------
# Private Services Access (servicenetworking) for CloudSQL private IP
# ---------------------------------------------------------------------------

resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.env}-dml-psa-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]

  depends_on = [google_project_service.services]
}

# ---------------------------------------------------------------------------
# CloudSQL PostgreSQL (private IP)
# ---------------------------------------------------------------------------

resource "google_sql_database_instance" "main" {
  name             = "${var.env}-dml-pg"
  region           = var.region
  database_version = var.cloudsql_version

  deletion_protection = var.cloudsql_deletion_protection

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.services,
  ]

  settings {
    tier              = var.cloudsql_tier
    availability_type = var.cloudsql_ha ? "REGIONAL" : "ZONAL"
    disk_size         = var.cloudsql_disk_size_gb
    disk_autoresize   = var.cloudsql_disk_autoresize
    disk_type         = "PD_SSD"

    user_labels = local.common_labels

    ip_configuration {
      # Private IP only — database is not exposed to the public internet.
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled = true
      # Point-in-time recovery requires WAL archiving; cheap and useful.
      point_in_time_recovery_enabled = true
    }

    # Smallest-footprint maintenance defaults.
    maintenance_window {
      day  = 7 # Sunday
      hour = 4
    }
  }
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# ---------------------------------------------------------------------------
# Memorystore for Redis (Basic tier) — gated by var.enable_redis
# ---------------------------------------------------------------------------

resource "google_redis_instance" "cache" {
  count = var.enable_redis ? 1 : 0

  name           = "${var.env}-dml-redis"
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region
  redis_version  = var.redis_version

  # Private services access for direct peering on the same VPC.
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  authorized_network      = google_compute_network.vpc.id
  transit_encryption_mode = "DISABLED"

  labels = local.common_labels

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.services,
  ]
}

# ---------------------------------------------------------------------------
# Cloud Run v2 service (API)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name     = "${var.env}-dml-api"
  location = var.region

  # Internal + load-balancer ingress only; public traffic arrives via the LB.
  ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  labels = local.common_labels

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    max_instance_request_concurrency = var.cloud_run_concurrency

    # Egress to private CloudSQL/Redis through the Serverless VPC connector.
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = local.api_image

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      ports {
        container_port = 8080
      }

      # --- Non-secret runtime config ---
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "APP_BASE_URL"
        value = local.app_base_url
      }
      env {
        name  = "OAUTH_REDIRECT_URI"
        value = "${local.app_base_url}/api/auth/google/callback"
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      # --- Secrets from Secret Manager ---
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_oauth_client_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SESSION_SIGNING_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_signing_key.secret_id
            version = "latest"
          }
        }
      }

      # Discover (feature 003) provider keys. Optional at runtime: a placeholder
      # value just makes that category serve cached/empty.
      env {
        name = "NYT_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.nyt_api_key.secret_id
            version = "latest"
          }
        }
      }
      # Music, audiobooks, and podcasts use Apple's keyless RSS feeds — no env needed.
      env {
        name = "GOOGLE_BOOKS_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_books_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Spotify (feature 007 item-page links). Client ID is non-secret; the app
      # only calls Spotify when the ID is set, so an unset ID disables the links.
      env {
        name  = "SPOTIFY_CLIENT_ID"
        value = var.spotify_client_id
      }
      env {
        name = "SPOTIFY_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.spotify_client_secret.secret_id
            version = "latest"
          }
        }
      }

      # REDIS_URL only when Redis is enabled.
      dynamic "env" {
        for_each = var.enable_redis ? [1] : []
        content {
          name = "REDIS_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.redis_url[0].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_iam_member.runtime_accessor,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.session_signing_key,
  ]
}

# ---------------------------------------------------------------------------
# Database migrations: one-off Cloud Run Job (Prisma `migrate deploy`)
# ---------------------------------------------------------------------------
# Runs inside the VPC (reaches private CloudSQL via the connector) using the
# migration image (backend/Dockerfile --target migrate, which keeps the Prisma
# CLI the slim API image prunes). Execute it before serving new traffic:
#   gcloud run jobs execute ${env}-dml-migrate --region <region> --wait
resource "google_cloud_run_v2_job" "migrate" {
  name     = "${var.env}-dml-migrate"
  location = var.region
  labels   = local.common_labels

  template {
    template {
      service_account = google_service_account.runtime.email
      max_retries     = 1
      timeout         = "600s"

      vpc_access {
        connector = google_vpc_access_connector.connector.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image = local.migrate_image

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_iam_member.runtime_accessor,
    google_secret_manager_secret_version.database_url,
    google_sql_database.app,
  ]
}

# ---------------------------------------------------------------------------
# SPA hosting: Cloud Storage bucket (website)
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "spa" {
  name          = "${var.project_id}-${var.env}-dml-spa"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    # SPA client-side routing: serve index.html for unknown paths via the LB
    # 404 handling; not_found_page keeps direct-bucket access usable too.
    not_found_page = "index.html"
  }

  labels = local.common_labels

  depends_on = [google_project_service.services]
}

# Make objects publicly readable (served via CDN/LB). Bucket is static SPA assets.
resource "google_storage_bucket_iam_member" "spa_public_read" {
  bucket = google_storage_bucket.spa.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ---------------------------------------------------------------------------
# Global external HTTPS Load Balancer + Cloud CDN
# ---------------------------------------------------------------------------

# Reserved global IP for the load balancer.
resource "google_compute_global_address" "lb_ip" {
  name = "${var.env}-dml-lb-ip"

  depends_on = [google_project_service.services]
}

# Backend bucket (SPA static assets) with Cloud CDN.
resource "google_compute_backend_bucket" "spa" {
  name        = "${var.env}-dml-spa-backend"
  bucket_name = google_storage_bucket.spa.name
  enable_cdn  = true

  cdn_policy {
    cache_mode  = "CACHE_ALL_STATIC"
    client_ttl  = 3600
    default_ttl = 3600
    max_ttl     = 86400
  }
}

# Serverless NEG pointing at the Cloud Run API.
resource "google_compute_region_network_endpoint_group" "api_neg" {
  name                  = "${var.env}-dml-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

# Backend service fronting the Cloud Run NEG.
resource "google_compute_backend_service" "api" {
  name                  = "${var.env}-dml-api-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.api_neg.id
  }
}

# URL map: /api/* -> Cloud Run, everything else -> SPA bucket.
resource "google_compute_url_map" "default" {
  name            = "${var.env}-dml-urlmap"
  default_service = google_compute_backend_bucket.spa.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_bucket.spa.id

    path_rule {
      paths   = ["/api", "/api/*"]
      service = google_compute_backend_service.api.id
    }
  }
}

# --- TLS / front ends -------------------------------------------------------
# When var.domain is set, provision a Google-managed cert + HTTPS proxy and an
# HTTP->HTTPS redirect. Otherwise expose plain HTTP only (e.g. for IP-based demos).

resource "google_compute_managed_ssl_certificate" "default" {
  count = var.domain != "" ? 1 : 0
  name  = "${var.env}-dml-cert"

  managed {
    domains = [var.domain]
  }
}

# HTTPS path (only when a domain/managed cert exists).
resource "google_compute_target_https_proxy" "https" {
  count            = var.domain != "" ? 1 : 0
  name             = "${var.env}-dml-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default[0].id]
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = var.domain != "" ? 1 : 0
  name                  = "${var.env}-dml-https-fr"
  target                = google_compute_target_https_proxy.https[0].id
  ip_address            = google_compute_global_address.lb_ip.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# HTTP->HTTPS redirect URL map (only when a domain exists).
resource "google_compute_url_map" "https_redirect" {
  count = var.domain != "" ? 1 : 0
  name  = "${var.env}-dml-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http" {
  name = "${var.env}-dml-http-proxy"
  # Redirect to HTTPS when a domain exists; otherwise serve the app over HTTP.
  url_map = var.domain != "" ? google_compute_url_map.https_redirect[0].id : google_compute_url_map.default.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.env}-dml-http-fr"
  target                = google_compute_target_http_proxy.http.id
  ip_address            = google_compute_global_address.lb_ip.id
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# Allow the load balancer (serverless NEG) to invoke the Cloud Run service.
# Public reachability is mediated by the LB; the service ingress is LB-only.
resource "google_cloud_run_v2_service_iam_member" "lb_invoker" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Derived app base URL (domain if set, else the LB IP over http)
# ---------------------------------------------------------------------------

locals {
  app_base_url = var.domain != "" ? "https://${var.domain}" : "http://${google_compute_global_address.lb_ip.address}"
}
