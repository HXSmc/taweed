# Taweed: Product Design Brief (for Claude Design)

> Upload this file to Claude Design as the single source of truth for generating Taweed's UI.
> It fuses the app architecture (from `02_product_build_plan.md`), an anti-slop taste system, and marketing psychology mapped to concrete UI moments.
> Non-negotiables: one locked accent, one radius scale, one type pairing, one voice, Arabic-first RTL, zero em-dashes. The NUMBER is the hero.

---

## 1. Product in one page

**Taweed** (Arabic تعويض, "reimbursement") is NPHIES-native denial-**recovery** SaaS for mid-market KSA private clinic groups (3-15 branches: dental, derma-medical, polyclinic, ophthalmology, IVF). It reads a clinic's own NPHIES claim data, proves exactly which payers and codes are draining revenue, prevents new denials before submission, drafts bilingual appeals, and tracks recovered SAR. No new HIS to install, no live NPHIES integration required at MVP.

- **Category claim:** NPHIES-native denial recovery for mid-market clinic groups.
- **One-liner:** See exactly which payers and codes are draining your revenue, and recover it, from your own NPHIES data. No new system.
- **The two people you design for:**
  - **Economic buyer, the Owner-Physician / Managing Partner.** Clinical authority plus P&L owner, time-poor, reputation-driven. Buys on **provable recovered SAR**, low lift, EN/AR, in-Kingdom data. Fears: another system, data-export effort, PDPL data-safety, "will this actually recover money."
  - **Champion, the RCM / Finance / Insurance Manager.** Lives in payer portals and spreadsheets, measured on collection rate and denials. Wants time saved, denial analytics, appeal templates, and a number to show the owner. Vocabulary: rejections, resubmission, first-pass, pre-auth, CHI/NPHIES, SBS codes, TPA.
- **The emotional spine (loss aversion):** losses register about twice as hard as equivalent gains. Taweed surfaces money the owner is **already losing** and lets them watch it stop. The arc: money leaking, money seen, money recovered, money defended.
- **The demo narrative to design around:** clinic uploads 3-6 months of historical remittances, sees their denial map in under 10 minutes, runs the scrubber on a live batch, generates at least one appeal, recovers measurable SAR. ROI provable from their own data. The sales wedge is a **free denial audit** on the prospect's own data.

---

## 2. Design read + dials

**Read:** a clinical-fintech precision instrument where the recovered-SAR number is the emotional hero, built on cool graphite neutrals, one locked cobalt accent, and a money-semantics data-viz system, Arabic-first and RTL-native. Not a generic dashboard-by-numbers, not AI-purple, not sidebar-plus-cards with no point of view.

| Dial | Value | Why |
|---|---|---|
| DESIGN_VARIANCE | **5** | Editorial structure in the shell (asymmetric hero-number banding, ranked hairline tables, Pareto framing); dashboards, tables, and forms stay disciplined. Variance serves reading the numbers, never decoration. |
| MOTION_INTENSITY | **3-4** | Only two motions carry meaning: money counters count up (goal-gradient on recovered, loss-aversion on at-risk) and scroll/state reveals. Everything else is instant. Reduced-motion honored globally. |
| VISUAL_DENSITY | **6** | RCM managers live in spreadsheets: tabular figures, 14px base, hairlines over heavy cards, but with real inter-section breathing so an owner scans the headline number in two seconds. |

---

## 3. Design principles (build every screen against these)

1. **The number is the product.** Recovered SAR and money-at-risk get the largest type, the display face, tabular figures, and the only count-up motion. If a screen has a money truth, it is the largest thing on it.
2. **Loss before gain.** Lead with what is being lost, framed in the clinic's own payer and branch names. Endowment is manufactured by specificity, never a demo tenant.
3. **Hairlines over cards.** Structure comes from 1px rules and surface steps, not drop-shadowed card walls. Instrument, not consumer bubble.
4. **Transparent, never opaque.** Every scrubber flag traces to a named rule and the field that failed. Rules are data the clinic can read. No black-box ML at MVP.
5. **Trust is a visible layer, not a footer.** In-Kingdom residency, audit trail, RBAC, and human-in-the-loop are first-class UI objects because they close the sale.
6. **Arabic-first, RTL-native.** Not a mirrored English app. The Arabic surface is a first-class composition, digits and codes handled deliberately.
7. **Honest persuasion only.** No fake scarcity, no invented numbers, conservative recovery attribution. The recovery-share price only works if the number is trusted.

---

## 4. Visual system

Neutrals are cool graphite, never pure black or white. One locked brand accent. Money is a data-viz system, never decorative.

### 4.1 Foundation

**shadcn/ui (Radix Primitives + Tailwind), not Radix Themes.** Product surfaces (dashboards, tables, forms) are out of scope for pure landing-page taste rules; they need a design-system foundation with owned tokens.

- **Token ownership:** shadcn copies component source into the repo, so every hairline, radius, and focus ring is locked to us, not hidden behind a themeable scale.
- **RTL is CSS-owned:** Radix Primitives handle focus, keyboard, and ARIA (critical for RBAC-gated PHI); direction is driven entirely by Tailwind logical utilities plus `dir` on `<html>`.
- **Data-viz integration:** pair with Recharts or visx and style axes/tooltips from the same token file. Charts are part of the system.

Customize away from default state: replace default radius with the 6px control radius; strip shadcn's `ring-2 ring-offset-2` glow for a tight 2px cobalt ring with no offset halo; retint every shadow from black to ink; `Card` loses its shadow and gains a 1px inset hairline; fonts wired to Geist / IBM Plex Sans Arabic; numeric cells get a global `.num` utility.

### 4.2 Color tokens

**Neutrals (paper light / ink dark).** All carry a ~265 (cool blue-graphite) hue at near-zero chroma so ink and paper read as one instrument.

