# ECC Guide — Rafd (KSA Denial-Management SaaS)

> How the **Everything Claude Code (ECC)** harness is wired into this project, and which of its 92 commands / 67 agents / 86 skills actually matter for building Rafd.
> Companion to `02_product_build_plan.md`. ECC is a build accelerator — it does **not** know FHIR/NPHIES; that domain knowledge comes from the OSS stack in build-plan §12.3.

---

## 0. What got installed & where

| Surface | Count | Location | Loads when |
|---|---|---|---|
| Skills | 86 | `.claude/skills/ecc/` | running Claude Code from this dir |
| Agents | 67 | `.claude/agents/` | this dir |
| Commands | 92 | `.claude/commands/` | this dir (slash commands) |
| Rules | 23 lang packs | `.claude/rules/ecc/` | this dir |
| Hooks | `hooks.json` | `.claude/hooks/` | this dir (memory + quality) |

Profile installed: **developer + capability:security + capability:devops**. Project-scoped only.
The same 86 skills are ALSO at user scope (`~/.claude/skills/`) for every future project — but agents/commands/hooks live **only here**.

### Coexistence with caveman / superpowers (important)
- **Global:** caveman + superpowers **untouched**. Only skills were added globally.
- **In this project only**, two overlaps:
  1. **Command-name shadowing** — ECC's `/code-review`, `/security-scan`, `/checkpoint` share names with built-ins. When ambiguous, prefer the built-in `/code-review` for the multi-agent cloud review; ECC's is a local shim.
  2. **Hook stacking** — this project fires ECC hooks (`SessionStart`, `Stop`, `Pre/PostToolUse`, `PreCompact`) alongside caveman's (`SessionStart`, `UserPromptSubmit`). They stack, don't conflict. ECC's add memory-persistence + quality checks (small latency cost). Caveman prompt-rewrite is unaffected.

---

## 1. Commands that matter for building Rafd

Rafd stack = **Next.js + TypeScript + Postgres + Prisma-style ORM + rules engine + PHI/PDPL**. Focus on these; ignore the rest (§4).

### Planning & spec (start here each feature)
| Command | Use |
|---|---|
| `/plan` | Restate requirements, assess risk, produce step-by-step plan. **Waits for your confirm before touching code.** Use before every non-trivial module. |
| `/plan-prd` → `/plan` | Generate a lean problem-first PRD, then hand to `/plan`. Good for the 5 MVP modules. |
| `/prp-prd` · `/prp-plan` · `/prp-implement` | Heavier "product requirement prompt" flow — interactive PRD → analyzed plan → validated implementation. Use for the big pieces (FHIR parser, rules engine). |
| `/feature-dev` | Guided feature development with codebase-understanding + architecture focus. |
| `/update-codemaps` | Generate token-lean architecture maps of the repo. Run after scaffolding so agents navigate the monorepo cheaply. |

### Build the MVP (orchestrated, TDD-gated)
| Command | Use |
|---|---|
| `/orch-build-mvp` | Bootstrap a working MVP from a spec doc — ingest → slice → scaffold → TDD → review → gated commit. Point it at `02_product_build_plan.md`. |
| `/orch-add-feature` | New feature end-to-end: research → plan → TDD → review → gated commit. |
| `/orch-change-feature` | Alter existing behavior — update tests to new spec first, then impl. |
| `/orch-fix-defect` | Bug → reproduce as failing test → fix to green → review. |
| `/orch-refine-code` | Behavior-preserving refactor — keep tests green throughout. |

### TypeScript / React / Next.js (your app tier)
| Command | Use |
|---|---|
| `/react-test` | TDD for React — RTL tests first (behavior + a11y), then components. Detects Vitest/Jest. Use for `apps/web` dashboards + upload UI. |
| `/react-review` | Review React/TSX — hooks correctness, render perf, server/client boundaries, a11y, React-specific security. Runs `typescript-reviewer` alongside. |
| `/react-build` | Fix Next.js/Vite/webpack build + hydration + server/client boundary errors, minimal surgical fixes. |

> No standalone TS command — TS review rides along with `/react-review` via `typescript-reviewer`. For pure backend TS (`packages/*`), use `/code-review` + `test-coverage`.

### Database (Postgres + RLS — your data tier)
| Command / Skill | Use |
|---|---|
| skill `postgres-patterns` | Query optimization, schema, indexing, RLS. Auto-applies on Postgres work. |
| skill `prisma-patterns` | If using Prisma — schema, transactions, and the sharp traps (updateMany returns count, migrate dev resets DB, serverless conn exhaustion). |
| skill `database-migrations` | Zero-downtime migrations, rollbacks across Prisma/Drizzle/Kysely. |

### Security & compliance (Rafd's hardest requirement)
| Command / Skill | Use |
|---|---|
| skill `healthcare-phi-compliance` | **Primary.** PHI/PII classification, access control, audit trails, encryption, leak vectors. Map to your PDPL spine. |
| skill `hipaa-compliance` | US-framed but the controls (BAAs, breach posture, minimum-necessary) transfer to PDPL sensitive-data handling. |
| `/security-scan` | AgentShield scan of agent/hook/MCP/permission/secret surfaces + `.claude/` config. Run before sharing the repo. |
| skill `security-review` | Manual security review checklist + vuln analysis. Run on auth, ingest, export paths. |
| agent `security-reviewer` · `healthcare-reviewer` | Delegate a focused security / healthcare-data review. |

