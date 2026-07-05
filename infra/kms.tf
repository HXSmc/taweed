# EXECUTE §C — per-tenant KMS master keys for envelope encryption (build-plan §6,
# packages/platform TenantKms). One key per tenant so a tenant's PHI is
# cryptographically isolated. Commented until BLK-8 creds.

# resource "oci_kms_vault" "taweed" {
#   compartment_id = var.compartment_ocid
#   display_name   = "taweed-vault"
#   vault_type     = "DEFAULT"
# }

# resource "oci_kms_key" "tenant" {
#   for_each       = toset(var.kms_tenant_ids)
#   compartment_id = var.compartment_ocid
#   display_name   = "taweed-tenant-${each.key}"
#   management_endpoint = null # oci_kms_vault.taweed.management_endpoint
#   key_shape {
#     algorithm = "AES"
#     length    = 32 # 256-bit
#   }
# }

output "kms_key_ids" {
  description = "Per-tenant KMS key OCIDs (populated at DEPLOY)."
  value       = {}
}
