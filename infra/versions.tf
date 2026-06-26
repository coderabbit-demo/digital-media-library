# Terraform and provider version pinning.
# Constitution: all GCP resources are provisioned via Terraform (IaC constraint).

terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.30, < 7.0"
    }
    # google-beta is used for resources/fields that are only available in the
    # beta provider (none strictly required today, but declared for forward use).
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.30, < 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
