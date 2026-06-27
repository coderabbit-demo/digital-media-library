# Secret Manager entries for runtime secrets (Principle IV: secrets never in source).
# - DB password and session signing key are generated here via random_password.
# - The Google OAuth client secret value is added OUT-OF-BAND (see note below):
#   Terraform creates the secret container but NOT a version with the real value.
# The runtime service account is granted accessor on each secret in iam.tf-style
# bindings co-located here for cohesion.

locals {
  # Common label set applied to secrets.
  secret_labels = {
    app = "digital-media-library"
    env = var.env
  }
}

# --- Generated secret values ------------------------------------------------

resource "random_password" "db_password" {
  length  = 32
  special = false # avoid URL-encoding pitfalls in DATABASE_URL
}

resource "random_password" "session_signing_key" {
  length  = 48
  special = true
}

# --- DB password secret -----------------------------------------------------

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.env}-db-password"
  labels    = local.secret_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# --- Session signing key secret --------------------------------------------

resource "google_secret_manager_secret" "session_signing_key" {
  secret_id = "${var.env}-session-signing-key"
  labels    = local.secret_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "session_signing_key" {
  secret      = google_secret_manager_secret.session_signing_key.id
  secret_data = random_password.session_signing_key.result
}

# --- Google OAuth client secret --------------------------------------------
# NOTE: The container is created here, but the secret VALUE must be added
# out-of-band (it is issued by Google and not known to Terraform), e.g.:
#   gcloud secrets versions add <env>-google-oauth-client-secret \
#     --data-file=- <<< "the-client-secret-from-google-console"
# lifecycle.ignore_changes is not needed on the secret itself; we simply do not
# manage a version resource for it so manually-added versions are not clobbered.

resource "google_secret_manager_secret" "google_oauth_client_secret" {
  secret_id = "${var.env}-google-oauth-client-secret"
  labels    = local.secret_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

# --- DATABASE_URL secret ----------------------------------------------------
# Convenience secret so the app can read a single DATABASE_URL env. Points at the
# CloudSQL private IP. Defined here because it depends on the generated password
# and the SQL instance private IP.

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.env}-database-url"
  labels    = local.secret_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = format(
    "postgresql://%s:%s@%s:5432/%s?schema=public",
    var.db_user,
    random_password.db_password.result,
    google_sql_database_instance.main.private_ip_address,
    var.db_name,
  )
}

# --- REDIS_URL secret (only when Redis is enabled) -------------------------

resource "google_secret_manager_secret" "redis_url" {
  count     = var.enable_redis ? 1 : 0
  secret_id = "${var.env}-redis-url"
  labels    = local.secret_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "redis_url" {
  count  = var.enable_redis ? 1 : 0
  secret = google_secret_manager_secret.redis_url[0].id
  secret_data = format(
    "redis://%s:%s",
    google_redis_instance.cache[0].host,
    google_redis_instance.cache[0].port,
  )
}

# --- Discover provider keys (feature 003) -----------------------------------
# Containers + a placeholder version so Cloud Run can reference "latest" on the
# first deploy. Replace each with the real value out-of-band, e.g.:
#   gcloud secrets versions add ${var.env}-nyt-api-key --data-file=- <<< "REAL_KEY"
# The app treats a placeholder/unconfigured key as "provider unavailable"
# (Discover serves cached/empty for that category), so it never breaks startup.

resource "google_secret_manager_secret" "nyt_api_key" {
  secret_id = "${var.env}-nyt-api-key"
  labels    = local.secret_labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "nyt_api_key_placeholder" {
  secret      = google_secret_manager_secret.nyt_api_key.id
  secret_data = "REPLACE_ME"
}

resource "google_secret_manager_secret" "spotify_client_id" {
  secret_id = "${var.env}-spotify-client-id"
  labels    = local.secret_labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "spotify_client_id_placeholder" {
  secret      = google_secret_manager_secret.spotify_client_id.id
  secret_data = "REPLACE_ME"
}

resource "google_secret_manager_secret" "spotify_client_secret" {
  secret_id = "${var.env}-spotify-client-secret"
  labels    = local.secret_labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "spotify_client_secret_placeholder" {
  secret      = google_secret_manager_secret.spotify_client_secret.id
  secret_data = "REPLACE_ME"
}

resource "google_secret_manager_secret" "google_books_api_key" {
  secret_id = "${var.env}-google-books-api-key"
  labels    = local.secret_labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "google_books_api_key_placeholder" {
  secret      = google_secret_manager_secret.google_books_api_key.id
  secret_data = "REPLACE_ME"
}

# --- Accessor bindings: grant the runtime SA read on each secret -----------

locals {
  # Map of logical name -> secret_id for accessor grants. Conditionally includes
  # the redis url secret.
  runtime_secret_ids = merge(
    {
      db_password           = google_secret_manager_secret.db_password.secret_id
      session_signing_key   = google_secret_manager_secret.session_signing_key.secret_id
      oauth_client_secret   = google_secret_manager_secret.google_oauth_client_secret.secret_id
      database_url          = google_secret_manager_secret.database_url.secret_id
      nyt_api_key           = google_secret_manager_secret.nyt_api_key.secret_id
      spotify_client_id     = google_secret_manager_secret.spotify_client_id.secret_id
      spotify_client_secret = google_secret_manager_secret.spotify_client_secret.secret_id
      google_books_api_key  = google_secret_manager_secret.google_books_api_key.secret_id
    },
    var.enable_redis ? {
      redis_url = google_secret_manager_secret.redis_url[0].secret_id
    } : {},
  )
}

resource "google_secret_manager_secret_iam_member" "runtime_accessor" {
  for_each  = local.runtime_secret_ids
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
