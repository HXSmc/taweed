// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Regression coverage for bugs.md pass #22: a plain server-action <form> left
// the Recovery totals stale after mark-won/lost until a manual reload —
// confirmed against a real `next build` + `next start` run that the mutation
// + revalidatePath are correct server-side (curl shows fresh data every
// time) but the client never applies the refreshed RSC payload for this
// route, even via router.refresh(). A full reload sidesteps that broken
// soft-update path.

const mockedMarkAppealOutcome = vi.fn();
vi.mock("@/lib/actions/recovery", () => ({
  markAppealOutcome: (...args: unknown[]) => mockedMarkAppealOutcome(...args),
}));

const mockedReload = vi.fn();
Object.defineProperty(window, "location", {
  value: { ...window.location, reload: mockedReload },
  writable: true,
});

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ComponentProps<"button">) => <button {...props} />,
}));

import { RecoveryOutcomeActions } from "@/components/modules/recovery-outcome-actions";

function renderActions() {
  return render(
    <RecoveryOutcomeActions
      appealId="a1"
      markWon="Mark won"
      markLost="Mark lost"
      markWonLabel="Mark won, Bupa, SAR 987"
      markLostLabel="Mark lost, Bupa, SAR 987"
      actionFailedLabel="That action did not complete. Refresh and try again."
    />,
  );
}

describe("RecoveryOutcomeActions", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls markAppealOutcome with the appeal id and outcome, then refreshes on success", async () => {
    mockedMarkAppealOutcome.mockResolvedValue({ ok: true, recoveredSar: "987.00" });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Mark won, Bupa, SAR 987" }));

    await waitFor(() => expect(mockedReload).toHaveBeenCalled());
    expect(mockedMarkAppealOutcome).toHaveBeenCalledWith("a1", "won");
  });

  it("shows an inline error and does NOT refresh when the action returns {ok:false}", async () => {
    mockedMarkAppealOutcome.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Mark lost, Bupa, SAR 987" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That action did not complete. Refresh and try again.");
    expect(mockedReload).not.toHaveBeenCalled();
  });

  it("shows an inline error and clears isPending when markAppealOutcome rejects (RPC-level failure)", async () => {
    // bugs.md pass #24 finding #25: an RPC-level rejection (network drop,
    // serialization failure, thrown error) must surface the same inline
    // failure region as the handled {ok:false} path, never an unhandled
    // rejection. Sibling pattern: eob-review-queue.tsx try/catch.
    mockedMarkAppealOutcome.mockRejectedValueOnce(new Error("network drop"));
    const user = userEvent.setup();
    renderActions();

    const button = screen.getByRole("button", { name: "Mark won, Bupa, SAR 987" });
    await user.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That action did not complete. Refresh and try again.");
    expect(mockedReload).not.toHaveBeenCalled();
    // isPending cleared → button re-enabled.
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("does not show the error message before any click", () => {
    renderActions();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
