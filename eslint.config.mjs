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
