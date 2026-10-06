import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/lib/state/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "HX Resource Management · Prototype",
  description: "Mobile-first resource management for HarmonyX",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#345589" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
