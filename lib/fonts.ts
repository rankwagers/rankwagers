import { Inter, Instrument_Sans, JetBrains_Mono, Playfair_Display } from "next/font/google";

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

/** Design Bible — editorial headings */
export const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const plusJakarta = inter;

/*
 * Homepage hero typefaces (Sprint 1).
 *
 * These belong to the approved hero composition only and are deliberately NOT bound to
 * `--font-sans` / `--font-display`. The variables are consumed inside the `.rw-hero` scope, so the
 * rest of the site keeps Inter + Playfair until a later sprint converts it. Loading them at the
 * document root is what lets `next/font` inline the @font-face and preload — scoping the *usage*
 * costs nothing, scoping the *declaration* would cost a render-blocking late fetch.
 */
export const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-hero-sans",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hero-mono",
});
