import type { ReactNode } from "react";

export const metadata = {
  title: "Taweed",
  description: "KSA denial-management SaaS (placeholder shell — no UI yet).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
