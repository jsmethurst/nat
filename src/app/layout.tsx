import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Nat's Inbox",
  description: "One calm place for mail and calendar, with a daily summary of what matters.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Inbox", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#faf8f5", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
