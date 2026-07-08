import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
