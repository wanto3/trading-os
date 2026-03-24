import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d0d0f",
        surface: "#18181b",
        "surface-hover": "#27272a",
        border: "#27272a",
        muted: "#3f3f46",
        "text-primary": "#fafafa",
        "text-secondary": "#a1a1aa",
        "text-muted": "#71717a",
        bullish: "#22c55e",
        "bullish-bg": "#052e16",
        bearish: "#ef4444",
        "bearish-bg": "#2e0520",
        warning: "#f59e0b",
        "warning-bg": "#2e1a05",
        info: "#3b82f6",
        "info-bg": "#0c1a3d",
        "pm-purple": "#8b5cf6",
        "pm-purple-bg": "#1e0d3d",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Menlo", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
