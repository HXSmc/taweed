# infra/ — Terraform skeleton (DEPLOY-prep only, do NOT apply yet)

EXECUTE §C scaffolding. This is a **skeleton pinned to Oracle Cloud Riyadh
(`me-riyadh-1`)** for in-Kingdom, PDPL-compliant hosting (build-plan §4/§6/§10).
It is intentionally **not runnable**: no live infra is stood up this pass, and no
credentials exist. It documents the target shape so DEPLOY is a fill-in-creds +
`terraform apply`, not a design exercise.

## Blockers before apply (see docs/blocker.md)
- **BLK-8** — Oracle Cloud Riyadh account/creds, S3-compatible bucket, per-tenant
  KMS keys, managed-Postgres host.
- **BLK-12** — KSA privacy-counsel PDPL sign-off (data-flow, residency posture).
- **BLK-14** — external pen-test before GA.

## Safety
- Secrets/state are gitignored (`*.tfstate*`, `*.tfvars`, `*.pem`, `*.key`).
  Never commit real creds or state. Use a remote encrypted backend + a secrets
  manager at DEPLOY.
- `terraform.tfvars.example` shows the required variables with placeholder values.

## Files
- `main.tf` — provider (oci) + backend, region `me-riyadh-1`.
- `variables.tf` — inputs (compartment, region, db/store/kms config).
- `postgres.tf` — managed Postgres skeleton (RLS runs at the app layer already).
- `object-store.tf` — S3-compatible bucket, SSE AES-256.
- `kms.tf` — per-tenant KMS master keys (envelope encryption).
- `terraform.tfvars.example` — copy to `terraform.tfvars` (gitignored) and fill in.

## Portability
Keep it cloud-portable (Terraform, containers, Postgres, S3-compatible store) so
AWS `me-central-2` / Azure Saudi Arabia East (both Q4 2026-ish) stay swappable
(build-plan §4).
