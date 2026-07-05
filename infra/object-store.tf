# EXECUTE §C — S3-compatible object store for raw bundles / appeal PDFs / docs
# (build-plan §3/§4). SSE AES-256 at rest (PDPL §6). App keys objects per tenant
# (packages/platform ObjectStore.tenantKey). Commented until BLK-8 creds.

# resource "oci_objectstorage_bucket" "taweed_docs" {
#   compartment_id = var.compartment_ocid
#   namespace      = var.object_store_namespace
#   name           = "taweed-docs"
#   access_type    = "NoPublicAccess"
#   versioning     = "Enabled"
#   # Server-side encryption at rest is on by default; a per-tenant KMS key can be
#   # bound here for envelope encryption (see kms.tf).
#   kms_key_id     = null # DEPLOY: bind a KMS key for SSE-KMS
# }

output "object_store_bucket" {
  description = "Object Storage bucket name (populated at DEPLOY)."
  value       = null
}
