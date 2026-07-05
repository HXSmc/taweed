# EXECUTE §C — managed Postgres skeleton (build-plan §4). Tenant isolation is
# enforced at the app layer (RLS + composite same-tenant FKs, packages/db); this
# provisions the encrypted-at-rest managed instance. Commented until BLK-8 creds.

# resource "oci_psql_db_system" "taweed" {
#   compartment_id = var.compartment_ocid
#   db_version     = "16"
#   display_name   = "taweed-pg"
#   shape          = var.db_shape
#   # Encryption at rest is on by default for OCI managed Postgres (PDPL §6).
#   storage_details {
#     is_regionally_durable = true
#     system_type           = "OCI_OPTIMIZED_STORAGE"
#   }
#   network_details {
#     subnet_id = null # DEPLOY: private subnet in the KSA VCN
#   }
# }

output "postgres_endpoint" {
  description = "Managed Postgres endpoint (populated at DEPLOY)."
  value       = null
}