| Token | Light (hex / oklch) | Dark (hex / oklch) | Use |
|---|---|---|---|
| `--bg` | `#FBFBFC` / oklch(98.8% 0.002 265) | `#0A0A0B` / oklch(14.5% 0.004 265) | App canvas |
| `--surface-1` | `#FFFFFF` / oklch(100% 0 0) | `#131316` / oklch(17.5% 0.005 265) | Cards, table body |
| `--surface-2` | `#F4F4F6` / oklch(96.5% 0.003 265) | `#1B1B1F` / oklch(21% 0.006 265) | Raised/hover, header bars |
| `--surface-3` | `#ECECEF` / oklch(94% 0.004 265) | `#242429` / oklch(24.5% 0.006 265) | Wells, code blocks, quarantine tray |
| `--hairline` | `#E4E4E9` / oklch(91% 0.004 265) | `#2A2A30` / oklch(27% 0.007 265) | 1px borders, table rules |
| `--hairline-strong` | `#D2D2D9` / oklch(86% 0.005 265) | `#37373F` / oklch(31% 0.008 265) | Emphasis rules, active borders |
| `--text` | `#111114` / oklch(17% 0.005 265) | `#F4F4F6` / oklch(96% 0.003 265) | Primary text |
| `--text-muted` | `#5B5B64` / oklch(46% 0.006 265) | `#A1A1AC` / oklch(70% 0.006 265) | Secondary/labels |
| `--text-faint` | `#8A8A93` / oklch(60% 0.005 265) | `#6E6E78` / oklch(52% 0.006 265) | Axis ticks, large decorative only (not body captions; below AA at 14px) |

**Brand accent (locked, one). "Taweed Cobalt."** Used identically across app, marketing, and charts (as the primary/selected metric highlight only).

| Token | Hex | oklch | Notes |
|---|---|---|---|
| `--accent` | `#2557E4` | oklch(55% 0.18 256) | Primary actions, selected series, links, focus |
| `--accent-hover` | `#1E49C8` | oklch(50% 0.17 256) | Hover/active |
| `--accent-fg` | `#FFFFFF` | oklch(100% 0 0) | Text on accent (AA 5.1:1) |
| `--accent-subtle` | `#EAF0FE` / dark `#16233F` | oklch(96% 0.02 256) | Accent-tinted wells, selected rows |

Hue justification: cobalt at hue 256 reads fintech-trust and clinical-precision with instrument gravity (a deep steel-leaning cobalt, not a cheerful sky blue). It sits clear of AI-purple (280+), clear of Saudi-flag green (cliche and reserved), and clear of both money hues (amber ~65, emerald ~165), so the accent never collides with the money semantics.

**Money semantics (data-viz scale, never decorative).**

| Token | Hex | oklch | Meaning |
|---|---|---|---|
| `--at-risk` | `#C2410C` | oklch(55% 0.16 42) | Money at risk / denied (controlled rust, not alarm-red) |
| `--at-risk-soft` | `#D98324` | oklch(70% 0.14 65) | Warning tier / amber (softer denials, flags) |
| `--at-risk-bg` | `#FBEDE4` / dark `#2A1710` | oklch(95% 0.03 45) | At-risk fills, scrubber-flag rows |
| `--recovered` | `#0E9F6E` | oklch(64% 0.13 163) | Recovered / won (controlled emerald-teal) |
| `--recovered-soft` | `#14B8A6` | oklch(70% 0.11 178) | In-flight appeals / pending-favorable |
| `--recovered-bg` | `#E6F6F0` / dark `#0C2620` | oklch(96% 0.03 165) | Recovered fills, ROI banding |
| `--at-risk-text` | `#9A3208` | oklch(45% 0.15 42) | At-risk FIGURE / label text at 14px (AA on `--bg` and `--surface-1`) |
| `--recovered-text` | `#07734F` | oklch(50% 0.12 163) | Recovered FIGURE / label text at 14px (AA on `--bg` and `--surface-1`) |
| `--money-neutral` | `#64748B` | oklch(56% 0.03 250) | Pending / unknown / comparison baseline |

The bright `--at-risk` / `--recovered` are for **fills, bars, and large hero numbers (18px+ bold)** only. Any money figure or label at table/body size (14px) uses the darker `--at-risk-text` / `--recovered-text`.

- **Sequential (heatmaps, e.g. payer x code denial-rate):** amber-to-rust ramp `#FBEDE4 -> #F3C99A -> #E39A4E -> #C2410C -> #8A2C08`. Recovered heat mirrors emerald `#E6F6F0 -> #7FD8B9 -> #2FB889 -> #0E9F6E -> #076B4A`.
- **Categorical (multi-series, up to 5, semantics-safe):** `--accent` cobalt `#2557E4`, `--money-neutral` slate `#64748B`, cyan `#0891B2`, rose `#BE185D`, indigo `#4338CA`. Amber-rust and emerald are held out of the rotation so they always and only mean at-risk / recovered; no amber-adjacent hue (banned: bronze/ochre) and no violet in the AI-purple band (260 to 300) enters the rotation. If a 6th series is unavoidable, add a hue with clear lightness and hue separation from all five, never a second gray.

**Focus / borders / elevation.** `--focus-ring` = `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)` (2px gap + 2px cobalt), no glow. Borders default to `--hairline`, active steps to `--hairline-strong` or `--accent`. Elevation is surface step first, hairline second, shadow last.

**WCAG AA (recomputed from the tokens):** `--text` on `--bg` ~18:1. `--text-muted` on `--bg` ~6.5:1. `--accent` on `--bg` ~5.7:1 (passes AA normal text and UI, not just large). The bright `--recovered` on `--recovered-bg` is ~3:1, below AA for small text, so 14px money figures/labels use the darker `--at-risk-text` / `--recovered-text` (both clear 4.5:1 on `--bg` and `--surface-1`); the bright hues are reserved for fills, bars, and 18px+ bold hero numbers. `--text-faint` is axis-tick and large-decorative only, never body captions. **Never encode money state by color alone:** pair every at-risk/recovered with a label, sign, or glyph.

