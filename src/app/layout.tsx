import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kanu Connect",
  description: "Communauté Kanu Connect",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
