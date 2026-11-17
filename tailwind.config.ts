import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        ink: "var(--ink)",
        mut: "var(--mut)",
        line: "var(--line)",
        teal: "var(--teal)",
        "teal-s": "var(--teal-s)",
        terra: "var(--terra)",
        "terra-s": "var(--terra-s)",
        amber: "var(--amber)",
        "amber-s": "var(--amber-s)",
        cu: "var(--cu)",
        "cu-s": "var(--cu-s)",
        wine: "var(--wine)",
        "wine-s": "var(--wine-s)",
        navy: "var(--navy)",
        "navy-s": "var(--navy-s)",
        del: "var(--del)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        num: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      maxWidth: { app: "460px" },
      boxShadow: { card: "var(--shadow)" },
      borderRadius: { xl2: "18px" },
    },
  },
  plugins: [],
};

export default config;
