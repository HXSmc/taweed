// No-op stub for the `server-only` package in the vitest/Node runtime.
//
// The real `server-only` package resolves to a THROWING module unless the
// bundler sets the "react-server" export condition (Next.js does; plain Node /
// vitest does not). In the actual server runtime `import "server-only"` is a
// no-op — this stub reproduces that so server-only-marked modules (packages/ai)
// are importable in unit/integration tests. The genuine client-bundle guard is
// enforced at build time by `next build`, not by these tests.
// Aliased in vitest.workspace.ts.
export {};
