import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import {
  SITE_NAME,
  SITE_LOGO_PATH,
  SITE_TAGLINE,
  SITE_THEME,
} from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  icons: {
    icon: SITE_LOGO_PATH,
  },
};

const themeVariables = {
  "--site-background": SITE_THEME.background,
  "--site-foreground": SITE_THEME.foreground,
  "--site-accent": SITE_THEME.accent,
  "--site-accent-foreground": SITE_THEME.accentForeground,
  "--site-muted": SITE_THEME.muted,
  "--site-border": SITE_THEME.border,
  "--site-artwork-background": SITE_THEME.artworkBackground,
  "--site-artwork-sage": SITE_THEME.artworkSage,
  "--site-artwork-clay": SITE_THEME.artworkClay,
  "--site-artwork-sand": SITE_THEME.artworkSand,
  "--site-collection-sage": SITE_THEME.collectionSage,
  "--site-collection-sand": SITE_THEME.collectionSand,
  "--site-collection-clay": SITE_THEME.collectionClay,
} as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" style={themeVariables}>
      <body>{children}</body>
    </html>
  );
}
