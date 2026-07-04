// App-level RBAC (build-plan §7 User; design-brief §7 role-aware nav). Role is
// server-enforced: it comes from the verified session and cannot be changed from
// the UI. The rail renders modules conditionally; actions check the capability
// level. Rail order follows the recovery loop, not alphabetical.

export type Role = "owner" | "finance" | "rcm" | "clinician" | "admin";
export type ModuleKey =
  | "overview"
  | "analytics"
  | "ingest"
  | "scrubber"
  | "appeals"
  | "recovery"
  | "settings";

/** Capability level for a (role, module). "hidden" removes it from the rail. */
export type Level =
  | "full"
  | "read"
  | "upload"
  | "hidden"
  | "flag-only"
  | "approve"
  | "review"
  | "evidence"
  | "limited"
  | "rules";

export const MODULE_ORDER: ModuleKey[] = [
  "overview",
  "analytics",
  "ingest",
  "scrubber",
  "appeals",
  "recovery",
  "settings",
];

// Exactly the matrix in design-brief §7.
const MATRIX: Record<ModuleKey, Record<Role, Level>> = {
  overview: { owner: "full", finance: "full", rcm: "full", clinician: "read", admin: "read" },
  analytics: { owner: "full", finance: "full", rcm: "full", clinician: "read", admin: "read" },
  ingest: { owner: "hidden", finance: "upload", rcm: "full", clinician: "hidden", admin: "full" },
  scrubber: { owner: "read", finance: "read", rcm: "full", clinician: "flag-only", admin: "read" },
  appeals: { owner: "approve", finance: "review", rcm: "full", clinician: "evidence", admin: "read" },
  recovery: { owner: "full", finance: "full", rcm: "full", clinician: "hidden", admin: "read" },
  settings: { owner: "full", finance: "limited", rcm: "rules", clinician: "hidden", admin: "full" },
};

export function capability(role: Role, module: ModuleKey): Level {
  return MATRIX[module][role];
}

export function isVisible(role: Role, module: ModuleKey): boolean {
  return capability(role, module) !== "hidden";
}

/** Visible modules for a role, in rail order. */
export function navModules(role: Role): ModuleKey[] {
  return MODULE_ORDER.filter((m) => isVisible(role, m));
}

/** Can this role perform a write-class action in a module? */
export function canWrite(role: Role, module: ModuleKey): boolean {
  const level = capability(role, module);
  return level === "full" || level === "upload" || level === "rules";
}

/** The module a role should land on (design-brief §7): owner→Overview, rcm→Analytics. */
export function landingModule(role: Role): ModuleKey {
  if (role === "rcm") return "analytics";
  return "overview";
}

const ROLES: Role[] = ["owner", "finance", "rcm", "clinician", "admin"];
export function isRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}
