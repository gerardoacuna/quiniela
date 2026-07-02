import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getActiveEdition } from "@/lib/queries/stages";
import { themeForSlug } from "@/lib/theme/theme-for-slug";
import { editionLabel } from "@/lib/theme/edition-label";
import { EditionThemeProvider } from "@/lib/theme/edition-theme-context";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400", "500", "600", "700"] });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-body", display: "swap", weight: ["400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "600", "700"] });

async function resolveEdition() {
  try { return await getActiveEdition(); } catch { return null; }
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = themeForSlug((await resolveEdition())?.slug);
  return {
    title: theme === "tour" ? "Quiniela TDF" : "Quiniela Giro",
    description: "Grand tour pickem",
    manifest: "/manifest.webmanifest",
    icons: { apple: "/apple-touch-icon.png" },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Quiniela" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = themeForSlug((await resolveEdition())?.slug);
  return {
    themeColor: theme === "tour" ? "#fbfbfb" : "#0b0d10",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const edition = await resolveEdition();
  const theme = themeForSlug(edition?.slug);
  const label = editionLabel(edition);
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${spaceGrotesk.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased bg-background text-foreground">
        <EditionThemeProvider label={label}>{children}</EditionThemeProvider>
      </body>
    </html>
  );
}
