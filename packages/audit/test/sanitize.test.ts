import { describe, expect, it } from "vitest";
import { sanitizeAuditEntry, type AuditEntry } from "../src/index.js";

// Table-driven. The guard is the ONLY thing standing between a caller that
// spreads a PHI-laden record and the append-only audit trail, so both halves
// matter: valid entries must round-trip UNCHANGED, and anything carrying a
// non-whitelisted key (or missing a required one) must throw loudly.

interface ValidCase {
  name: string;
  input: Record<string, unknown>;
  expected: AuditEntry;
}

// One row per AuditAction so every action is exercised end to end.
const validCases: readonly ValidCase[] = [
  {
    name: "read, no ip",
    input: { actor: "user-1", action: "read", entity: "claim", entityId: "c-1" },
    expected: { actor: "user-1", action: "read", entity: "claim", entityId: "c-1" },
  },
  {
    name: "write, with ip",
    input: {
      actor: "user-2",
      action: "write",
      entity: "denial",
      entityId: "d-1",
      ip: "10.0.0.1",
    },
    expected: {
      actor: "user-2",
      action: "write",
      entity: "denial",
      entityId: "d-1",
      ip: "10.0.0.1",
    },
  },
  {
    name: "export, no ip",
    input: {
      actor: "user-3",
      action: "export",
      entity: "report",
      entityId: "r-1",
    },
    expected: {
      actor: "user-3",
      action: "export",
      entity: "report",
      entityId: "r-1",
    },
  },
];

describe("sanitizeAuditEntry — valid entries pass through unchanged", () => {
  it.each(validCases)("$name", ({ input, expected }) => {
    expect(sanitizeAuditEntry(input)).toEqual(expected);
  });
});

interface ThrowCase {
  name: string;
  input: Record<string, unknown>;
}

const throwingCases: readonly ThrowCase[] = [
  // Extra keys = a PHI-laden record spread into the entry — must be rejected.
  {
    name: "extra key patientName (PHI leak)",
    input: {
      actor: "u",
      action: "read",
      entity: "claim",
      entityId: "c-1",
      patientName: "Ali",
    },
  },
  {
    name: "extra key dob (PHI leak)",
    input: {
      actor: "u",
      action: "read",
      entity: "claim",
      entityId: "c-1",
      dob: "1990-01-01",
    },
  },
  {
    name: "extra key ssn (PHI leak)",
    input: {
      actor: "u",
      action: "write",
      entity: "claim",
      entityId: "c-1",
      ssn: "1234567890",
    },
  },
  // Missing required keys.
  {
    name: "missing actor",
    input: { action: "read", entity: "claim", entityId: "c-1" },
  },
  {
    name: "missing action",
    input: { actor: "u", entity: "claim", entityId: "c-1" },
  },
  {
    name: "missing entity",
    input: { actor: "u", action: "read", entityId: "c-1" },
  },
  {
    name: "missing entityId",
    input: { actor: "u", action: "read", entity: "claim" },
  },
  // Well-formed shape but the action is not a member of AuditAction.
  {
    name: "invalid action value",
    input: { actor: "u", action: "delete", entity: "claim", entityId: "c-1" },
  },
];

describe("sanitizeAuditEntry — rejected entries throw", () => {
  it.each(throwingCases)("$name", ({ input }) => {
    expect(() => sanitizeAuditEntry(input)).toThrow();
  });
});
