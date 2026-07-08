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
// Regex-scoped to the "@/..." specifier apps/web's own source uses for its
// internal path alias (tsconfig "paths": { "@/*": ["./*"] }) — it must not
// shadow the "@taweed/*" package imports the rest of the unit suite relies on.
const webDir = fileURLToPath(new URL("./apps/web", import.meta.url));
const alias = [
  { find: "server-only", replacement: serverOnlyStub },
  { find: /^@\//, replacement: `${webDir}/` },
];

export default defineWorkspace([
  {
    // Matches how Next.js/SWC actually compiles this app's .tsx source (the
    // automatic JSX runtime) — several components (e.g. confidence-badge.tsx)
    // rely on it and never import React explicitly, which is valid there but
    // would otherwise throw "React is not defined" under esbuild's classic
    // default when component tests render them here.
    esbuild: { jsx: "automatic" },
    test: {
      name: "unit",
      alias,
      include: [
        "packages/*/test/**/*.test.ts",
        "apps/web/test/**/*.test.ts",
        "apps/web/test/**/*.test.tsx",
        "test/synthetic-fhir/test/**/*.test.ts",
        "test/synthetic-eob/test/**/*.test.ts",
      ],
      exclude: ["**/*.int.test.ts", "**/node_modules/**"],
      // Component tests (*.test.tsx) render with React Testing Library and
      // need a DOM; every other unit test stays on the default "node"
      // environment (cheaper, and most of the suite has no DOM dependency).
      environmentMatchGlobs: [["apps/web/test/**/*.test.tsx", "jsdom"]],
      setupFiles: ["apps/web/test/setup.ts"],
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
