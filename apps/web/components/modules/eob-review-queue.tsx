"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Inbox, Loader2, TriangleAlert } from "lucide-react";
import type { EobReviewRow } from "@/lib/eob-review-data";
import {
  approveEobExtractionAction,
  rejectEobExtractionAction,
  type EditedEobExtractionInput,
} from "@/lib/actions/eob-review";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfidenceBadge } from "./eob-review/confidence-badge";
import { EobExtractionForm } from "./eob-review/eob-extraction-form";

// AI-4 review-queue surface (plan 04 §9). A human reviews (and may correct)
// every pending EOB/remittance extraction before anything is written to
// claims/denials — additive + fail-safe: an empty queue and a parse failure both
// degrade gracefully (discriminated state union, mirrors flag-explainer.tsx),
// never a crash or a broken page image.

type ActionState =
  | { status: "idle" }
  | { status: "pending"; rowId: string; kind: "approve" | "reject" }
  | { status: "error"; rowId: string; key: string };

const ERROR_KEY: Record<string, string> = {
  forbidden: "reviewForbidden",
  invalid: "reviewInvalid",
  not_pending: "reviewNotPending",
  not_seeded: "reviewNotSeeded",
  failed: "reviewFailed",
  inconsistent: "reviewInconsistent",
};

export function EobReviewQueue({ rows }: { rows: EobReviewRow[] }) {
  const t = useTranslations("reviewQueue");
  const router = useRouter();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<ActionState>({ status: "idle" });

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const approve = (rowId: string, edited: EditedEobExtractionInput) => {
    setAction({ status: "pending", rowId, kind: "approve" });
    void (async () => {
      try {
        const res = await approveEobExtractionAction(rowId, edited);
        if (res.ok) {
          setAction({ status: "idle" });
          // Only close the review form if the reviewer is still on this row —
          // a background approve/reject for a row they've since navigated away
          // from must not discard whatever they're now reviewing.
          setSelectedId((prev) => (prev === rowId ? null : prev));
          router.refresh();
        } else {
          setAction({ status: "error", rowId, key: ERROR_KEY[res.error ?? "failed"] ?? "reviewFailed" });
        }
      } catch {
        // The server-action RPC layer itself rejected (network drop,
        // serialization failure) rather than resolving with {ok:false} — same
        // user-facing degrade as any other failure, never an unhandled
        // rejection.
        setAction({ status: "error", rowId, key: "reviewFailed" });
      }
    })();
  };

  const reject = (rowId: string) => {
    setAction({ status: "pending", rowId, kind: "reject" });
    void (async () => {
      try {
        const res = await rejectEobExtractionAction(rowId);
        if (res.ok) {
          setAction({ status: "idle" });
          // Only close the review form if the reviewer is still on this row —
          // a background approve/reject for a row they've since navigated away
          // from must not discard whatever they're now reviewing.
          setSelectedId((prev) => (prev === rowId ? null : prev));
          router.refresh();
        } else {
          setAction({ status: "error", rowId, key: ERROR_KEY[res.error ?? "invalid"] ?? "reviewInvalid" });
        }
      } catch {
        setAction({ status: "error", rowId, key: "reviewInvalid" });
      }
    })();
  };

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <Inbox className="size-6 text-muted" aria-hidden="true" />
        <p className="text-body font-medium">{t("emptyTitle")}</p>
        <p className="max-w-sm text-label text-muted">{t("emptyBody")}</p>
      </Card>
    );
  }

  const isPending = (rowId: string) =>
    action.status === "pending" && action.rowId === rowId;

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden">
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>{t("fileColumn")}</TH>
                <TH>{t("modelColumn")}</TH>
                <TH>{t("confidenceColumn")}</TH>
                <TH>{t("receivedColumn")}</TH>
                <TH className="text-end">{t("actionColumn")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id} className={row.id === selectedId ? "bg-surface-2" : undefined}>
                  <TD className="max-w-[16rem] truncate">{row.sourceFilename}</TD>
                  <TD className="mono text-label text-muted">{row.model}</TD>
                  <TD>
                    {row.extraction ? (
                      <ConfidenceBadge value={row.extraction.overallConfidence} />
                    ) : (
                      <Badge variant="neutral">
                        <TriangleAlert className="size-3" aria-hidden="true" />
                        {t("unreadable")}
                      </Badge>
                    )}
                    {row.escalated && (
                      <Badge variant="outline" className="ms-1">
                        {t("escalated")}
                      </Badge>
                    )}
                  </TD>
                  <TD className="num text-label text-muted">
                    {new Date(row.createdAt).toISOString().slice(0, 19).replace("T", " ")}
                  </TD>
                  <TD className="text-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!row.extraction}
                      onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                    >
                      {t("review")}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      {/* Persisted, always-mounted live regions so assistive tech registers them
          before content changes (mirrors rule-authoring.tsx). */}
      <div role="status" aria-live="polite">
        {action.status === "pending" && (
          <p className="flex items-center gap-2 text-label text-muted">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {action.kind === "approve" ? t("approving") : t("rejecting")}
          </p>
        )}
      </div>
      <div role="alert" aria-live="assertive">
        {action.status === "error" && (
          <div className="rounded-lg border border-hairline bg-surface-2 p-3">
            <p className="text-label text-muted">{t(action.key)}</p>
          </div>
        )}
      </div>

      {selected?.extraction && (
        <EobExtractionForm
          key={selected.id}
          extraction={selected.extraction}
          sourceFilename={selected.sourceFilename}
          escalated={selected.escalated}
          validatorReport={selected.validatorReport}
          pending={isPending(selected.id)}
          onApprove={(edited) => approve(selected.id, edited)}
          onReject={() => reject(selected.id)}
        />
      )}
    </div>
  );
}
