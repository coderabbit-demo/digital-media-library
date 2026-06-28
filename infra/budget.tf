# Billing budget + alerts for this application.
#
# Budgets are billing-ACCOUNT resources, so this requires a role on the billing
# account (e.g. roles/billing.costsManager or roles/billing.admin) — separate
# from project IAM. Gated on `billing_account`: leave it empty to skip.
#
# Scope: the project filtered to this app's resources (label app=digital-media-
# library). Note label-based filtering only counts billing line items that carry
# the label; on a shared project this avoids alerting on unrelated workloads.

data "google_project" "current" {
  count      = var.billing_account != "" ? 1 : 0
  project_id = var.project_id
}

# Email channel so the alert reaches a specific person regardless of billing IAM.
resource "google_monitoring_notification_channel" "budget_email" {
  count        = var.billing_account != "" && var.budget_alert_email != "" ? 1 : 0
  project      = var.project_id
  display_name = "${var.env}-dml budget alerts"
  type         = "email"
  labels       = { email_address = var.budget_alert_email }

  depends_on = [google_project_service.services]
}

resource "google_billing_budget" "app" {
  count           = var.billing_account != "" ? 1 : 0
  billing_account = var.billing_account
  display_name    = "${var.env}-dml (${var.budget_amount} USD/mo)"

  budget_filter {
    projects        = ["projects/${data.google_project.current[0].number}"]
    labels          = { app = "digital-media-library" }
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount)
    }
  }

  # Alert at 50% / 90% / 100% of actual spend, plus 100% of forecasted spend.
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  dynamic "all_updates_rule" {
    for_each = var.budget_alert_email != "" ? [1] : []
    content {
      monitoring_notification_channels = [google_monitoring_notification_channel.budget_email[0].id]
      # Also keep emailing the billing account's admins/users.
      disable_default_iam_recipients = false
    }
  }

  depends_on = [google_project_service.services]
}
