import { defineWorkspace } from "vitest/config";

// Unit tests run everywhere and never touch a database.
// Integration tests (*.int.test.ts) require a live Postgres via DATABASE_URL.
export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: [
        "packages/*/test/**/*.test.ts",
        "test/synthetic-fhir/test/**/*.test.ts",
      ],
      exclude: ["**/*.int.test.ts", "**/node_modules/**"],
    },
  },
  {
    test: {
      name: "integration",
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
      include: ["packages/*/evals/**/*.eval.ts"],
      exclude: ["**/node_modules/**"],
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
    },
  },
]);
