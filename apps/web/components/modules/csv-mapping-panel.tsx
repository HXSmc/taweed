"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import type { CanonicalField, MappingSuggestion } from "@taweed/ingest";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ConfidenceBadge } from "@/components/modules/eob-review/confidence-badge";

// EXECUTE B6 — CSV/XLSX field-mapping panel (design-brief §8.1). Presentational:
// every detected source column is shown next to its suggested canonical field
// with a confidence indicator (ConfidenceBadge — icon + text tier + % title,
// never color alone) and an override Select per row. Nothing is committed
// until the operator presses Confirm — no auto-proceed on high confidence,
// since the review step is the point of this feature on a PHI-adjacent
// intake surface.
//
// Only `import type` reaches into @taweed/ingest here: the barrel also
// re-exports the PDF/XLSX adapter modules, and pulling a runtime value from
// it into this client component would drag that (node-only) code into the
// client bundle. `suggestions` already carries one entry per canonical field
// in CANONICAL_FIELDS order (detectFieldMapping's contract), so this renders
// straight off the prop instead of importing CANONICAL_FIELDS itself.

const NONE_VALUE = "__none__";

// A CSV may contain two identically-named columns. Keying the override
// Select's options on the raw header string — as both the React key AND the
// Radix Select value — collides on duplicates: Radix dedupes equal item
// values, so the second same-named column becomes unreachable in the
// dropdown (silently unmappable). Disambiguate internally with a stable
// per-column token derived from the column's array index, and translate
// to/from the real header name at the boundaries. The value handed to
// onConfirm stays the raw header name, so the downstream mapping logic
// (applyMappingOverrides / csvRowsToClaims, which resolve columns by name)
// is unaffected — including the common no-duplicates case.
const tokenForIndex = (index: number): string => `__col_${index}__`;
const indexFromToken = (token: string): number | null => {
  const match = /^__col_(\d+)__$/.exec(token);
  return match ? Number(match[1]) : null;
};
const tokenForHeader = (headers: string[], name: string | null | undefined): string => {
  if (!name) return NONE_VALUE;
  const index = headers.indexOf(name);
  return index === -1 ? NONE_VALUE : tokenForIndex(index);
};

export interface CsvMappingPanelProps {
  headers: string[];
  suggestions: MappingSuggestion[];
  rowCount: number;
  onConfirm: (overrides: Partial<Record<CanonicalField, string | null>>) => void;
  onCancel: () => void;
  pending?: boolean;
}

export function CsvMappingPanel({
  headers,
  suggestions,
  rowCount,
  onConfirm,
  onCancel,
  pending = false,
}: CsvMappingPanelProps) {
  const t = useTranslations("ingest.csvMapping");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // Move focus to this panel's own heading the moment it mounts (the
  // dropzone -> mapping-review transition swaps in an entirely new region
  // with no other page navigation, so a keyboard/screen-reader user gets no
  // other signal it appeared — see ingest-panel.tsx for the matching
  // preview -> committed/cancelled transitions). The caller remounts this
  // component (via a file-identity `key`) whenever a new file is previewed,
  // so this effect re-fires per file as intended.
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Local editable copy of the mapping, seeded from the auto-detected
  // suggestions. Changing a row's Select updates this state only — it never
  // fires onConfirm itself.
  const [selections, setSelections] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of suggestions) initial[s.field] = tokenForHeader(headers, s.sourceColumn);
    return initial;
  });

  const handleConfirm = () => {
    // Send the operator's full confirmed mapping for every field, including
    // fields explicitly cleared to "— none —" (sent as `null`, not omitted).
    // Omitting a field here would mean "keep the auto-detected suggestion"
    // (applyMappingOverrides's contract — see packages/ingest/src/mapping.ts),
    // which is exactly the silent-no-op bug this fixes: a reviewer clearing a
    // wrong auto-detected mapping must have that clear actually committed.
    // The stored selection is an internal column token; translate it back to
    // the real header name here so downstream name-keyed resolution is
    // preserved (see tokenForIndex / tokenForHeader above).
    const overrides: Partial<Record<CanonicalField, string | null>> = {};
    for (const s of suggestions) {
      const selected = selections[s.field];
      if (!selected || selected === NONE_VALUE) {
        overrides[s.field] = null;
        continue;
      }
      const index = indexFromToken(selected);
      overrides[s.field] = index !== null ? (headers[index] ?? null) : null;
    }
    onConfirm(overrides);
  };

  return (
    <Card className="p-5">
      <h2 ref={headingRef} tabIndex={-1} className="text-h3 font-medium focus:outline-none">
        {t("title")}
      </h2>
      <p className="mt-1 max-w-2xl text-body text-muted">{t("lead")}</p>
      <p role="status" aria-live="polite" className="mt-1 text-label text-muted">
        {t("rowsDetected", { n: rowCount })}
      </p>

      <TableWrap className="mt-4">
        <Table>
          <THead>
            <TR>
              <TH>{t("columnField")}</TH>
              <TH>{t("columnSource")}</TH>
              <TH>{t("columnConfidence")}</TH>
              <TH>{t("columnOverride")}</TH>
            </TR>
          </THead>
          <TBody>
            {suggestions.map((s) => {
              const fieldLabel = t(`fields.${s.field}`);
              const selected = selections[s.field] ?? NONE_VALUE;
              return (
                <TR key={s.field} data-testid={`mapping-row-${s.field}`}>
                  <TD
                    className="font-medium text-text"
                    data-testid={`field-label-${s.field}`}
                  >
                    {fieldLabel}
                  </TD>
                  <TD
                    className="mono text-label text-muted"
                    data-testid={`source-column-${s.field}`}
                  >
                    {s.sourceColumn ?? t("noMatch")}
                  </TD>
                  <TD>
                    <ConfidenceBadge value={s.confidence} />
                  </TD>
                  <TD>
                    <Select
                      value={selected}
                      onValueChange={(value) =>
                        setSelections((prev) => ({ ...prev, [s.field]: value }))
                      }
                    >
                      <SelectTrigger
                        className="w-44"
                        aria-label={t("overrideLabel", { field: fieldLabel })}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{t("noneOption")}</SelectItem>
                        {headers.map((h, index) => (
                          <SelectItem key={tokenForIndex(index)} value={tokenForIndex(index)}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableWrap>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={pending}>
          {t("confirm")}
        </Button>
      </div>
    </Card>
  );
}
