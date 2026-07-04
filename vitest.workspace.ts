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
    },
  },
]);
