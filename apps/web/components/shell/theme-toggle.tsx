"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Toggles the `.dark` class on <html> and persists the choice. First paint is
// handled by the inline script in the locale layout (no flash).
export function ThemeToggle() {
  const t = useTranslations("common");
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("taweed-theme", next ? "dark" : "light");
    } catch {
      /* ignore storage errors */
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`${t("theme")}: ${dark ? t("dark") : t("light")}`}
    >
      {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
