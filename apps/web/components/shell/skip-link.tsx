// Bypass-blocks mechanism (WCAG 2.4.1) for the authenticated app shell.
// A sighted keyboard-only user (no screen reader, so no landmark-jump
// shortcut) otherwise has to Tab through every primary-nav module link plus
// the command bar (search, locale toggle, theme toggle, role chip, account
// menu — ~12 stops) before reaching page content, on every route change.
// This link is visually hidden until it receives focus (first Tab stop in
// the shell), then jumps straight to <main id="main-content">.
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main-content"
      className="focus-ring sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-1 focus:px-4 focus:py-2 focus:text-body focus:font-medium focus:text-text focus:shadow-lg"
    >
      {label}
    </a>
  );
}
