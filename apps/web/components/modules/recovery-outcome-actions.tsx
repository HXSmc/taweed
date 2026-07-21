"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAppealOutcome } from "@/lib/actions/recovery";

interface RecoveryOutcomeActionsProps {
  appealId: string;
  markWon: string;
  markLost: string;
  markWonLabel: string;
  markLostLabel: string;
  actionFailedLabel: string;
}

// Client-invoked outcome buttons (bugs.md pass #22): a plain server-action
// `<form action={fn}>` here left the Recovery totals stale after a
// mark-won/lost until a manual reload. Root cause isolated in a real
// `next build` + `next start` run: the mutation + `revalidatePath` are
// correct server-side (confirmed via curl and a fresh navigation showing
// updated totals every time) but the client's RSC apply step never commits
// the refreshed payload for THIS route — `router.refresh()` issues a
// genuine 200, no-cache GET and React still leaves the old DOM in place.
// A full reload sidesteps the broken soft-update path entirely; it's the
// blunt but reliable fix until the underlying Next/React RSC-apply gap is
// resolved (candidate: the deferred React 19 upgrade).
export function RecoveryOutcomeActions({
  appealId,
  markWon,
  markLost,
  markWonLabel,
  markLostLabel,
  actionFailedLabel,
}: RecoveryOutcomeActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function markOutcome(outcome: "won" | "lost") {
    setFailed(false);
    setIsPending(true);
    try {
      const result = await markAppealOutcome(appealId, outcome);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      window.location.reload();
    } catch {
      // The server-action RPC layer itself rejected (network drop,
      // serialization failure) rather than resolving with {ok:false} — same
      // user-facing degrade as any other failure, never an unhandled
      // rejection. Matches the sibling pattern in eob-review-queue.tsx.
      setFailed(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1"
          aria-label={markWonLabel}
          disabled={isPending}
          onClick={() => markOutcome("won")}
        >
          <Check className="size-3.5 text-recovered" /> {markWon}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1"
          aria-label={markLostLabel}
          disabled={isPending}
          onClick={() => markOutcome("lost")}
        >
          <X className="size-3.5" /> {markLost}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-label text-at-risk-text">
          {actionFailedLabel}
        </p>
      )}
    </div>
  );
}
