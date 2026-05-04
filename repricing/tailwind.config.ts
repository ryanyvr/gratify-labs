import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#E8573A",
        "primary-hover": "#D14A30",
        "chart-blue": "#4A8FE7",
        "chart-green": "#22C55E",
        "chart-amber": "#F59E0B",
        "chart-red": "#EF4444",
        "bg-page": "#F5F5F7",
        "bg-card": "#FFFFFF",
        "border-card": "#E5E7EB",
        "text-primary": "#1A1A2E",
        "text-secondary": "#6B7280",
        "text-tertiary": "#9CA3AF",
      },
    },
  },
  plugins: [],
};

export default config;
