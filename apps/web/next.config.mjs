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
  ],
  // pg is a server-only dependency; never bundle it into client/edge chunks.
  serverExternalPackages: ["pg"],
  webpack: (config) => {
    // Workspace packages use ESM ".js" import specifiers that point at ".ts"
    // source (no build step). Let webpack resolve ".js" → ".ts"/".tsx" first so
    // the transpiled @taweed/* packages resolve their intra-package imports.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
