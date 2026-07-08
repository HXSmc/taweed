import { defineWorkspace } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests run everywhere and never touch a database.
// Integration tests (*.int.test.ts) require a live Postgres via DATABASE_URL.

// `server-only` resolves to a THROWING module in plain Node/vitest (its no-op
// "react-server" export condition is only set by the Next.js bundler). Alias it
// to a no-op stub so server-only-marked modules (packages/ai) are importable in
// tests — matching how `import "server-only"` behaves in the real server
// runtime. The genuine client-bundle guard is still enforced by `next build`.
const serverOnlyStub = fileURLToPath(
  new URL("./test/stubs/server-only.js", import.meta.url),
);
const alias = { "server-only": serverOnlyStub };

export default defineWorkspace([
  {
    test: {
      name: "unit",
      alias,
      include: [
        "packages/*/test/**/*.test.ts",
        "test/synthetic-fhir/test/**/*.test.ts",
        "test/synthetic-eob/test/**/*.test.ts",
      ],
      exclude: ["**/*.int.test.ts", "**/node_modules/**"],
    },
  },
  {
    test: {
      name: "integration",
      alias,
      include: ["packages/*/test/**/*.int.test.ts"],
      exclude: ["**/node_modules/**"],
      // Each integration file destructively migrates the SAME Postgres, so files
      // must run one at a time — parallel workers would DROP SCHEMA under each
      // other. A single fork runs every integration file sequentially.
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
    },
  },
  {
    // LIVE AI evals (real Anthropic API). Deliberately a SEPARATE project so CI —
    // which runs `--project unit` and `--project integration` only — NEVER runs
    // them (plan 04 §6). Each eval file is additionally skipped unless
    // AI_EVALS_LIVE=1. Run with: AI_EVALS_LIVE=1 vitest run --project evals.
    test: {
      name: "evals",
      alias,
      include: ["packages/*/evals/**/*.eval.ts"],
      exclude: ["**/node_modules/**"],
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
    },
  },
]);
