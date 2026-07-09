// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import type { AppealResult } from "@/lib/appeals-data";
import type { AppealSuggestion } from "@taweed/appeals";

// Regression tests for CONFIRMED WCAG AA / manual-audit findings on
// /en/appeals (Appeal Generator), composer-open state:
//
// 1. [axe:label] The letter-body textarea and each AI-suggestion paragraph
//    textarea had no accessible name. Fixed: the main textarea takes
//    `aria-label={t("draft")}`; each paragraph textarea takes
//    `aria-labelledby` pointing at its adjacent "AI draft" Badge (which now
//    carries a matching `id`), instead of relying on a purely visual badge.
// 1b. [manual-visual] When 2+ AI suggestion paragraphs come back, every
//    paragraph's Badge (and thus every textarea's aria-labelledby name) read
//    the same static "AI draft" string, so a screen-reader user tabbing
//    between them heard "AI draft, edit text" repeated with nothing to tell
//    paragraph 1 apart from paragraph 2. Fixed: the badge is now numbered
//    per paragraph (`aiDraftLabelNumbered`, "AI draft {n}"), so each
//    paragraph's textarea gets a distinguishing accessible name.
// 4. [manual-keyboard] The language toggle conveyed the active language via
//    background color only, with no `aria-pressed` and no focus-visible
//    ring — unlike every other toggle in this file (e.g. rule-authoring.tsx's
//    scope toggle). Fixed: both buttons now carry `aria-pressed` and (per the
//    docs/a11y.md #20 follow-up sweep) the shared `.focus-ring` utility used
//    throughout the shell, instead of a hand-rolled
//    `focus-visible:ring-2 focus-visible:ring-accent` pair.
// 5. [manual-visual] Queue rows marked the loaded denial via background color
//    (`bg-accent-subtle`) only, with no `aria-current`. Fixed: the selected
//    row's button now carries `aria-current="true"`.
// 6. [manual-visual] denialLabel() (packages/shared/src/denial-codes.ts) is
//    always the hardcoded English CARC/RARC label — no Arabic variant
//    exists. The queue row and the composer's context header rendered that
//    label with no `lang` attribute, so an Arabic-locale page (html
//    lang="ar" dir="rtl") announced it as untagged English (WCAG 3.1.2
//    Language of Parts). Fixed: both spots wrap the label in
//    `<span lang="en">`.
// 7. [manual-keyboard] The queue rendered every row as its own Tab stop with
//    no roving-tabindex/listbox pattern, so with a large queue (e.g. 100
//    appeal-ready denials) reaching the composer's controls after selecting
//    a row required tabbing past every remaining row. Fixed: roving
//    tabindex — only the row at `queueFocusIdx` has `tabIndex=0` (all
//    others `-1`), so the whole queue is a single Tab stop; ArrowUp/
//    ArrowDown/Home/End move focus between rows without consuming Tab
//    presses (standard composite/listbox keyboard pattern).
// 8. [manual-keyboard] The "confirm review" checkbox was a bare native
//    <input type="checkbox"> with no focus-visible ring styling, breaking
//    the accent-ring focus language used by every neighboring control on
//    this page. Fixed: same `focus-visible:outline-none focus-visible:ring-2
//    focus-visible:ring-accent` utility used by the Input/textarea/buttons
//    around it.
// 9. [manual-visual] Every "Insert" button on the AI-suggestion paragraphs
//    shared the identical accessible name "Insert", so a screen-reader user
//    tabbing/browsing the button list could not tell which paragraph a
//    given button would insert — unlike the sibling Badge label, which was
//    already numbered for exactly this reason (see #1b). Fixed: each button
//    now carries `aria-label={t("insertNumbered", { n: idx + 1 })}` ("Insert
//    AI draft {n}"), giving every Insert button a distinct accessible name
//    while the visible "Insert" text is unchanged.
// 10. [manual-visual] Selecting a queue row swaps the entire composer panel
//    (empty -> pending -> loaded) via conditional JSX with no aria-live
//    region and no focus move, so a screen-reader user who clicks a row
//    hears nothing confirming the selection registered or that the draft
//    loaded (WCAG 4.1.3 Status Messages) — contrast with the AI-suggestions
//    sub-panel, which correctly carries `role="region" aria-label`. Fixed:
//    an always-mounted `role="status" aria-live="polite"` node (sr-only,
//    mirroring the ingest-panel.tsx/eob-review-queue.tsx convention) now
//    announces "Loading appeal draft…" while the draft loads and "Appeal
//    draft loaded: {payer}, SAR {amount}." once it lands.

