import type { ReactNode } from "react";

// Section header with real inter-section breathing (design-brief §2 density 6).
export function PageHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-h1 font-medium text-text">{title}</h1>
        {lead && <p className="mt-1 max-w-2xl text-body text-muted">{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Provenance tag under a hero figure (design-brief §6, §13: no fake-perfect
// numbers unlabeled).
export function Provenance({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-label text-muted">
      <span className="inline-block size-1.5 rounded-full bg-money-neutral align-middle" />{" "}
      {children}
    </p>
  );
}
