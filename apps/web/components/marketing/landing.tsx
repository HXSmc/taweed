import { getTranslations } from "next-intl/server";
import { ShieldCheck, Lock, UserCheck, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleToggle } from "@/components/shell/locale-toggle";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { MoneyFigure } from "@/components/money/money-figure";

// EXECUTE A4 — marketing landing (design-brief §12, AIDA). The number is the hero:
// the illustrative at-risk figure counts up once on scroll into view (MoneyFigure /
// CountUp honor reduced-motion). Same design system as the app: one cobalt accent,
// amber/rust = at-risk, hairlines over cards, Western digits, wordmark Latin on AR
// (§11), zero em-dashes. Both locales via the `landing` messages; RTL mirrors from
// the <html dir> flip in the locale layout.

// Illustrative annual leak shown pre-login. Labeled illustrative (§13): the real
// number comes from the free audit on the prospect's own data.
const ILLUSTRATIVE_ANNUAL_AT_RISK = 1_840_000;

export async function Landing() {
  const t = await getTranslations("landing");

  const beats = [
    { n: "01", title: t("beat1Title"), body: t("beat1Body") },
    { n: "02", title: t("beat2Title"), body: t("beat2Body") },
    { n: "03", title: t("beat3Title"), body: t("beat3Body") },
  ];
  const trust = [
    { Icon: ShieldCheck, text: t("trustResidency") },
    { Icon: Lock, text: t("trustEncryption") },
    { Icon: UserCheck, text: t("trustHuman") },
  ];

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-bg px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-accent font-display text-h3 text-accent-fg">
            T
          </span>
          {/* Wordmark stays Latin on every surface until SME sign-off (§11, BLK-9). */}
          <span className="font-display text-h2 font-medium">Taweed</span>
        </div>
        <div className="flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
          <Link
            href="/login"
            className="ms-1 rounded-md px-3 py-1.5 text-label font-medium text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("signIn")}
          </Link>
        </div>
      </header>

      {/* Attention — the number is the hero. */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
        {/* Contrast fix (WCAG AA finding): `--accent` is locked to the same
         * hex in both themes (design-brief §4.2), which clears AA on the
         * light `--bg` (~5.7:1, per §4.2's own recomputation) but drops to
         * ~3.35:1 on the dark `--bg` — below the 4.5:1 minimum for this
         * 12.5px label. Dark theme falls back to the existing `--text-muted`
         * token (~7.7:1 on dark `--bg`), already used for supporting copy on
         * this page, instead of touching the locked accent token globally. */}
        <p className="text-label font-medium uppercase tracking-wide text-accent dark:text-muted">
          {t("eyebrow")}
        </p>
        <h1 className="mt-6 space-y-3">
          <span className="block text-display font-display font-medium leading-tight">
            {t("heroLead")}
          </span>
          <MoneyFigure value={ILLUSTRATIVE_ANNUAL_AT_RISK} tone="atRisk" size="hero" />
          <span className="block text-display font-display font-medium leading-tight">
            {t("heroTrail")}
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-h3 text-muted">{t("heroSub")}</p>
        {/* Contrast fix (WCAG AA finding): text-faint is 3.3:1 (light) / 3.92:1
         * (dark), below the 4.5:1 normal-text minimum. text-muted is the next
         * token up the scale (6.5:1 / 7.7:1) and keeps this a secondary caption
         * relative to heroSub above it. */}
        <p className="mt-3 text-label text-muted">{t("illustrative")}</p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-body font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <p className="mt-2 text-label text-muted">{t("ctaNote")}</p>
        </div>
      </section>

      {/* Interest — three proof beats, editorial (hairlines, not equal cards). */}
      <section className="border-t border-hairline bg-surface-1">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-h1 font-display font-medium">{t("interestTitle")}</h2>
          <ul className="mt-8 divide-y divide-hairline border-y border-hairline">
            {beats.map((b) => (
              <li
                key={b.n}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 py-6"
              >
                <span className="num font-display text-display font-medium text-muted">
                  {b.n}
                </span>
                <div>
                  <h3 className="text-h2 font-medium">{b.title}</h3>
                  <p className="mt-1 max-w-2xl text-body text-muted">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Desire — recovery-share as the trust hook + trust objects. */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-h1 font-display font-medium text-recovered">
            {t("desireTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-h3 text-muted">{t("desireBody")}</p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {trust.map(({ Icon, text }) => (
              <li
                key={text}
                className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 py-2 text-label text-muted"
              >
                <Icon className="size-4 text-money-neutral" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Action — the free-audit offer. */}
      <section className="border-t border-hairline bg-surface-2">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-h1 font-display font-medium">{t("actionTitle")}</h2>
            <p className="mt-2 max-w-xl text-body text-muted">{t("actionBody")}</p>
          </div>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-5 py-3 text-body font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline px-6 py-8">
        <p className="mx-auto max-w-5xl text-label text-muted">{t("footer")}</p>
      </footer>
    </main>
  );
}