const draft: AppealResult = {
  context: {
    claimId: "claim-1",
    nphiesClaimId: "NPHIES-1",
    sbsCode: null,
    denialCode: "D01",
    denialCategory: "D01",
    payerName: "MedGulf",
    providerName: "Al Salama Dental Group",
    memberId: "member-1",
    atRiskSar: "1437.00",
    serviceDate: "2026-01-01",
  },
  draft: {
    subject_en: "Reconsideration request",
    body_en: "Dear MedGulf, we appeal this denial.",
    subject_ar: "طلب إعادة نظر",
    body_ar: "عزيزي ميدغلف، نعترض على هذا الرفض.",
    docChecklist: [{ key: "eob", label_en: "EOB", label_ar: "بيان الشرح" }],
    payerSpecific: false,
  },
  pdfEn: { locale: "en", title: "t", blocks: [] },
  pdfAr: { locale: "ar", title: "t", blocks: [] },
  reasonLabel: "Patient not eligible on service date",
  deniedSar: "1437.00",
};

const suggestion: AppealSuggestion = {
  paragraphs_en: ["First AI paragraph.", "Second AI paragraph."],
  paragraphs_ar: ["الفقرة الأولى.", "الفقرة الثانية."],
};

vi.mock("@/lib/actions/appeals", () => ({
  loadAppealDraft: vi.fn(async () => draft),
  recordAppealExport: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/actions/assist-appeal", () => ({
  assistAppealAction: vi.fn(async () => ({
    ok: true,
    suggestion,
    suggestionId: "sugg-1",
  })),
  recordSuggestionEditAction: vi.fn(async () => {}),
}));

import { AppealsComposer } from "@/components/modules/appeals-composer";
import { loadAppealDraft } from "@/lib/actions/appeals";

const queue = [
  {
    denialId: "denial-1",
    claimId: "claim-1",
    nphiesClaimId: "NPHIES-1",
    payerName: "MedGulf",
    reasonCode: "D01",
    reasonLabel: "Patient not eligible on service date",
    category: "D01",
    deniedSar: "1437.00",
    sbsCode: null,
    deadlineDays: 15,
  },
  {
    denialId: "denial-2",
    claimId: "claim-2",
    nphiesClaimId: "NPHIES-2",
    payerName: "Bupa Arabia",
    reasonCode: "D02",
    reasonLabel: "Prior authorization missing",
    category: "D02",
    deniedSar: "1000.00",
    sbsCode: null,
    deadlineDays: 10,
  },
];

function renderComposer(locale: "en" | "ar" = "en") {
  const messages = locale === "ar" ? arMessages : enMessages;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ appeals: messages.appeals, common: messages.common, trust: messages.trust }}
    >
      <AppealsComposer queue={queue} reviewerName="Reviewer" reviewerRole="RCM" />
    </NextIntlClientProvider>,
  );
}