### 4.3 Typography

- **EN display:** **Cabinet Grotesk** (Medium/Bold) for hero numbers and section titles. Geometric editorial character, deliberately not Inter, gives the money-hero moments weight.
- **EN text/UI:** **Geist Sans**, clean at 14px, excellent tabular figures.
- **Mono (codes only):** **Geist Mono** for SBS/CPT codes, CARC/RARC reasons, claim IDs.
- **Arabic (all AR text):** **IBM Plex Sans Arabic** (Regular/Medium/SemiBold), used for both AR body and AR display. Matches Geist in x-height and weight, first-class Naskh forms, strong tabular numerals. One Arabic family, no separate display face, to keep the pairing tight.

**Tabular-figure rule (locked):** all numeric, money, and code content uses `font-feature-settings: "tnum" 1, "lnum" 1` via `.num`. Money never reflows column width as counters animate.

| Role | Size / line | Font / weight |
|---|---|---|
| Money hero | clamp(44px, 3vw+28px, 72px) / 1.0 | Cabinet Grotesk Bold, tabular |
| Display | 40px / 1.05 | Cabinet Grotesk Medium |
| H1 | 28px / 1.2 | Cabinet Grotesk Medium |
| H2 | 20px / 1.3 | Geist SemiBold |
| H3 | 16px / 1.4 | Geist Medium |
| Body | 14px / 1.5 | Geist Regular |
| Small / label | 12.5px / 1.4 | Geist Medium, +0.01em |
| Mono numeric (codes) | 13px / 1.4 | Geist Mono |
| Table cell / money | 14px tabular / 1.4 | Geist (`.num`) |

**Digit handling (locked):** Western Latin numerals (0-9) are the default for ALL money, table, chart, code, and metric content in BOTH locales. RCM/finance work in NPHIES/payer portals and spreadsheets that use Western digits, SBS/CARC codes are Latin, and Arabic-Indic digits break tabular alignment in dense grids. Arabic-Indic numerals are a per-user preference and, when enabled, apply only to AR narrative prose (headings, sentences, dates), never to tabular money/codes. Surface this as a read-only note in Settings so finance and RCM never argue about it.

### 4.4 Shape, spacing, elevation

**Radius scale (one, locked):** `--r-sm: 4px` (badges, chips, code pills), `--r-md: 6px` (default: buttons, inputs, selects), `--r-lg: 8px` (cards, panels, modals), `--r-xl: 12px` (hero stat banners only), `--r-full: 9999px` (avatars, toggle thumbs). No radius outside this scale.

**Spacing rhythm:** 4px base grid (4/8/12/16/20/24/32/40/48/64). Component internals 8-16, section gaps 32-64. Rhythm is intentional, not uniform: the hero money band gets 48-64 vertical breathing; dense table rows compress to 8-10. Never pad everything the same.

**Hairline-over-card doctrine:** structure from 1px `--hairline` borders and table rules, not shadows or filled cards. Tables use horizontal hairlines only, no vertical grid. Cards are `surface-1` plus a 1px inset hairline, no shadow at rest.

**Shadow tinting:** shadows only for true overlays (dropdowns, popovers, modals, toasts), ink-tinted, never pure black. `--shadow-sm: 0 1px 2px oklch(14% 0.02 265 / 0.06)`, `--shadow-md: 0 4px 12px .../0.10`, `--shadow-lg: 0 12px 32px .../0.14`. In dark mode deepen to 0.40-0.55 and add a top 1px hairline highlight.

### 4.5 Motion (two motivated motions, nothing decorative)

**Money counter count-up (the signature).** Trigger once, on first paint into viewport (IntersectionObserver) or on fresh data load, never loops. Duration 1000ms recovered / 900ms at-risk, easing `cubic-bezier(0.16, 1, 0.3, 1)`. Value eased via `requestAnimationFrame`, formatted each frame as `SAR {grouped}`, the `SAR` prefix in `--text-muted` at 0.5x, the number in the hero color. Tabular figures mandatory. Recovered counts up into emerald and settles with a one-frame brightness tick; at-risk counts up into rust so the leak feels like it is growing. A delta chip (up/down triangle + percentage vs prior period) animates in after settle.

**Reveal.** Dashboard load: opacity 0 to 1 + translateY 8px to 0, 320ms ease-out, 50ms stagger, once, IntersectionObserver-gated. Stat bands and chart cards only, not table rows.

**State feedback.** Row hover `surface-2` fill 120ms; button press scale 0.98 100ms; input focus ring 120ms; toast/quarantine slide-in from inline-end 200ms; scrubber risk-score ticks up 150ms as reasons expand.

**Reduced motion (`prefers-reduced-motion: reduce`):** counters render final value instantly, reveals become instant opacity with no translate, hover/press keep only color changes, no slides. One global motion-token guard.

---

## 5. Bilingual EN/AR + RTL system

**Logical properties everywhere.** `margin-inline-start/end`, `padding-inline-start/end`, `inset-inline-start/end`, `border-inline-start`, Tailwind `ms-/me-/ps-/pe-/start-/end-`. Zero physical `left`/`right`/`ml-`/`mr-` in layout. Alignment via `text-start`/`text-end`. Direction switches from a single `dir="rtl"` + `lang="ar"` on `<html>`; the whole shell mirrors from that flip. Arabic is the default for new owner accounts.

**Mirrors:** page layout, nav rail, sidebars, table column order, breadcrumb flow, directional icons (arrows, chevrons, progress carets), tab order, drawer origin, toast origin.

