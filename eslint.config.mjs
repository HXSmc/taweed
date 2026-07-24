import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "**/*.config.{ts,cts,mts}",
      "packages/db/drizzle/**",
      ".claude/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // packages/shared must stay isomorphic: its barrel (src/index.ts) is
    // re-exported into client bundles (e.g. apps/web's appeals composer
    // imports `levenshtein` from @taweed/shared), so a `node:` builtin
    // anywhere in this package's graph would fail the browser build. Enforce
    // that constraint at lint time instead of relying on a comment.
    files: ["packages/shared/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*"],
              message:
                "@taweed/shared is imported by client bundles and must stay isomorphic — no node: builtins. See packages/shared/src/index.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    // apps/web (Next.js App Router) — was UNLINTED (react reviewer flagged the
    // eslint.config ignoring apps/web as CRITICAL: `eslint .` linted zero files).
    // Now enforced: typescript-eslint recommended + react-hooks (rules-of-hooks
    // catches hook-order bugs) + jsx-a11y recommended. The stricter react-hooks
    // v7 React-Compiler rules (set-state-in-effect, refs, purity, immutability)
    // are left off — they flag legitimate patterns here (post-hydration theme
    // sync, latest-callback refs) and are advisory, not correctness gates.
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
