import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          "var(--font-display)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["var(--font-mono)"],
      },
      colors: {
        /* RGB channels enable opacity modifiers (brand/40) while values live in globals.css */
        background: "rgb(var(--canvas-primary-rgb) / <alpha-value>)",
        foreground: "rgb(var(--ink-primary-rgb) / <alpha-value>)",
        border: "rgb(var(--border-default-rgb) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--canvas-secondary-rgb) / <alpha-value>)",
          foreground: "var(--muted-foreground)",
        },
        brand: {
          DEFAULT: "rgb(var(--green-primary-rgb) / <alpha-value>)",
          dark: "rgb(var(--green-deep-rgb) / <alpha-value>)",
          light: "rgb(var(--green-positive-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--green-surface-rgb) / <alpha-value>)",
          dark: "rgb(var(--green-primary-rgb) / <alpha-value>)",
        },
        gold: "rgb(var(--amber-primary-rgb) / <alpha-value>)",
        /* Surfaces. `ink` aliases retired (spec §1.4): they mapped to CANVAS values, so
           `bg-ink` painted cream. Ink is the mark, not the paper. */
        card: "rgb(var(--canvas-secondary-rgb) / <alpha-value>)",
        success: "rgb(var(--green-primary-rgb) / <alpha-value>)",
        destructive: "rgb(var(--red-primary-rgb) / <alpha-value>)",
      },
      /* The seven-step scale (spec §2.2). Tokens already existed in globals.css
         and were unused; these are the utilities that make them the only legal scale.
         11px (`metadata`) is the floor — nothing smaller ships. */
      fontSize: {
        h1: ["var(--text-h1)", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        h2: ["var(--text-h2)", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["var(--text-h3)", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["var(--text-body)", { lineHeight: "1.5" }],
        "body-sm": ["var(--text-body-sm)", { lineHeight: "1.5" }],
        caption: ["var(--text-caption)", { lineHeight: "1.4" }],
        metadata: ["var(--text-metadata)", { lineHeight: "1.3", fontWeight: "500" }],
      },
      /* Two values only (spec §2.4): 0.14em uppercase micro-labels, -0.01em display. */
      letterSpacing: {
        label: "0.14em",
        display: "-0.01em",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      spacing: {
        touch: "var(--touch-min)",
      },
      boxShadow: {
        glow: "var(--shadow-focus)",
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },
      backgroundImage: {
        mesh:
          "radial-gradient(60% 50% at 50% 0%, rgba(14,107,79,0.08) 0%, rgba(246,243,236,0) 60%), radial-gradient(40% 40% at 100% 0%, rgba(169,110,18,0.06) 0%, rgba(246,243,236,0) 55%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shine: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shine: "shine 3s linear infinite",
      },
      transitionDuration: {
        fast: "150ms",
        base: "220ms",
      },
    },
  },
  plugins: [],
};

export default config;