**Does NOT mirror:**
- **Numbers and money figures:** always LTR digit order, wrapped in `.num` with `dir="ltr"` + `unicode-bidi: isolate` so Latin numerals stay correct inside Arabic sentences.
- **Codes:** SBS/CPT/CARC/claim IDs stay LTR mono, wrapped in `bdi` inside Arabic rows.
- **Logo and wordmark:** fixed orientation.
- **Chart numeric axis and value labels:** LTR Western digits. In RTL the time-series plots time flowing inline-start to inline-end (right to left) following reading direction, but tick and value labels remain LTR. Categorical ranked bars order longest-at-inline-start in both directions.

**Font-swap per locale:**
```css
html[lang="en"] { --font-ui: "Geist", sans-serif; --font-display: "Cabinet Grotesk"; }
html[lang="ar"] { --font-ui: "IBM Plex Sans Arabic", sans-serif; --font-display: "IBM Plex Sans Arabic"; }
/* .num sets tabular + LTR ONLY, so figures keep their element's own font (Geist in tables, Cabinet Grotesk in hero) */
.num { direction: ltr; unicode-bidi: isolate; font-feature-settings:"tnum" 1,"lnum" 1; }
.num--hero { font-family: "Cabinet Grotesk"; } /* money-hero figures: display face + tabular */
code, .mono { font-family: "Geist Mono", "Geist"; direction: ltr; font-feature-settings:"tnum" 1,"lnum" 1; }
```

Verify Cabinet Grotesk ships a `tnum` feature before shipping the hero; if it does not, render `.num--hero` figures in Geist (tabular-verified) at the hero size instead. Table and chart figures inherit Geist and are unaffected. The Arabic appeal letter is a first-class composed document (right-aligned, Arabic display face, correct honorifics and payer name in Arabic), never a mirrored English one. Latin claim IDs, SBS codes, and a payer's English legal name stay LTR-isolated inside Arabic body text.

---

## 6. Data-viz system

Charts are built from the §4.2 tokens; money semantics are reserved and never reused decoratively.

| Surface | Chart | Rules |
|---|---|---|
| Denial rate by payer/branch/provider/code | Ranked **horizontal bars**, sorted descending, longest at inline-start | Bars `--money-neutral`; selected/primary bar `--accent`; if the bar encodes at-risk SAR, `--at-risk` |
| Denial reason breakdown (CARC/RARC-equiv) | **Pareto** (bars + cumulative line) to prove "4 reasons drive 80%" | Bars `--money-neutral`, cumulative line `--accent` |
| Trend over time | **Line / area** | Denial-rate line neutral; at-risk area `--at-risk-bg` + `--at-risk` stroke; recovered `--recovered` |
| Payer x code denial matrix | **Heatmap** | Sequential amber-to-rust ramp |
| First-pass / collection vs target | **Bullet bar** (actual vs target marker) | Not a decorative gauge |
| Recovery funnel | Submitted to won/lost horizontal funnel | Won `--recovered`, lost `--money-neutral`, in-flight `--recovered-soft` |

Color rules: at-risk always amber/rust, recovered always emerald, both held out of the categorical rotation; cobalt marks the primary/selected/target metric only; never rely on hue alone (direct value labels, plus check/x glyphs on won/lost); gridlines `--hairline` horizontal only; tooltips `surface-1` + `--shadow-md` + hairline, values in `.num`.

**Hero numbers (centerpiece):** money-at-risk and recovered SAR render as full-width stat bands at the top of Denial Analytics and Recovery Tracking, Cabinet Grotesk at money-hero size, tabular, with count-up, a muted `SAR` prefix, and a delta chip vs prior period. Every hero number carries provenance ("from your NPHIES data") or a `MOCK` badge in `--money-neutral` for demo. Never a fake-perfect number unlabeled.

---

## 7. App shell + navigation

A three-zone shell, not a sidebar-and-cards dashboard. Hairline dividers separate zones, not drop-shadowed card walls.

- **Rail (inline-start, 64px collapsed / 240px expanded):** primary module nav, icon + label, flips to inline-end in RTL with mirrored glyphs, icon-only on tablet.
- **Command bar (top, 56px, sticky):** inline-start = tenant + branch switcher; center = global search (claims, payers, appeals by ID); inline-end = the persistent money indicator, locale toggle, theme toggle, account/role chip.
- **Canvas:** the module surface, content measure capped so wide tables scroll inside their own `overflow-x`, never the page body.

**Role-aware nav (RBAC).** Modules render conditionally on role; rail order follows the recovery loop, not alphabetical.

| Order | Module | owner | finance | rcm | clinician | admin |
|---|---|---|---|---|---|---|
| 1 | Overview (ROI home) | full | full | full | read | read |
| 2 | Denial Analytics | full | full | full | read | read |
| 3 | Ingest | hidden | upload | full | hidden | full |
| 4 | Scrubber | read | read | full | flag-only | read |
| 5 | Appeal Generator | approve | review | full | evidence | read |
| 6 | Recovery Tracking | full | full | full | hidden | read |
| 7 | Settings / Rules / Audit | full | limited | rules | hidden | full |

Owner lands on **Overview** (the number). RCM lands on **Denial Analytics** or a work queue. Role is a status chip in the command bar; switching role from the UI is impossible (server-enforced).

**Global money indicator (persistent, command bar), the signature element.** A dual-figure module, always current for the active tenant + branch scope:

```
[ Recovered  SAR 412,900 ▲ ]   [ At risk  SAR 1.84M → ]
```

Recovered = emerald, up-arrow, counts up on first paint and re-animates on any new recovery event (goal-gradient). At risk = amber/rust, neutral arrow, counts up once on first paint into view (the leak growing) but does not re-animate on later recovery events (loss framing, not celebration); it decrements quietly as money moves to recovered. Scope label under the figures reads the switcher selection ("Al Salama Dental, all branches, last 90 days"). Click expands a 3-row popover (recovered this month, open appeals value, at-risk by top payer) deep-linking to Recovery Tracking. Reduced-motion snaps to final value.

