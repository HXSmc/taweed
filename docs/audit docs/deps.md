# Dependency Maintenance & License Notes

Tracks upstream findings from dependency audits that don't warrant an
immediate code change but shouldn't be silently forgotten. Update this file
when a watch-item resolves (upstream releases, migration lands, etc.).

> **Location note (2026-07-18):** moved from `docs/deps.md` into `docs/audit docs/` (literal
> space in the directory name) as part of the same audit-doc consolidation that moved
> `bugs.md`/`secure.md` — see `audit.md`'s own location note. Force-added (`git add -f`) to stay
> tracked despite the directory being gitignored, same pattern.

Last audit: 2026-07-21 (item 4 of the `/audit-workflow` queue — see Pass #18 below).

## Pass #18 — 2026-07-21 (incremental, agy research + hub independent NVD/GHSA verification)

**Result: clean, 1 agy fabrication caught and refuted.** `pnpm audit --json`: 0 vulnerabilities
(info/low/moderate/high/critical all 0). The `brace-expansion` override (`pnpm-workspace.yaml`,
pinned `^2.1.2`, targeting GHSA-3jxr-9vmj-r5cp) confirmed actually resolved — `pnpm why
brace-expansion` shows every nested copy across minimatch 3.x/9.x/10.x pinned to 2.1.2, no 1.x
copy anywhere in the tree.

**Real advisories checked against the exact installed version, not just "does a CVE exist
somewhere":** the 8 real May-2026 `vercel/next.js` security advisories (pulled live via `gh api
repos/vercel/next.js/security-advisories`) all patch below Next 15.5.15-15.5.18 — this repo is
pinned to **15.5.20**, above every patched ceiling, unaffected. Routine Dependabot CI bumps
(actions/checkout, setup-node, upload-artifact, pnpm/action-setup, @types/node, jsdom 25→29)
clean per agy, no advisories found.

**Caught: agy claimed a "NEW DISCLOSURE (2026-07-21)" — a Next.js 15.5.x security release with 9
vulnerabilities (4 High, 5 Medium) — cited only to a vague `nextjs.org/blog` URL, no specific
advisory ID.** Independently checked the real GitHub security-advisories API for `vercel/next.js`
directly: the newest entry is **2026-05-07**, nothing from 2026-07-21 exists. **Refuted as
fabricated** — same failure pattern pass #17 already caught once (agy citing a real-sounding but
non-existent/misapplied source). Reinforces this file's own standing rule: always independently
verify agy's cited source directly before writing anything into this doc as confirmed, for both
agreed and "new" claims, not just disputed ones.

**No new landmine/watch-item changes** — the two already-tracked deferred majors (vitest→v4 needs
≥4.1.6, react→v19 needs ≥19.2.1 per CVE-2025-55182) are unchanged and still not taken.

## Pass #17 — 2026-07-18 (item 4, agy 3-agent research + hub independent verification)

**Ground truth: `pnpm audit --json` → 0 vulnerabilities across 812 total dependencies** (info/low/
moderate/high/critical all 0, empty advisories array). Confirms the fixes below (2026-07-08) still
hold and nothing new has regressed via `pnpm audit`'s own registry snapshot.

Sent to agy (`/research`, 3-agent cross-review) to catch anything a local `pnpm audit` snapshot
might miss. **Agy's raw output claimed 4 "active" CVEs plus an abandoned-npm-package finding — the
hub independently verified every one of these against the primary source (NVD/GitHub Security
Advisories directly, via `WebFetch`) before trusting any of it, per the reviewer-bar rule "a
spoke's ✅ is a claim, not evidence." Every single one turned out to be a real CVE/advisory
misapplied to the wrong installed version, or (in one case) a dependency this repo doesn't even
have:**

| Agy's claim | Real CVE/advisory (verified) | Actual affected range | This repo's installed version | Verdict |
|---|---|---|---|---|
| "Zod 3.25.76 vulnerable to SQLi" | CVE-2026-6991 — real | Zod **4.3.0–4.3.6** only | `3.25.76` | **NOT AFFECTED** — different major line entirely |
| "Vitest <4.1.6 vulnerable, upgrade needed" | CVE-2026-47428 — real, CVSS 9.6 critical XSS/token-theft in Browser Mode | Vitest **4.0.17–4.1.5** (+5.0.0-beta.0–2) | `3.2.7` | **NOT AFFECTED** — repo is a full major below the affected range |
| "next-auth <4.24.12 email misdelivery" | GHSA-5jpx-9hw9-2fx4 — real | next-auth **<4.24.12** / **<5.0.0-beta.30** | `^5.0.0-beta.31` (confirmed in `apps/web/package.json`) | **NOT AFFECTED** — already past the fixed beta (this repo's own 2026-07-08 floor bump to `beta.31` already cleared it, likely coincidentally) |
| "Next.js 15.5.20 vulnerable (React2Shell)" — **agy's own 3 analysts disputed this one internally** | The cited blog post (`react.dev/.../react-server-components-rce`) **404s — does not exist**. The real CVE for "React2Shell" is CVE-2025-55182 (confirmed real, CVSS 10.0, CISA KEV-listed) but affects `react-server-dom-{parcel,turbopack,webpack}` **19.0.0/19.1.0/19.1.1/19.2.0** specifically, not Next.js itself | React **19.0.0–19.2.0** | React `18.3.1` | **NOT AFFECTED** — repo is on React 18, this is a React-19-only RCE. **Important future constraint: if/when this repo ever bumps to React 19, it MUST land on ≥19.2.1, never 19.0.0–19.2.0 exactly**, or it lands directly on a CISA-KEV-listed pre-auth RCE. Record this against the existing "react 18→19, deferred major" watch-item below. |
| (separately, real+correctly-cited) Next.js middleware auth-bypass | CVE-2025-29927 — real, CVSS 9.1 critical, confirmed | Next.js **15.0.0–<15.2.3** | `15.5.20` | **NOT AFFECTED** — already well past the fixed version |
| (separately, real+correctly-cited) Drizzle-orm identifier-escaping SQLi | GHSA-gpj5-g38j-94v9 — real (agy mislabeled it "CVE-2026-39356", which doesn't match; the real advisory has no separate CVE number shown) | drizzle-orm **≤0.45.1** | `0.45.2` exact | **NOT AFFECTED** — repo is pinned to the exact fixed version already |
| "npm package `fhir` deprecated/abandoned" (2 of 3 analysts) vs. "active, v5.0.2 released" (1 analyst) — agy's own analysts disputed this too | N/A | N/A | **This repo has zero dependency on any npm `fhir`/`fhirclient`/`fhir-kit-client` package** — confirmed via `grep` across every `package.json`. `packages/fhir` is this repo's OWN internal package (FHIR R4 parsing/validation logic), not an npm dependency of that name. | **Not applicable — confused this repo's own package directory with an unrelated npm package of the same name.** |

**Net result: 0 confirmed current vulnerabilities** (matches `pnpm audit`'s clean read) **— but 2
genuinely useful landmine constraints captured for the already-tracked deferred major bumps below**
(vitest 3→4 must land ≥4.1.6; react 18→19 must land ≥19.2.1). Nothing fixed this pass (nothing to
fix); no code changed.

**Process lesson (recorded in `audit.md`'s Learnings too):** agy's 3-agent cross-review can produce
internally-"verified" (2-of-3-agents-agree) claims that are still wrong in a way that matters —
every hallucination this pass was a REAL CVE/advisory correctly sourced, just checked against the
wrong installed version (or, in the `fhir` case, a same-named-but-unrelated package). Cross-review
agreement between agy's own sub-agents caught zero of these — all 4 non-disputed "verified" claims
were equally wrong; only the 2 items agy's analysts happened to disagree on got flagged for the
hub's attention at all, and even those needed independent primary-source verification, not just
picking the "majority" side. **The hub must independently verify every agy CVE claim against the
actual installed version (not just the claim's own cited source) before writing anything as a
confirmed finding — cross-review among agy's own sub-agents is not a substitute for this.**

## CVE fixes (2026-07-08) — `pnpm audit`: 10 advisories (2 critical, 2 high, 6 moderate) → 0

| Advisory | Package | Fix |
|---|---|---|
| GHSA-pppg-cpfq-h7wr / GHSA-hw8r-x6gr-5gjp (critical + high, jsonpath-plus RCE, CVSS 9.8) | `jsonpath-plus@7.2.0` via `packages/rules-engine`'s direct dep `json-rules-engine@^6.5.0` | Bumped `json-rules-engine` to `^7.3.1` (upstream's own fix — its 7.x line already depends on `jsonpath-plus@^10.3.0`). No API changes; verified against the full rules-engine test suite and a production `next build` (jsonpath-plus v10 is ESM-only). |
| GHSA-5xrq-8626-4rwp (critical, vitest arbitrary file read/execute when its UI server is listening) | `vitest@2.1.9` (direct devDependency, root + `apps/web`) | Bumped `vitest`/`@vitest/coverage-v8` to `^3.2.7`. `defineWorkspace`/`environmentMatchGlobs` still work in 3.x (deprecated, removal slated for the next major — non-blocking). Verified: unit 574/574, integration 42/42. |
| GHSA-67mh-4wv8-2f99 / GHSA-4w7w-66w2-5vf9 / GHSA-v6wh-96g9-6wx3 / GHSA-fx2h-pf6j-xcff (moderate–high, esbuild CORS + vite path-traversal/NTLM/fs-deny) | `esbuild@0.21.5`/`vite@5.4.21` pulled in by vitest's own dependency chain | Vitest 3.2.7 alone still resolves `vite@5.x` (which never moved past `esbuild@0.21.x`). Added `pnpm.overrides` (`vitest>vite`, `vite-node>vite`, `@vitest/mocker>vite`, all `^6.4.3`) to force the whole vitest→vite chain to a patched `vite@6.4.3`, which pulls `esbuild ^0.25.x`. |
| GHSA-67mh-4wv8-2f99 (moderate, same esbuild advisory, separate chain) | `esbuild@0.18.20` via `packages/db`'s `drizzle-kit@^0.31.10` → deprecated `@esbuild-kit/*` loader chain | No stable drizzle-kit release drops the `@esbuild-kit` chain yet (only an unpublished `1.0.0-rc` prerelease does — judged unsafe to adopt for a production migration tool). Added a scoped `pnpm.overrides` entry (`@esbuild-kit/core-utils>esbuild`: `^0.25.4`) instead. Verified via `pnpm -r why esbuild` and a live `drizzle-kit db:generate` run. |
| GHSA-qx2v-qp2m-jg93 (moderate, postcss XSS via unescaped `</style>`) | `postcss@8.4.31` vendored transitively through `next@15.5.20` itself (not our own `postcss@^8.4.49`, which was already patched) | Confirmed via Next.js's own GitHub issue thread: build-time-only risk, no committed backport timeline for 15.x/16.x. Added a `pnpm.overrides` entry (`next>postcss`: `^8.5.10`) — safe because postcss is a real resolved npm dependency, not bundled into Next's compiled runtime output. Verified `next build` succeeds. Revisit once Next.js ships a stable release with a patched postcss natively. |
| GHSA-8f24-v5vv-gm5j / GHSA-4c35-wcg5-mm9h (moderate, next-intl open redirect + prototype pollution) | `next-intl@3.26.5` (direct dependency, `apps/web`) | The prototype-pollution advisory requires `experimental.messages.precompile`, which this repo doesn't enable (confirmed: zero matches for `precompile` in the codebase) — not reachable even pre-fix, but free to fix anyway. Bumped `next-intl` to `^4.13.1` (major version). Migration-guide review found zero required code changes for this repo's usage (routing/middleware/provider config already compliant). Verified: full unit suite, production build, and a live chrome-devtools check of `/en` and `/ar` (RTL, locale switch, zero console errors). |

All 5 fixes verified together, post-merge: `pnpm audit` → **0 advisories** (independently re-run, not just trusted from the fix agents' reports); root + `apps/web` typecheck clean; lint 0 errors; unit 574/574; integration 42/42; production build green; live `/ar` route spot-checked via chrome-devtools MCP (real Arabic RTL content, zero console errors).

## Abandoned dependency — plan a swap before Tailwind v4

**`tailwindcss-animate` (`apps/web`, pinned `^1.0.7`)** — genuinely abandoned
upstream: no commits or releases in ~3 years (last commit 2023-07-28), a
Tailwind v4 compatibility PR (#63) has sat open unmerged since April 2025,
and routine dependency-bump PRs from 2023 are still unmerged. Not archived,
but effectively unmaintained.

- **Not currently a risk**: `apps/web` pins `tailwindcss ^3.4.17`, and the
  package still works fine against Tailwind v3.
- **Action deferred, not skipped**: this package will block any future
  Tailwind v4 upgrade. When that upgrade is planned, evaluate
  **`tw-animate-css`** (the active community successor, built for Tailwind
  v4) as the replacement before attempting the bump. Do not swap now — there
  is no current breakage to fix, and swapping ahead of the v4 migration
  would be an unforced risk.

## Frozen majors (upstream healthy, installed line is EOL) — non-urgent

These are app-side technical debt, not upstream abandonment. Upstream is
actively developed; the *major version we've pinned* has stopped receiving
releases because a new major superseded it.

- **`recharts`** — pinned `^2.15.0`. npm marks the 1.x/2.x branches
  explicitly frozen ("no longer active, bump to v3"). Last 2.x release was
  2.15.4 (already installed) in June 2025. No more bugfixes/security
  patches will land on v2. Migrate to v3 when there's bandwidth for the
  breaking-change review; not urgent.
- **`zod`** — pinned `^3.25.76` (aligned across `apps/web` and
  `packages/ai` as of 2026-07-08; previously `apps/web` floor was
  `^3.24.1`, which had drifted from `packages/ai`'s `^3.25.76`). v3's last
  release (`3.25.76`) shipped the day before v4.0.0, and v3 has been frozen
  for a year since. Migrate to v4 when there's bandwidth; not urgent.
  **Verified 2026-07-18 (pass #17): CVE-2026-6991 (SQLi via CUID validator) affects v4.3.0–4.3.6
  only — v3 is unaffected, and the recommended v4 target (4.4.3+) already clears this range, so no
  extra floor is needed beyond the existing "≥4.4.3" target once this migration happens.**
- **`vitest`** (root + `apps/web`, pinned `^3.2.7`) — not itself frozen (v4 is actively developed),
  just a normal deferred major like the others here. **Verified 2026-07-18 (pass #17): if/when this
  bumps to v4, the target MUST be ≥4.1.6** (or ≥5.0.0-beta.3 if tracking the v5 beta line) — CVE-2026-47428
  is a CVSS 9.6 critical XSS/API-token-theft in Browser Mode affecting 4.0.17–4.1.5 and
  5.0.0-beta.0–beta.2. The already-recorded outdated-list target (`4.1.10`) already clears this, so
  no action needed now — just don't let a future bump land short of `4.1.6` specifically.
- **`react`/`react-dom`** (`apps/web`, pinned `18.3.1`) — not frozen, a normal deferred major.
  **Verified 2026-07-18 (pass #17): if/when this bumps to v19, the target MUST be ≥19.2.1** — CVE-2025-55182
  ("React2Shell", CVSS 10.0, CISA KEV-listed pre-auth RCE via unsafe deserialization in
  `react-server-dom-{parcel,turbopack,webpack}`) affects React **19.0.0, 19.1.0, 19.1.1, and 19.2.0
  exactly**. React 18 is unaffected (different RSC wire-protocol code path). This is the single
  highest-severity landmine found this pass — flag it loudly to whoever eventually does this
  migration, since "any 19.x" is not a safe target, only ≥19.2.1 is.

## Slow-cadence maintenance — re-check periodically

- **`json-rules-engine`** (`packages/rules-engine`, `^7.3.1`, core to
  Taweed's rules-engine logic) — last actual npm publish was 2025-02-20
  (~17 months ago); a `7.3.2` bump commit exists in the repo but was never
  published; the `next` dist-tag (`8.0.0-alpha.1`) has been untouched since
  Oct 2024. Repo is not archived, has one active maintainer, and does still
  land occasional commits. Reads as low-bandwidth rather than abandoned, but
  because this sits under core business logic it's worth re-checking each
  audit cycle rather than assuming continued support.
- **`@testing-library/user-event`** (`apps/web` devDependency, `^14.5.2`) —
  longest publish gap in the devDependency set (~17 months), and the source
  repo itself has gone quiet (last push ~10.5 months before the 2026-07-08
  audit). Not archived, 119 open issues, v14's API is considered
  feature-complete by maintainers. Dev-only surface (test harness), so no
  production risk — just flagged for the next re-check.

## License outliers (no action needed — permissive/expected, just noted for a license inventory)

- **`@axe-core/playwright`** (`apps/web` devDependency) — MPL-2.0
  (weak/file-level copyleft), the one non-MIT/Apache/ISC package in the
  devDependency tree. Dev-only, used to run accessibility test assertions;
  never bundled or distributed to end users, so no practical copyleft
  obligation. No action needed; noted for completeness in any formal
  license-compliance review.
- **`geist`** (`apps/web`) — SIL Open Font License, the standard/expected
  license for a font package (same family as other OFL web fonts). No
  action needed.
- **`lucide-react`** — ISC, standard permissive license. No action needed.

## Reviewed and cleared (no flag)

- **`clsx`** — technically clears a strict "no publish + no commit in 18+
  months" abandonment threshold, but is a finished, ~239-byte utility with a
  complete/stable API and ongoing maintainer engagement on issues/PRs.
  Dormant-by-design, not neglected. No successor needed.
- **`class-variance-authority`** — the stable release line hasn't cut a tag
  in ~19 months, but the repo itself commits daily working toward a v1.0
  beta. Actively developed, just mid-migration. No action needed.
- **`@napi-rs/canvas`** (`packages/ingest`, pinned `0.1.80` exact) — upstream
  shipped a `1.0.x` major in 2026; the pinned `0.1.80` is not deprecated or
  vulnerable, just a major behind on a native-binding package where
  Node ABI/prebuilt-binary compatibility matters more than usual. Worth a
  periodic bump, not an emergency.

## Floor-hygiene fixes applied 2026-07-08 (declared range only — resolved versions unchanged)

`pnpm-lock.yaml` already resolved these to current versions; the
`package.json` floors were stale and, in `next`'s case, pointed at an
npm-flagged CVE version. Bumping the floor prevents a future lockfile
regen from silently re-admitting a vulnerable/stale version — the
installed code does not change.

| Package | Old floor | New floor | Why |
|---|---|---|---|
| `next` (`apps/web`) | `^15.1.3` | `^15.5.20` | `15.1.3` is npm-flagged deprecated with a security vulnerability (CVE-2025-66478); lockfile already resolves to the patched `15.5.20`. |
| `next-auth` (`apps/web`) | `^5.0.0-beta.25` | `^5.0.0-beta.31` | Floor was 18 months / 6 beta releases stale vs. the lockfile-resolved `beta.31`. v5 remains in a long-running beta (no GA on the npm `latest` dist-tag) — track the Auth.js v5 GA timeline separately since there's no committed date. |
| `zod` (`apps/web`) | `^3.24.1` | `^3.25.76` | Aligns with `packages/ai`'s floor (`^3.25.76`) to remove monorepo drift; matches the lockfile-resolved version already shared by both packages. |
