import { describe, it, expect, vi, beforeEach } from "vitest";
import * as z from "zod/v4";
import type { Pool, Database } from "@taweed/db";
import type { LlmProvider, StructuredRequest } from "../src/provider.js";

// `withTenant`'s real signature is generic over the callback's return type
// and requires `fn: (db: Database) => Promise<T>` — the stub below only ever
// needs a `db` with a `select` chain, so it's cast to the real type rather
// than fighting structural inference on a hand-rolled generic mock. Defined
// via `vi.hoisted` so it's safe to reference from `vi.mock`'s factory, which
// vitest hoists above this file's other module-scope statements.
const { stubDb } = vi.hoisted(() => ({
  stubDb: {
    select: () => ({ from: () => ({ limit: () => Promise.resolve([]) }) }),
  } as unknown as Database,
}));

// Regression coverage for the audit-hygiene finding: on both audit-write-
// failure paths, run.ts used to `console.error(msg, auditErr)` — dumping the
// FULL caught error object (stack, `.cause` chain, and for a Postgres driver
// or Anthropic SDK error, any nested request/response detail attached as
// extra properties) straight into server logs. The fix redacts to a bounded
// `name: message` string via redactAuditError(). These tests fail on the old
// behavior (a raw Error instance reaching console.error) and pass on the fix.

// `@taweed/db` needs a live Postgres to construct a real Pool/Database, so it
// is mocked here exactly like the "unit" vitest project's other DB-adjacent
// suites — only `withTenant` is exercised, and it just invokes the callback
// with a minimal stub `db` (real DB behavior is covered by run's own
// `*.int.test.ts` suites, e.g. explainFlag.int.test.ts).
vi.mock("@taweed/db", () => ({
  withTenant: vi.fn((_pool: unknown, _tenantId: string, fn: (db: Database) => Promise<unknown>) =>
    fn(stubDb),
  ),
  schema: { tenantAiSettings: {}, llmCalls: {} },
}));

// `writeLlmCall` is mocked directly so each test controls exactly when the
// audit write fails, without needing a real Postgres constraint violation to
// trigger it.
vi.mock("../src/audit.js", () => ({
  writeLlmCall: vi.fn(),
}));

import { withTenant } from "@taweed/db";
import { writeLlmCall } from "../src/audit.js";
import { runStructured, redactAuditError } from "../src/run.js";

const mockedWriteLlmCall = vi.mocked(writeLlmCall);
const mockedWithTenant = vi.mocked(withTenant);

const ENABLED_ENV = {
  TAWEED_AI_ENABLED: "true",
  TAWEED_AI_EXPLAIN_ENABLED: "true",
};

const REQ: StructuredRequest<{ ok: boolean }> = {
  model: "haiku",
  system: "system prompt",
  user: "user prompt",
  schema: z.object({ ok: z.boolean() }),
  schemaName: "ok-schema",
  maxTokens: 100,
};

function makeProvider(behavior: "throws" | "ok"): LlmProvider {
  return {
    name: "stub",
    mapModelId: (m) => `stub-${m}`,
    capabilities: { batches: false, files: false },
    client: {
      async parseStructured<T>() {
        if (behavior === "throws") {
          throw new Error("stub provider boom");
        }
        return {
          parsed: { ok: true } as unknown as T,
          model: "stub-haiku",
          requestId: "req-1",
          usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 },
          latencyMs: 1,
          rawOutput: JSON.stringify({ ok: true }),
        };
      },
    },
  };
}

describe("redactAuditError", () => {
  it("keeps only `name: message` for an Error, dropping stack/cause/extra properties", () => {
    const err = new Error("connection string leaked: postgres://user:pass@host/db");
    err.stack = "Error: ...\n    at someInternalFn (/very/sensitive/path.ts:1:1)";
    (err as unknown as Record<string, unknown>).response = {
      headers: { authorization: "Bearer super-secret" },
    };

    const redacted = redactAuditError(err);

    expect(redacted).toBe(
      "Error: connection string leaked: postgres://user:pass@host/db",
    );
    expect(redacted).not.toContain("Bearer");
    expect(redacted).not.toContain("someInternalFn");
  });

  it("truncates an overlong message instead of logging it in full", () => {
    const longMessage = "x".repeat(1000);

    const redacted = redactAuditError(new Error(longMessage));

    expect(redacted.length).toBeLessThan(1000);
    expect(redacted.endsWith("…[truncated]")).toBe(true);
  });

  it("stringifies a non-Error thrown value without crashing", () => {
    expect(redactAuditError("just a string")).toBe("just a string");
  });
});

describe("runStructured — audit-write-failure logging never leaks the raw error object", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithTenant.mockImplementation(
      (_pool: unknown, _tenantId: string, fn: (db: Database) => Promise<unknown>) => fn(stubDb),
    );
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("logs a redacted string, not the raw Error, on the provider-error + audit-write-failure path", async () => {
    // Arrange: the provider call itself throws, AND the subsequent audit
    // write (for the failed attempt) also fails with an error carrying
    // sensitive nested detail (e.g. a Postgres driver error echoing part of
    // a connection string).
    const auditWriteError = new Error("password authentication failed for user \"app\"");
    (auditWriteError as unknown as Record<string, unknown>).detail =
      "connection string: postgres://app:hunter2@db-host/taweed";
    mockedWriteLlmCall.mockRejectedValueOnce(auditWriteError);

    // Act
    await expect(
      runStructured({
        actor: "user-1",
        feature: "explain",
        pool: {} as Pool,
        tenantId: "tenant-1",
        provider: makeProvider("throws"),
        req: REQ,
        env: ENABLED_ENV,
      }),
    ).rejects.toThrow(/boom/);

    // Assert: the provider error is still rethrown (audit failure never masks
    // it), and console.error's second argument is the bounded redacted
    // string — never the raw `auditWriteError` object (which would leak the
    // embedded connection-string detail and the stack into logs verbatim).
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedDetail] = consoleErrorSpy.mock.calls[0]!;
    expect(loggedDetail).toBe(
      'Error: password authentication failed for user "app"',
    );
    expect(loggedDetail).not.toBe(auditWriteError);
    expect(typeof loggedDetail).toBe("string");
    expect(loggedDetail).not.toContain("hunter2");
  });

  it("logs a redacted string, not the raw Error, on the successful-call + audit-write-failure path", async () => {
    // Arrange: the provider call succeeds, but the audit write for the
    // successful call fails.
    const auditWriteError = new Error("relation \"llm_calls\" is not writable");
    mockedWriteLlmCall.mockRejectedValueOnce(auditWriteError);

    // Act
    await expect(
      runStructured({
        actor: "user-1",
        feature: "explain",
        pool: {} as Pool,
        tenantId: "tenant-1",
        provider: makeProvider("ok"),
        req: REQ,
        env: ENABLED_ENV,
      }),
    ).rejects.toBe(auditWriteError);

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, loggedDetail] = consoleErrorSpy.mock.calls[0]!;
    expect(loggedDetail).toBe('Error: relation "llm_calls" is not writable');
    expect(loggedDetail).not.toBe(auditWriteError);
    expect(typeof loggedDetail).toBe("string");
  });
});