**Tenant / branch switcher:** two-level combobox, Level 1 Tenant (one per contract), Level 2 Branch (multi-select, "All branches" default), model-bound, global state every module subscribes to. Realistic branch names ("Riyadh, Olaya", "Jeddah, Al Rawdah", "Dammam, Al Faisaliyah").

**Trust in chrome:** a compact data-residency lockup ("In-Kingdom data, Riyadh (Oracle Cloud) · PDPL"), graphite hairline treatment, not a green padlock. Export/print actions carry a subtle "audited" affordance so the trust story is legible in the UI, not buried in a compliance PDF. Every PHI-touching action writes `AuditLog`.

---

## 8. The five module surfaces

Common rules: one accent, one radius, one theme per surface, tabular figures, logical properties for full RTL mirroring, money as the two-tone data-viz system, the number as hero. No status-dot columns, no uniform-card wrapping of tabular data, no three-equal cards. Every empty state teaches its own population path. Every loading state is a skeleton shaped to the real layout, not a spinner. Examples use realistic KSA payers (Bupa Arabia, Tawuniya, MedGulf) and NPHIES denial reasons.

### 8.1 Ingest

- **Job:** turn raw NPHIES `ClaimResponse` + `Claim` FHIR R4 JSON, CSV/XLSX remittance, and PDF EOB into validated `Claim` / `ClaimLine` / `Denial` rows, fast and legibly, malformed rows quarantined not silently dropped.
- **Layout intent:** a **split view**. Inline-start = a tall dropzone with a file-type legend (FHIR JSON, XLSX, CSV, PDF-EOB) and the format each maps to. Inline-end = a live **run ledger**, a vertical timeline (Received, Parsing, Validating, Ready) with running counts and big tabular counters (rows parsed, claims created, denials detected, quarantined) ticking up as the stream processes.
- **Components + states:** dropzone (idle, drag-hover with accent hairline no glow, uploading, post-parse summary); field-mapping panel for CSV/XLSX (detected column to model field, confidence, override select; FHIR skips this; PDF routes through OCR with a review-fields step); **quarantine table** (malformed rows with the specific reason, inline-editable, re-validate in place); skeleton shaped to the run-ledger; empty state that teaches with a sample-file download and a "book white-glove import" button; error state that explains the file not the stack.
- **Hero moment:** counters resolving to "1,214 claims, 386 denials detected, SAR 1.84M at risk" the instant the first real file lands; the at-risk figure animates into the global indicator. First upload equals first proof.

### 8.2 Denial Analytics (the WOW demo and the free-audit engine)

- **Job:** prove the leak in the client's own numbers. Pure read-side.
- **Layout intent:** an **editorial bento**, deliberately asymmetric. Top strip = one oversized hero stat (denial rate + money-at-risk, the largest type in the app). Below, a broken grid: a wide trend line (with a submission-volume ghost series), a ranked payer bar list, a denial-reason Pareto/treemap. Not four equal tiles; scale contrast carries hierarchy, hairlines separate cells.
- **Components + states:** hero stat block ("Denial rate 31.8%. SAR 1.84M at risk, last 6 months." sub-line "Industry first-pass benchmark ~15%", the gap is the payload; this is the one canonical demo dataset, SAR 1.84M at risk / SAR 412,900 recovered over the last 6 months, reused everywhere so no example number contradicts another); trend line with payer-policy annotations; ranked payer list (Bupa Arabia, Tawuniya, MedGulf, each = denial-rate bar + at-risk SAR + trend arrow, sorted by money not count, click opens payer profile); denial-reason breakdown (top CARC/RARC-equiv reasons, each with count, SAR, and a "how to fix" link into Scrubber rules); skeleton of the exact bento cells; empty state linking to the running Ingest job.
- **Hero moment:** the whole board resolving from their own data inside the 10-minute window, the single largest number being money they are losing, attributed to a named payer. That is the sales close.

### 8.3 Pre-submission Scrubber

- **Job:** flag claims likely to deny BEFORE submission, with a transparent risk score and human-readable reasons. Every flag traces to a named `Rule`. Not opaque ML.
- **Layout intent:** **table-first**, the densest surface. A claims batch as a scan-optimized table with a risk column that reads at a glance, plus a right-docked detail drawer on row select (master-detail, no page nav). The rules library is a separate transparent list, each `Rule` shown as data (condition, source, severity, edit history).
- **Components + states:** scrub table (claim ID, patient minimized to initials + partial ID per PHI-minimization, payer, SBS codes, amount, **risk score** 0-100 with a segmented amber-to-rust bar, reason count, status; tabular figures, hairline rows); risk cell shows score + top reason inline ("82 · Pre-auth missing", not a colored dot); detail drawer (`ScrubResult`) listing each triggered `Rule` with the failed field, the payer rule cited, and the fix ("Bupa Arabia requires prior authorization for SBS 97110 over 6 units", "Patient gender conflicts with procedure code", "Eligibility gap: policy inactive on service date", "Bundling edit: 99213 not billable with 20610 same visit"); bulk actions (mark reviewed, send back to branch, clear flag with note, each writing `AuditLog`); skeleton with shimmering risk-bar placeholders; empty state with a "run scrubber on latest batch" CTA; a rule that cannot evaluate shows "needs data" not a false pass.
- **Hero moment:** running a live batch, risk scores populating, then "Fixing these 41 flags protects SAR 74,600 you would otherwise resubmit." Prevention in the same money units as recovery.

### 8.4 Appeal Generator (human-in-the-loop, never auto-submits)

