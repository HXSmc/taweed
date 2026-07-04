import type { Config } from "tailwindcss";

// Tailwind reads the design tokens (app/globals.css) through CSS variables, so
// the token file stays the single source of truth. Utilities like `bg-surface-1`,
// `text-muted`, `border-hairline` map straight onto tokens. Logical properties
// (ms-/me-/ps-/pe-/start-/end-) drive RTL; no physical left/right in layout.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        hairline: "var(--hairline)",
        "hairline-strong": "var(--hairline-strong)",
        text: "var(--text)",
        muted: "var(--text-muted)",
        faint: "var(--text-faint)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          fg: "var(--accent-fg)",
          subtle: "var(--accent-subtle)",
        },
        "at-risk": {
          DEFAULT: "var(--at-risk)",
          soft: "var(--at-risk-soft)",
          bg: "var(--at-risk-bg)",
          text: "var(--at-risk-text)",
        },
        recovered: {
          DEFAULT: "var(--recovered)",
          soft: "var(--recovered-soft)",
          bg: "var(--recovered-bg)",
          text: "var(--recovered-text)",
        },
        "money-neutral": "var(--money-neutral)",
        cat: {
          1: "var(--cat-1)",
          2: "var(--cat-2)",
          3: "var(--cat-3)",
          4: "var(--cat-4)",
          5: "var(--cat-5)",
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        DEFAULT: "var(--r-md)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        full: "var(--r-full)",
      },
      fontFamily: {
        display: "var(--font-display)",
        ui: "var(--font-ui)",
        mono: "var(--font-mono)",
        arabic: "var(--font-arabic)",
      },
      fontSize: {
        // design-brief §4.3 scale
        hero: ["clamp(44px, 3vw + 28px, 72px)", { lineHeight: "1.0" }],
        display: ["40px", { lineHeight: "1.05" }],
        h1: ["28px", { lineHeight: "1.2" }],
        h2: ["20px", { lineHeight: "1.3" }],
        h3: ["16px", { lineHeight: "1.4" }],
        body: ["14px", { lineHeight: "1.5" }],
        label: ["12.5px", { lineHeight: "1.4", letterSpacing: "0.01em" }],
        codenum: ["13px", { lineHeight: "1.4" }],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      keyframes: {
        reveal: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-end": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        reveal: "reveal 320ms cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-end": "slide-in-end 200ms ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