### Testing & quality (every module)
| Command | Use |
|---|---|
| `/test-coverage` | Analyze coverage, find gaps, generate missing tests toward your target (build-plan targets 80%+). |
| `/quality-gate` | Run the ECC formatter quality gate on a file + remediation steps. |
| `/checkpoint` | Create/verify/list workflow checkpoints after verification passes — use at each weekly milestone exit. |
| `/build-fix` | Auto-detect build system, incrementally fix build/type errors with minimal changes. |
| `/santa-loop` | Adversarial dual-review — two independent model reviewers must BOTH approve before code ships. Use on the rules engine + appeal generator (high-stakes correctness). |

### Memory / long project (the reason ECC was chosen)
| Command | Use |
|---|---|
| `/save-session` · `/resume-session` | Persist + reload full session context to `~/.claude/session-data/`. Essential across a 12-week build. |
| `/learn` · `/learn-eval` | Extract reusable patterns from a session → candidate skills/guidance (self-evaluated, project vs global). |
| `/instinct-status` · `/promote` · `/prune` | Inspect learned "instincts", promote good project-scoped ones to global, prune stale. |
| `/sessions` | Manage session history + aliases. |

### Git / PR / ops
| Command | Use |
|---|---|
| `/pr` (a.k.a. `/prp-pr`) | Create a GitHub PR from unpushed commits — discovers templates, analyzes changes, pushes. |
| `/review-pr` | Multi-agent PR review. |
| `/code-review` | Local uncommitted-diff review, or PR mode with a number. (Note: built-in `/code-review` also exists — see §0.) |
| `/setup-pm` · `/pm2` | Configure package manager (pnpm recommended for the monorepo); generate PM2 service commands for local frontend/backend/db. |
| `/cost-report` | Local Claude Code cost report from ECC's cost tracker — watch token spend. |

---

## 2. Key agents (delegate focused work)

Invoke via natural language ("have the healthcare-reviewer audit this") or they're pulled by the commands above.

| Agent | Role |
|---|---|
| `architect` / `code-architect` | System design, module boundaries — use for the monorepo + data-tier design. |
| `planner` | Feature implementation planning. |
| `healthcare-reviewer` | PHI/clinical-data review — Rafd-specific. |
| `security-reviewer` | Vulnerability analysis. |
| `database-reviewer` | Schema/query/RLS review. |
| `react-reviewer` · `typescript-reviewer` | Frontend + TS review. |
| `tdd-guide` | Enforce test-first discipline. |
| `react-build-resolver` · `build-error-resolver` | Fix build/type errors surgically. |
| `refactor-cleaner` | Dead-code removal, refactors. |
| `performance-optimizer` | Dashboard/query perf. |
| `silent-failure-hunter` | Find swallowed errors — valuable for an ingest/parse pipeline. |
| `doc-updater` | Keep docs synced. |

---

## 3. Suggested workflow for Rafd

```
Per feature (e.g. FHIR parser, rules engine, appeal generator):
  /plan-prd  → /plan            # spec + confirmed step plan
  /orch-add-feature             # research → TDD → review → gated commit
  /react-test | /test-coverage  # tests-first, hit coverage target
  healthcare-reviewer +
    security-reviewer           # PHI / security pass (mandatory on PHI paths)
  /santa-loop                   # dual-approval on high-stakes modules
  /checkpoint                   # lock the milestone
  /save-session                 # persist context for next session
```

Bootstrap the whole thing once with `/orch-build-mvp` pointed at `02_product_build_plan.md`, then iterate per-module.

---

## 4. Ignore for Rafd (wrong stack)

Installed but irrelevant to a Next.js/TS/Postgres build — don't reach for these:

- **Other-language build/review/test:** `cpp-*`, `go-*`, `rust-*`, `kotlin-*`, `flutter-*`, `gradle-build`, `fastapi-review`, `python-review`, `vue-review` (unless you add a Python service or Vue admin later).
- **Integrations you're not using yet:** `jira`, `marketing-campaign`, `epic-*` (GitHub epic coordination — only if you adopt that issue workflow).
- **Multi-model workflows** (`multi-*`, `gan-*`, `model-route`): optional; use only if you deliberately want multi-model orchestration (adds cost).
- **`auto-update`**: pulls latest ECC + reinstalls — re-verify pruned skills don't return.

---

## 5. Maintenance

| Action | Command |
|---|---|
| Discover ECC surface interactively | `/ecc-guide`, `/ecc-guide find: <query>` |
| List / configure behavior-guard hooks | `/hookify-list`, `/hookify-configure`, `/hookify-help` |
| Skill portfolio health | `/skill-health` |
| Repo harness audit (prioritized scorecard) | `/harness-audit` |
| Uninstall ECC from this project | `npx -p ecc-universal ecc uninstall --target claude-project` |
| Remove only project skills (keep global) | `rm -rf .claude/skills/ecc` |
| Kill hook stacking + command overlap | delete `.claude/hooks/` and unwanted `.claude/commands/*.md` |

> Reminder: ECC gives engineering discipline (security, TS, DB, testing, memory). **FHIR R4 / NPHIES / denial-code correctness is on you + the OSS stack** (Medplum, fhirpath.js, json-rules-engine, Synthea, validator_cli — build-plan §12.3). No ECC skill covers it.