- **Job:** auto-draft a reconsideration letter (EN/AR) matched to the `Denial` reason + `Payer` template, assemble the evidence checklist, let a human review and export.
- **Layout intent:** a **split composer**. Inline-start = the denial context (`Claim`, `ClaimLine`, denial reason, prior correspondence) as fixed reference. Inline-end = the editable draft letter. Below = the supporting-doc checklist. The "Export PDF" and "Mark submitted" actions are visually separated from the draft and gated behind a review confirmation, so the human-in-the-loop stance is architectural.
- **Components + states:** appealable queue (denials filtered to recoverable by reason, sorted by SAR, each with claim, payer, reason, amount, and a payer-specific appeal-deadline countdown; bulk "generate drafts"); composer (`Appeal`) with locked structural fields (claim ref, member ID, payer, provider, cited SBS code, denial reason, clinical-justification slot) and editable prose, language toggle that regenerates the letter natively in EN or AR (not machine-translated); supporting-doc checklist (reason-driven: "attach pre-authorization number", "attach operative note", "attach eligibility screenshot"); a required "reviewed by [name], role" gate before export enables (writes `AuditLog`); export to PDF (payer-formatted) plus a copy-block for manual portal paste, no submit-to-payer button; rare payer/reason falls back to a neutral base template with a visible "template not payer-specific" banner.
- **Hero moment:** clicking one denial and a complete, payer-shaped, bilingual reconsideration letter appearing in seconds, the exact SAR being appealed shown at the top. The RCM manager's rework time collapses.

### 8.5 Recovery Tracking (the proof loop)

- **Job:** track each `Appeal` from submitted to won/lost, log recovered SAR, feed the ROI proof loop that closes the sale and justifies recovery-share pricing.
- **Layout intent:** a **status pipeline plus an ROI header**, not a kanban toy. Top = the ROI band (recovered to date, recovery rate, median days-to-recovery, recovered-versus-fee so the recovery-share model is transparent). Below = a status table grouped by stage (Submitted, Under review, Won, Partially paid, Lost) with SAR rolled up per stage.
- **Components + states:** ROI band ("SAR 412,900 recovered. 68% win rate. 22-day median. Your share of recovered: SAR 49,548." recovered figure is the emerald hero, counts up on new wins); pipeline table (each `Appeal` with claim, payer, appealed SAR, recovered SAR, stage, days-open, owner; inline stage change writes outcome + `AuditLog`); outcome logging (Won with recovered amount and partial-pay auto-diff, Lost with a reason that feeds Scrubber rule improvement, Under review with a follow-up date); feedback into Analytics as a "recoverability" overlay so the loop compounds; recovered-exceeds-appealed blocks with an inline correction to protect the ROI integrity the pricing depends on.
- **Hero moment:** logging "Won, SAR 18,200" and watching it flow up into the ROI band and the global money indicator in one motion. Real, labeled, from-their-data recovered SAR is the product promise made visible.

### 8.6 Data tables done right (Scrubber, Appeals, Recovery, quarantine, audit)

Row height 40px comfortable / 32px compact (toggle). All numerics tabular and aligned to inline-end (right-align numbers even in RTL, the correct financial convention); text columns to inline-start. Hairline row separators over card borders, zebra off, hover-row tint instead. SAR columns tint only the figure using `--at-risk-text` / `--recovered-text` (AA at 14px), never the whole row. Compact inline mini-viz (segmented bar, sparkline) inside cells as part of the design system. Sticky header; identifier and money columns can pin while mid-columns scroll in the table's own overflow. Column-header sort with a mirror-aware active indicator, **default sorts money-first** (by SAR), not ID. Typed filter chips (payer, branch, reason, date range, risk threshold) persisted to URL params so a filtered view is shareable. Bulk action bar on selection shows selection count and **summed SAR** ("41 claims selected, SAR 74,600") and writes `AuditLog` with an undo affordance where reversible. Full RTL mirror with numbers/codes LTR-isolated via `bdi`.

---

## 9. First-run flow (under 10 minutes to first insight) + free-audit report

A single guided corridor, not a settings wizard. Four steps, a persistent progress ledger, explicit target: "See your first denial map in under 10 minutes." This is BJ Fogg's B = MAP made concrete: Motivation is pre-loaded by the sales-stage free audit, Ability is maximized by white-glove import and forgiving ingest, the Prompt is one primary action per screen.

1. **Locale + theme (one screen, 15 seconds):** Arabic or English, light or dark. Owner default Arabic. No account bureaucracy up front.
2. **Scope confirm:** confirm the `Tenant` and select branches (pre-seeded from contract). One branch is enough. This small self-act (IKEA effect) starts ownership.
3. **Upload (the activation moment):** the Ingest dropzone in a focused, chromeless frame. "Drag 3 to 6 months of remittances. NPHIES ClaimResponse export, XLSX, or EOB PDF." A prominent "Do this with me" books the white-glove first import (removes the biggest drop-off). Live counters replace the screen as parsing runs.
4. **First insight handoff:** the instant parse completes, the corridor dissolves directly into **Denial Analytics** with the hero stat resolved. No "you're all set" dead-end. The first thing the owner sees is their own money-at-risk figure attributed to a named payer. This is the **peak** (peak-end rule); the session **end** is a forward loop ("Run the scrubber on your next batch"), so the last feeling is agency.

Activation-energy reducers: sample file always available; field-mapping auto-detected with override; quarantine instead of hard-fail; no credit-card or config wall between upload and insight.

**Free-audit leave-behind report.** A dedicated, exportable **Audit Report** view generated from the prospect's own uploaded data, designed to be shown to and left with the owner-physician. A single scrollable editorial document (branded, print/PDF-ready), not the live app. Cover figure: "SAR 1.84M denied across the last 6 months, 31.8% denial rate." Sections: leak by payer (Bupa Arabia / Tawuniya / MedGulf ranked by SAR), top denial reasons with plain-language fixes, a recoverable-versus-structural split, and a projected-recovery range tied to recovery-share pricing. Trust footer: in-Kingdom residency (PDPL, Oracle Cloud Riyadh), AES-256 at rest, "not an SFDA medical device, decision-support with human review", per-tenant isolation. Every figure carries a source label ("from your uploaded remittances, [date range]"). Bilingual export; the Arabic version is a real Arabic document.

---

## 10. Persuasion & narrative layer (models mapped to concrete moments)