describe("AppealsComposer — accessible names, toggle state, selected-row state", () => {
  // Matches this suite's established convention (see
  // ingest-panel-contrast-and-i18n.test.tsx): no RTL auto-cleanup registered,
  // so each test tears down explicitly.
  afterEach(cleanup);

  it("gives the letter-body textarea an accessible name naming it as the draft letter", async () => {
    renderComposer();

    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));

    const letterBox = await screen.findByRole("textbox", {
      name: enMessages.appeals.draft,
    });
    expect(letterBox).toHaveValue(draft.draft.body_en);
  });

  it("links each AI-suggestion paragraph textarea to its adjacent DRAFT badge via aria-labelledby", async () => {
    renderComposer();

    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));
    await screen.findByRole("textbox", { name: enMessages.appeals.draft });

    fireEvent.click(screen.getByRole("button", { name: enMessages.appeals.aiSuggest }));

    const expectedNames = suggestion.paragraphs_en.map((_, idx) =>
      enMessages.appeals.aiDraftLabelNumbered.replace("{n}", String(idx + 1)),
    );

    for (const name of expectedNames) {
      const box = await screen.findByRole("textbox", { name });
      const labelledBy = box.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy!)).toHaveTextContent(name);
    }

    const paragraphBoxes = expectedNames.map((name) =>
      screen.getByRole("textbox", { name }),
    );
    paragraphBoxes.forEach((box, idx) => {
      expect(box).toHaveValue(suggestion.paragraphs_en[idx]);
    });
  });

  it("gives each AI-suggestion paragraph textarea a distinct accessible name when 2+ paragraphs are returned", async () => {
    renderComposer();

    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));
    await screen.findByRole("textbox", { name: enMessages.appeals.draft });

    fireEvent.click(screen.getByRole("button", { name: enMessages.appeals.aiSuggest }));
    await screen.findByRole("region", { name: enMessages.appeals.aiSuggestions });

    const accessibleNames = screen
      .getAllByRole("textbox")
      .map((box) => box.getAttribute("aria-labelledby"))
      .filter((id): id is string => Boolean(id))
      .map((id) => document.getElementById(id)?.textContent);

    // Every AI-suggestion textarea's name must be unique — no two paragraphs
    // may share an identical accessible name (the CONFIRMED finding: a
    // static, non-indexed "AI draft" label on every paragraph).
    expect(accessibleNames.length).toBeGreaterThan(1);
    expect(new Set(accessibleNames).size).toBe(accessibleNames.length);
  });

  it("gives each AI-suggestion paragraph's Insert button a distinct, numbered accessible name", async () => {
    renderComposer();

    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));
    await screen.findByRole("textbox", { name: enMessages.appeals.draft });

    fireEvent.click(screen.getByRole("button", { name: enMessages.appeals.aiSuggest }));
    await screen.findByRole("region", { name: enMessages.appeals.aiSuggestions });

    const expectedNames = suggestion.paragraphs_en.map((_, idx) =>
      enMessages.appeals.insertNumbered.replace("{n}", String(idx + 1)),
    );

    // Every Insert button must be independently addressable by accessible
    // name — the CONFIRMED finding: every "Insert" button shared the exact
    // same accessible name, indistinguishable when tabbing/browsing by
    // button (NVDA/JAWS "b" key, VoiceOver rotor).
    for (const name of expectedNames) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }

    const insertButtons = screen.getAllByRole("button", { name: /^Insert/ });
    const accessibleNames = insertButtons.map((btn) => btn.getAttribute("aria-label"));
    expect(accessibleNames.length).toBeGreaterThan(1);
    expect(new Set(accessibleNames).size).toBe(accessibleNames.length);
  });

  it("marks the active language button with aria-pressed and the shared focus-ring utility", async () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));
    await screen.findByRole("textbox", { name: enMessages.appeals.draft });

    const englishBtn = screen.getByRole("button", { name: "English" });
    const arabicBtn = screen.getByRole("button", { name: "العربية" });

    expect(englishBtn).toHaveAttribute("aria-pressed", "true");
    expect(arabicBtn).toHaveAttribute("aria-pressed", "false");
    // docs/a11y.md #20 follow-up: this toggle used to hand-roll
    // `focus-visible:ring-2 focus-visible:ring-accent` instead of the shared
    // `.focus-ring` utility every other control in the shell uses.
    expect(englishBtn).toHaveClass("focus-ring");
    expect(englishBtn.className).not.toMatch(/focus-visible:ring-2/);
    expect(englishBtn.className).not.toMatch(/focus-visible:ring-accent/);

    fireEvent.click(arabicBtn);
    await waitFor(() => expect(arabicBtn).toHaveAttribute("aria-pressed", "true"));
    expect(englishBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("marks the currently-loaded denial row with aria-current, and only that row", async () => {
    renderComposer();

    const firstRow = screen.getByRole("button", { name: /MedGulf.*1,437/ });
    const secondRow = screen.getByRole("button", { name: /Bupa Arabia.*1,000/ });

    expect(firstRow).not.toHaveAttribute("aria-current");
    expect(secondRow).not.toHaveAttribute("aria-current");

    fireEvent.click(firstRow);
    await waitFor(() => expect(firstRow).toHaveAttribute("aria-current", "true"));
    expect(secondRow).not.toHaveAttribute("aria-current");

    fireEvent.click(secondRow);
    await waitFor(() => expect(secondRow).toHaveAttribute("aria-current", "true"));
    expect(firstRow).not.toHaveAttribute("aria-current");
  });

  it("announces draft loading, then the loaded draft's context, through an always-mounted status live region", async () => {
    // Control loadAppealDraft's resolution so the interim "loading" state is
    // deterministically observable instead of racing a same-tick resolution.
    let resolveDraft!: (value: typeof draft) => void;
    vi.mocked(loadAppealDraft).mockImplementationOnce(
      () => new Promise((resolve) => (resolveDraft = resolve)),
    );

    renderComposer();

    // The status node must exist BEFORE the click — assistive tech only
    // picks up a live region's content changes if the node was already in
    // the accessibility tree when the mutation happens.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(enMessages.appeals.loadingDraft),
    );

    resolveDraft(draft);

    // Once the draft resolves, the same node's text is replaced with a
    // loaded-context message naming the payer and amount — never left
    // silent, and never a second competing live region.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("MedGulf"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("1,437");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("tags the hardcoded-English denial reasonLabel with lang=\"en\" on the Arabic locale, in both the queue row and the context header", async () => {
    renderComposer("ar");

    const firstRow = screen.getByRole("button", { name: /MedGulf.*1,437/ });
    const reasonSpan = within(firstRow).getByText(queue[0]!.reasonLabel);
    expect(reasonSpan).toHaveAttribute("lang", "en");

    fireEvent.click(firstRow);
    const contextReasonSpan = await screen.findByText(draft.reasonLabel);
    expect(contextReasonSpan).toHaveAttribute("lang", "en");
    expect(contextReasonSpan.tagName).toBe("SPAN");
  });
});

