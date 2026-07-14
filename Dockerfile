# Multi-stage build for the apps/web Next.js app inside the taweed pnpm
# workspace. Debian-based (not alpine) because packages/ingest depends on
# @napi-rs/canvas, a native prebuilt binary that targets glibc, not musl.

FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# --- deps: install once, cached until lockfile/package.json files change ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/fhir/package.json packages/fhir/package.json
COPY packages/normalizer/package.json packages/normalizer/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/audit/package.json packages/audit/package.json
COPY packages/rules-engine/package.json packages/rules-engine/package.json
COPY packages/appeals/package.json packages/appeals/package.json
COPY packages/analytics/package.json packages/analytics/package.json
COPY packages/ingest/package.json packages/ingest/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/platform/package.json packages/platform/package.json
COPY test/synthetic-fhir/package.json test/synthetic-fhir/package.json
COPY test/synthetic-eob/package.json test/synthetic-eob/package.json
RUN pnpm install --frozen-lockfile

# --- build: the full source + a real `next build` for apps/web ---
FROM deps AS build
COPY . .
# Build-time-only placeholders — real values are supplied at container run
# time via docker-compose.yml; Next.js needs *something* present so any
# module-load-time env read doesn't throw during the build's static analysis.
ENV NODE_ENV=production
ENV DATABASE_URL=postgres://taweed:taweed@postgres:5432/taweed
ENV AUTH_SECRET=build-time-placeholder-overridden-at-runtime
RUN pnpm --filter @taweed/web build

# --- runtime: only what's needed to run `next start` ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