Ethical, real-value persuasion. No dark patterns.

**The two counters are one instrument, not two widgets.**
- **Money-at-risk (loss frame).** Top inline-start of every analytics surface, `--at-risk`, tabular, counts up from zero to the real leak on first load (**loss aversion + contrast effect**). Label precisely: "Denied, not yet recovered (last 6 mo)". Never "potential" or "estimated" unless labeled mock.
- **Recovered SAR (gain frame, goal-gradient engine).** Top inline-end, `--recovered`, starts at zero, climbs as appeals are won. Design them as a **depleting reservoir**: every recovered SAR visibly decrements at-risk and increments recovered. The user watches the red pool drain into the green pool. That mechanic is the product's beating heart.
- **The gap between them** ("still on the table") is the open loop that pulls the champion back tomorrow (**Zeigarnik effect**).
- **Endowment effect:** the moment the owner sees their own denied SAR from their own NPHIES data, that money becomes psychologically theirs. First reveal must show their payer and branch names, never a demo tenant. Ownership is manufactured by specificity.

**Trust architecture (Cialdini authority + demonstration beats assertion).** Persistent data-residency badge in chrome; an **audit trail the owner can open** on any PHI record ("who viewed this, when, from which role") because showing it works beats stating it exists; the RBAC role badge visible at login and in headers (least-privilege made visible); a "Not an SFDA medical device, human reviews every appeal" line wherever the generator outputs. Address the four owner objections in-product at the moment each fires:

| Objection | Where | In-product answer (model) |
|---|---|---|
| Another system to run | Onboarding / import | "No new system. We read your NPHIES data. Nothing to migrate." (Ability, Fogg) |
| Data export is a hassle | Ingest empty state | White-glove first import (activation energy removed) |
| PDPL / is my data safe | Persistent chrome + import | Residency + audit + RBAC trust objects (Authority) |
| Will this actually recover money | Everywhere the number lives | Recovery Tracking real won-SAR, conservative attribution (Proof) |

**The proof loop / flywheel (recovered SAR = North Star).** Analytics reveals the leak, Scrubber prevents new denials, Appeals + Recovery convert past denials to recovered SAR, recovered SAR validates the recovery-share price and funds renewal, and each won appeal **teaches the rules engine** which payer + code combinations recover, sharpening future flags. More wins, smarter rules, more wins. An explicit one-tap **Owner report** export (recovered this month, first-pass improvement, top payers recovered from, EN/AR, tabular, on-brand) makes the champion the hero to the owner (**unity + liking**), which is the retention engine, and doubles as an anonymizable case-study proof card.

**Social proof, honestly:** once real, show anonymized peer benchmarks ("Polyclinic groups your size recover a median of X% of denied SBS-coded claims"). Until real data exists, the free-audit finding is the proof. No invented testimonials, no Jane Doe, no Acme.

---

## 11. Voice & microcopy (Arabic-first, numbers-first)

Register: sharp, concrete verbs, tabular numerals, Arabic-first. Banned: elevate, seamless, unleash, filler adjectives, em-dashes.

| # | Moment | EN | AR intent |
|---|---|---|---|
| 1 | Ingest empty state | No data yet. Drop your NPHIES ClaimResponse files, remittance CSV, or EOB PDFs. We do your first import with you. | لا توجد بيانات بعد. أضف ملفات نفيس أو كشف الحوالة أو ملفات EOB. نقوم بأول استيراد معك. |
| 2 | Money-at-risk label | SAR 482,300 denied and not yet recovered. Last 6 months. From your data. | 482,300 ريال مرفوضة ولم تُسترد. آخر 6 أشهر. من بياناتك. |
| 3 | Recovered counter | SAR 96,400 recovered. Bupa Arabia leads your wins. | 96,400 ريال تم استردادها. بوبا العربية في صدارة عملياتك. |
| 4 | Denial explanation | Tawuniya denied 214 claims for missing pre-authorization. SBS code 23070. This one reason cost you SAR 61,200. | رفضت التعاونية 214 مطالبة بسبب غياب الموافقة المسبقة. رمز SBS 23070. هذا السبب وحده كلّفك 61,200 ريال. |
| 5 | Scrubber flag | High deny risk. Age does not match SBS code 41010 for this patient. Fix before you submit. | احتمال رفض مرتفع. العمر لا يطابق رمز SBS 41010 لهذا المريض. صحّح قبل الإرسال. |
| 6 | Appeal-ready nudge | 12 denials are appeal-ready. Drafts written. You review, you send. | 12 مطالبة مرفوضة جاهزة للاعتراض. الرسائل مكتوبة. أنت تراجع وأنت ترسل. |
| 7 | Recovery win | Won. SAR 8,700 recovered from MedGulf. Moved from at-risk to recovered. | تم القبول. استُرد 8,700 ريال من ميدغلف. انتقلت من المعرّض للخطر إلى المسترد. |
| 8 | Trust / PDPL (import) | Your data stays in the Kingdom, Riyadh. Encrypted. Every access is logged. Nothing leaves. | بياناتك تبقى داخل المملكة، الرياض. مشفّرة. كل وصول مُسجّل. لا شيء يغادر. |
| 9 | Human-in-the-loop label | Draft, not sent. A person reviews every appeal. Taweed never submits on its own. | مسودة، لم تُرسل. شخص يراجع كل اعتراض. Taweed لا يرسل من تلقاء نفسه. |
| 10 | First-run goal-gradient | Step 2 of 3. You have seen the leak. Now recover your first claim. | الخطوة 2 من 3. رأيت التسريب. الآن استرد أول مطالبة. |
| 11 | Owner report CTA | Build the owner report. One page. What you recovered this month. | أنشئ تقرير المالك. صفحة واحدة. ما استرددته هذا الشهر. |
| 12 | Quarantine (non-blocking) | 18 rows could not be read and were set aside. The other 1,240 imported. Review the 18 anytime. | تعذّرت قراءة 18 سطراً وتم عزلها. استُوردت البقية 1,240. راجع الـ18 متى شئت. |

