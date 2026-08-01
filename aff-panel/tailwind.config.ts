import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#f59e0b", dark: "#d97706", light: "#fbbf24" },
        ink: { DEFAULT: "#0a0e17", card: "#161d2e" },
        success: "#34d399",
        danger: "#f87171",
      },
    },
  },
  plugins: [],
};

export default config;
