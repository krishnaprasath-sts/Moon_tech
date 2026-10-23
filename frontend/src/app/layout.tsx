import type { Metadata } from "next";
import { preconnect } from "react-dom";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
  // The font is still self-hosted and loads via @font-face; skipping the <link rel="preload">
  // avoids Chrome's spurious "preloaded but not used" warning on cached loads.
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  // Only used for small labels (references, codes); don't preload it on every page.
  preload: false,
});

export const metadata: Metadata = {
  title: "MoonTech Solutions | Stock Market & Trading Training",
  description: "Stock market and trading training for beginners and working professionals: foundations, technical analysis, derivatives and live mentorship.",
};

/** Origin of the API, so the browser can connect to it before the first request */
function apiOrigin(): string | null {
  try {
    const raw = process.env.NEXT_PUBLIC_API_URL;
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const api = apiOrigin();
  if (api) preconnect(api, { crossOrigin: "anonymous" });
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased light`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
