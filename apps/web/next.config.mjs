import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";
// The Playwright E2E webServer (playwright.config.ts) runs a real production
// build (`pnpm start`) served over plain HTTP with no TLS terminator — real
// deployments always sit behind HTTPS (Vercel enforces it), so
// `upgrade-insecure-requests` is dropped only for that one scenario. Without
// this, WebKit takes the CSP literally and tries to upgrade every navigation
// to https://localhost, which then hangs (nothing listens on 443) until
// Playwright's `waitForURL` times out — Chromium/Firefox don't hang the same
// way, so this only ever broke the webkit E2E project.
const isHttpOnlyE2e = process.env.TAWEED_HTTP_ONLY_E2E === "1";

// Static (non-nonce) CSP, per Next.js's own documented "Without Nonces"
// pattern (next.config.js headers()) — see
// https://nextjs.org/docs/app/guides/content-security-policy#without-nonces.
// A nonce-based CSP is stricter on script-src but forces every route into
// dynamic rendering (kills SSG/ISR/PPR) and requires per-request nonce
// plumbing through middleware.ts + every layout — out of scope for this
// header-hardening pass. `script-src 'unsafe-inline'` is required here
// because: (1) this layout renders a genuine inline `<script>` (the
// pre-hydration dark/light theme-init snippet in
// app/[locale]/layout.tsx, needed to avoid a flash of the wrong theme),
// and (2) Next.js's own App Router runtime streams hydration/RSC payload
// data via inline `<script>` tags whose content is per-render and cannot
// be hashed statically. `style-src 'unsafe-inline'` is required for
// Next's inline style injection (App Router streaming + any CSS-in-JS).
// `'unsafe-eval'` is added in development only — React's dev-mode error
// stack reconstruction uses `eval`; neither React nor Next use it in
// production builds.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';${isHttpOnlyE2e ? "" : "\n  upgrade-insecure-requests;"}
`;

// Security response headers applied to every route. Exported separately so
// it can be unit-tested without importing this ESM config file (which pulls
// in next-intl/plugin) — see test/next-config-security-headers.test.ts.
export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspHeader.replace(/\s{2,}/g, " ").trim(),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  reactStrictMode: true,
  // Workspace packages export raw TypeScript (./src/index.ts); Next must transpile them.
  transpilePackages: [
    "@taweed/shared",
    "@taweed/fhir",
    "@taweed/normalizer",
    "@taweed/db",
    "@taweed/audit",
    "@taweed/rules-engine",
    "@taweed/appeals",
    "@taweed/analytics",
    "@taweed/synthetic-fhir",
    "@taweed/ai",
  ],
  // pg is a server-only dependency; never bundle it into client/edge chunks.
  // pdf-parse/pdfjs-dist/@napi-rs/canvas (AI-4 born-digital text-layer
  // extraction, packages/ingest/src/pdf-text-layer.ts) ship a native .node
  // binary (@napi-rs/canvas) that webpack cannot parse as a module — these
  // must stay external and be `require()`d directly by the Node server
  // runtime instead of bundled.
  //
  // @napi-rs/canvas and pdf-parse are also direct dependencies of THIS
  // package (apps/web), even though the only import site is
  // packages/ingest/src/pdf-text-layer.ts. Root cause: a real
  // `require("@napi-rs/canvas")` at runtime resolves from wherever the
  // COMPILED output file lives (apps/web/.next/server/...), not from the
  // original source file's location — but pnpm's strict, per-package
  // isolated node_modules only created the `@napi-rs/canvas` symlink under
  // packages/ingest/node_modules (where the dependency was declared), which
  // is unreachable from apps/web's own resolution chain. Declaring it here
  // too gives apps/web its own symlink into the same pnpm store, which is
  // what actually makes the module resolvable at runtime — and, as a
  // bonus, is what let Next's Output File Tracing (OFT / @vercel/nft)
  // discover and package the native platform binary correctly on its own
  // (confirmed: an `outputFileTracingIncludes` glob-based workaround was
  // tried first and did NOT fix the live MODULE_NOT_FOUND — the files were
  // traceable but the symlink Node needs for resolution was still missing;
  // fixing the dependency declaration fixed both issues at once).
  serverExternalPackages: ["pg", "pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  webpack: (config, { isServer }) => {
    // Workspace packages use ESM ".js" import specifiers that point at ".ts"
    // source (no build step). Let webpack resolve ".js" → ".ts"/".tsx" first so
    // the transpiled @taweed/* packages resolve their intra-package imports.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    // `serverExternalPackages` above doesn't reach @napi-rs/canvas when it's
    // imported transitively through a workspace package (packages/ingest's
    // pdf-text-layer.ts) rather than directly from app/ code — webpack still
    // tries to bundle its native .node binary and fails to parse it. Force it
    // external at the webpack level too, server-side only (the client bundle
    // never imports this path).
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@napi-rs/canvas",
        "pdfjs-dist",
        "pdf-parse",
      ];
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
