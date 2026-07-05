# EXECUTE §C — Terraform skeleton, Oracle Cloud Riyadh (me-riyadh-1). DO NOT APPLY:
# no live infra this pass (build-plan §4/§10). Fill creds at DEPLOY (BLK-8).

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }

  # DEPLOY: use a remote, encrypted, in-Kingdom state backend. NEVER commit state.
  # backend "s3" {
  #   bucket   = "taweed-tfstate"
  #   key      = "prod/terraform.tfstate"
  #   region   = "me-riyadh-1"
  #   endpoint = "https://<namespace>.compat.objectstorage.me-riyadh-1.oraclecloud.com"
  #   encrypt  = true
  # }
}

# Region pinned in-Kingdom for PDPL data residency (build-plan §6). Auth config
# (tenancy/user/fingerprint/key) comes from the OCI CLI profile or env, NEVER here.
provider "oci" {
  region = var.region
}