describe("AppealsComposer — queue roving tabindex and confirm-checkbox focus ring", () => {
  afterEach(cleanup);

  it("keeps only one queue row as a Tab stop and moves it with ArrowDown/ArrowUp/Home/End", async () => {
    renderComposer();

    const firstRow = screen.getByRole("button", { name: /MedGulf.*1,437/ });
    const secondRow = screen.getByRole("button", { name: /Bupa Arabia.*1,000/ });

    // Initial state: only the first row is reachable via Tab.
    expect(firstRow).toHaveAttribute("tabIndex", "0");
    expect(secondRow).toHaveAttribute("tabIndex", "-1");

    // ArrowDown rolls the single Tab stop onto the next row and moves focus
    // there directly (no extra Tab press needed).
    fireEvent.keyDown(firstRow, { key: "ArrowDown" });
    expect(secondRow).toHaveAttribute("tabIndex", "0");
    expect(firstRow).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement).toBe(secondRow);

    // ArrowUp rolls it back.
    fireEvent.keyDown(secondRow, { key: "ArrowUp" });
    expect(firstRow).toHaveAttribute("tabIndex", "0");
    expect(secondRow).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement).toBe(firstRow);

    // End jumps straight to the last row, still without touching Tab.
    fireEvent.keyDown(firstRow, { key: "End" });
    expect(secondRow).toHaveAttribute("tabIndex", "0");
    expect(document.activeElement).toBe(secondRow);

    // Home jumps back to the first row.
    fireEvent.keyDown(secondRow, { key: "Home" });
    expect(firstRow).toHaveAttribute("tabIndex", "0");
    expect(document.activeElement).toBe(firstRow);
  });

  it("gives the confirm-review checkbox the same accent focus-visible ring utility as its neighboring controls", async () => {
    renderComposer();

    fireEvent.click(screen.getByRole("button", { name: /MedGulf.*1,437/ }));
    await screen.findByRole("textbox", { name: enMessages.appeals.draft });

    const checkbox = screen.getByRole("checkbox", {
      name: enMessages.appeals.confirmReview,
    });
    expect(checkbox.className).toMatch(/focus-visible:ring-2/);
    expect(checkbox.className).toMatch(/focus-visible:ring-accent/);
    expect(checkbox.className).toMatch(/focus-visible:outline-none/);
  });
});