Per the locked digit law (§4.3), all money, counts, and SBS codes render Western digits in both locales, as modeled above. Arabic-Indic digits are a per-user preference limited to AR narrative dates and prose, never tabular money or codes. The Arabic wordmark (تعويض) needs a native RCM-domain speaker sign-off before any Arabic surface ships; the brand appears Latin-isolated inside AR strings until then (row 9).

---

## 12. Marketing landing surface (pre-login)

Separate from the app shell but the **same** design system: graphite/ink ground, Taweed Cobalt, amber/emerald money semantics, EN/AR toggle Arabic-first, editorial structure (variance 5), the number as hero. Structured on **AIDA**, wedged at the owner-physician. This surface follows landing-page taste rules (hero fits the viewport, one accent locked, real images not div-screenshots, one theme per page, motion motivated, zero em-dashes).

- **Attention (hero):** the number is the hero, not a headline over a stock clinic photo. One line, huge tabular treatment: "You are losing SAR ___ a year to denied claims. See exactly which payers and codes are draining it, from your own NPHIES data." Arabic-first mirror. No gradient blob, no three cards. The at-risk counter aesthetic previews the product's core moment.
- **Interest:** the wedge as category claim, "NPHIES-native denial recovery for mid-market clinic groups. No new system." Three proof beats laid out editorially (not three equal cards): See the leak (analytics), Stop new leaks (scrubber), Recover the old ones (appeals + tracking). Real payer names, realistic KSA clinic personas.
- **Desire:** recovery-share as the trust hook, "You pay a per-branch base plus 10 to 15% of what we actually recover. If you do not recover, that share is zero." Price aligned to proof is itself persuasion. Reinforce with trust objects: in-Kingdom, PDPL, audit trail, human-in-loop.
- **Action (the free-audit offer):** "Get a free denial audit on your own data. We quantify the leak in one report. No commitment." A foot-in-the-door + reciprocity move: a genuinely valuable free artifact (their real leak number) that hands the owner the exact figure that triggers loss aversion. The audit is the top of the sales funnel.

Motion: the hero figure counts up once on scroll into view, reduced-motion honored. No scroll-jacking.

---

## 13. Anti-slop guardrails (Claude Design must honor every box)

- [ ] **Zero em-dashes and zero en-dash separators** anywhere (headlines, labels, body, tables, captions). Use periods, commas, or plain hyphens only.
- [ ] **One accent** (Taweed Cobalt `#2557E4`) used identically across app, charts, and marketing. Cobalt marks primary/selected/target only, never money state.
- [ ] **Money semantics reserved:** amber/rust = at-risk, emerald = recovered, held out of the categorical chart rotation, never decorative, never encoded by color alone.
- [ ] **One radius scale** (4/6/8/12px + full), **one type pairing** (Cabinet Grotesk + Geist + IBM Plex Sans Arabic), **one theme per surface**.
- [ ] **Hairlines over cards.** No drop-shadowed card walls, no faux-3D headers, no status-dot columns.
- [ ] **No AI-purple, no generic glassmorphism, no three-equal feature cards, no gradient blobs.**
- [ ] **No dashboard-by-numbers.** Editorial bento with real hierarchy and scale contrast; the money number is the largest thing on a screen that has one.
- [ ] **No fake screenshots** built from divs. Use real component previews or generated images.
- [ ] **No fake-perfect numbers** unlabeled. Every hero figure carries provenance ("from your NPHIES data") or a `MOCK` badge. Realistic KSA payer names (Bupa Arabia, Tawuniya, MedGulf), no Jane Doe, no Acme.
- [ ] **No filler verbs** (elevate, seamless, unleash, next-gen). Concrete verbs only.
- [ ] **Arabic-first RTL is real:** logical properties only, full mirroring, Arabic display face, numbers/codes LTR-isolated, digit-handling per §4.3.
- [ ] **Trust legible in UI:** residency badge, openable audit trail, RBAC role badge, human-in-the-loop label.
- [ ] **Every empty state teaches; every loading state is a shaped skeleton; every table has an error/quarantine state.**
- [ ] **WCAG AA** minimum (14px money figures use the `-text` money tokens, not the bright fill hues); money state never by color alone; reduced-motion collapses every motion (the count-up and reveals included) to an instant final state.

---

## 14. Build notes

- **Stack alignment (from `02_product_build_plan.md`):** Next.js (React) + TypeScript, Tailwind (logical utilities, `dark:` variant), shadcn/ui (owned components, customized away from default), Recharts or visx for data-viz styled from the token file. RTL via `dir` on `<html>` + logical properties. Motion via Motion (`motion/react`) for state/reveal, `requestAnimationFrame` for the count-up. All figures through the global `.num` utility.
- **Token file first.** Generate `tokens.css` (§4.2 color, §4.3 type, §4.4 radius/spacing/shadow) before any component. Everything references tokens; no hardcoded hex in components.
- **What to generate first (proof-driven order, matches the demo narrative):**
  1. App shell + command bar + the persistent dual money indicator (the signature).
  2. Denial Analytics (the WOW demo, the free-audit engine).
  3. Ingest split view + quarantine + first-run corridor (the activation path).
  4. Scrubber table + detail drawer.
  5. Appeal composer.
  6. Recovery Tracking ROI band + pipeline.
  7. Free-audit report export + marketing landing.
- **Data model to bind (from `02` §7):** Tenant, Branch, Provider, Payer, Patient (minimized), Claim, ClaimLine, ClaimResponse, Denial, Rule, ScrubResult, Appeal, AppealTemplate, AuditLog, User (roles owner/finance/rcm/clinician/admin).
- **Generate both themes and both locales for every surface before declaring it done.** Do not ship a surface seen in only one theme or one language.
