# EXECUTE §C — inputs for the KSA-region skeleton. Real values go in
# terraform.tfvars (gitignored) or the secrets manager, never here.

variable "region" {
  description = "OCI region — pinned in-Kingdom for PDPL residency."
  type        = string
  default     = "me-riyadh-1"
}

variable "compartment_ocid" {
  description = "Target compartment OCID (BLK-8)."
  type        = string
  default     = "" # fill at DEPLOY
}

variable "db_shape" {
  description = "Managed Postgres shape."
  type        = string
  default     = "PostgreSQL.VM.Standard.E4.Flex"
}

variable "object_store_namespace" {
  description = "Object Storage namespace for the S3-compatible endpoint."
  type        = string
  default     = "" # fill at DEPLOY
}

variable "kms_tenant_ids" {
  description = "Tenants that get a dedicated KMS master key (per-tenant envelope keys)."
  type        = list(string)
  default     = []
}
