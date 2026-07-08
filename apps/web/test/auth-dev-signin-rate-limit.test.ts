import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Regression coverage for two entangled audit findings on the same dev
// Credentials `authorize()` throttle:
//
// 1. The callback is reachable directly through NextAuth's own catch-all
//    POST /api/auth/callback/credentials endpoint (mounted by
//    app/api/auth/[...nextauth]/route.ts's `handlers`), completely bypassing
//    the app's own signInWithEmail server action. The fix keeps the throttle
//    in authorize() itself -- the one chokepoint both paths share -- so this
//    test calls authorize() directly (as NextAuth's endpoint would) rather
//    than going through signInWithEmail.
// 2. The throttle used ONE global key ("dev-signin") shared by every caller,
//    so any anonymous caller could exhaust the whole budget and lock out
//    every other user's real sign-in attempts for the rest of the window --
//    a trivial unauthenticated availability attack on the login flow. The
//    fix adds a per-caller cap (keyed by client IP off the real `request`
//    Auth.js passes to authorize(), falling back to the attempted email when
//    no proxy header is present) ahead of a raised, coarse global backstop,
//    so one caller can no longer starve everyone else.

const mockedFindUserByEmail = vi.fn();
vi.mock("../lib/db", () => ({
  findUserByEmail: (...args: unknown[]) => mockedFindUserByEmail(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("../lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

vi.mock("next-auth", () => ({
  default: (config: unknown) => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    __config: config,
  }),
}));

// The real provider factory just merges its config with a `type` marker and
// hands it back to NextAuth; returning the raw config here lets the test grab
// the `authorize` function straight off it and invoke it directly, exactly as
// NextAuth's own callback endpoint would.
const mockedCredentialsConfig = vi.fn();
vi.mock("next-auth/providers/credentials", () => ({
  default: (config: unknown) => {
    mockedCredentialsConfig(config);
    return config;
  },
}));

interface AuthorizeConfig {
  authorize: (
    credentials: Record<string, unknown> | undefined,
    request: Request,
  ) => Promise<unknown>;
}

async function loadAuthorize(): Promise<AuthorizeConfig["authorize"]> {
  await import("../lib/auth");
  const config = mockedCredentialsConfig.mock.calls.at(-1)?.[0] as
    | AuthorizeConfig
    | undefined;
  if (!config) {
    throw new Error("Credentials provider was never constructed");
  }
  return config.authorize;
}

/** Builds the `Request` Auth.js hands to authorize(), with an optional proxy IP header. */
function requestFromIp(ip: string | undefined): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    headers: ip ? { "x-forwarded-for": ip } : {},
  });
}

const REAL_USER = {
  id: "user-1",
  email: "user@example.com",
  tenantId: "tenant-1",
  tenantName: "Tenant One",
  role: "rcm",
  locale: "en",
};

/** allowRequest resolves true for every key except the exact ones listed. */
function allowExcept(denyKeys: string[]): void {
  mockedAllowRequest.mockImplementation((key: string) =>
    Promise.resolve(!denyKeys.includes(key)),
  );
}

describe("lib/auth — dev Credentials authorize() rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // vi.stubEnv is the type-safe way to mutate process.env in a test — plain
    // `process.env.NODE_ENV = ...` / `delete process.env.NODE_ENV` don't
    // typecheck under modern @types/node, which marks NODE_ENV readonly.
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TAWEED_ENABLE_DEV_AUTH", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks authorize() called directly (as NextAuth's own callback endpoint would) once the per-caller cap denies, without ever touching the DB", async () => {
    // Arrange: this caller's IP specifically is over budget.
    allowExcept(["dev-signin:ip:1.2.3.4"]);
    const authorize = await loadAuthorize();

    // Act — invoke authorize() the same way NextAuth's
    // POST /api/auth/callback/credentials handler would, with no dependency
    // on the app's own signInWithEmail server action.
    const result = await authorize(
      { email: "attacker@example.com" },
      requestFromIp("1.2.3.4"),
    );

    // Assert: denied before any credential lookup runs, and the key actually
    // carries the caller's IP -- proving this is per-caller, not the old
    // single shared "dev-signin" key.
    expect(result).toBeNull();
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
    expect(mockedAllowRequest).toHaveBeenCalledWith(
      "dev-signin:ip:1.2.3.4",
      20,
      60_000,
    );
  });

  it("does not lock out a different caller sharing the same window: one IP over budget, another IP still allowed", async () => {
    allowExcept(["dev-signin:ip:9.9.9.9"]);
    const authorize = await loadAuthorize();
    mockedFindUserByEmail.mockResolvedValue(REAL_USER);

    // The attacker's IP is denied...
    const blocked = await authorize(
      { email: "attacker@example.com" },
      requestFromIp("9.9.9.9"),
    );
    // ...but a legitimate caller on a different IP, in the very same window,
    // is not collateral damage -- this is the exact cross-user lockout the
    // finding reported, proven fixed.
    const allowed = await authorize(
      { email: "user@example.com" },
      requestFromIp("8.8.8.8"),
    );

    expect(blocked).toBeNull();
    expect(allowed).toMatchObject({ id: "user-1" });
  });

  it("still enforces a coarse global backstop shared by every caller, on top of the per-caller cap", async () => {
    allowExcept(["dev-signin"]); // denies only the literal global key
    const authorize = await loadAuthorize();

    const result = await authorize(
      { email: "user@example.com" },
      requestFromIp("8.8.8.8"),
    );

    expect(result).toBeNull();
    expect(mockedAllowRequest).toHaveBeenCalledWith("dev-signin", 200, 60_000);
  });

  it("falls back to keying by the attempted email when no proxy IP header is present, so two callers with no IP still get separate budgets", async () => {
    allowExcept(["dev-signin:email:attacker@example.com"]);
    const authorize = await loadAuthorize();
    mockedFindUserByEmail.mockResolvedValue(REAL_USER);

    const blocked = await authorize(
      { email: "attacker@example.com" },
      requestFromIp(undefined),
    );
    const allowed = await authorize(
      { email: "user@example.com" },
      requestFromIp(undefined),
    );

    expect(blocked).toBeNull();
    expect(allowed).toMatchObject({ id: "user-1" });
  });

  it("still authorizes a real user when under both throttles", async () => {
    mockedAllowRequest.mockResolvedValue(true);
    mockedFindUserByEmail.mockResolvedValue(REAL_USER);
    const authorize = await loadAuthorize();

    const result = await authorize(
      { email: "user@example.com" },
      requestFromIp("8.8.8.8"),
    );

    expect(mockedFindUserByEmail).toHaveBeenCalledWith("user@example.com");
    expect(result).toMatchObject({ id: "user-1", email: "user@example.com" });
  });
});
