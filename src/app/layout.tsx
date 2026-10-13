import type { Metadata } from "next";
import AppNavigation from "@/app/components/app-navigation";
import { getViewerSummary } from "@/server/ui/viewer-summary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanu Connect",
  description: "La communauté des développeurs africains : apprendre, partager et construire ensemble.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewerSummary();
  return (
    <html lang="fr">
      <body><div className="app-shell">
        <AppNavigation authenticated={!!viewer} handle={viewer?.handle ?? null}
          initialUnreadCount={viewer?.unreadCount ?? 0} role={viewer?.role ?? null} />
        <div id="main-content" className="app-content" tabIndex={-1}>{children}</div>
      </div></body>
    </html>
  );
}
