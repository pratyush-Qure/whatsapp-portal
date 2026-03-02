import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ds: {
          bg: {
            default: "var(--bg-base-default)",
            secondary: "var(--bg-base-secondary)",
            tertiary: "var(--bg-base-tertiary)",
            brand: "var(--bg-brand-default)",
            "brand-tertiary": "var(--bg-brand-tertiary)",
            success: "var(--bg-success-default)",
            warning: "var(--bg-warning-default)",
            danger: "var(--bg-danger-default)",
          },
          text: {
            default: "var(--text-base-default)",
            secondary: "var(--text-base-secondary)",
            disabled: "var(--text-disabled-default)",
            brand: "var(--text-brand-default)",
            "on-brand": "var(--text-brand-on-brand)",
            success: "var(--text-success-default)",
            warning: "var(--text-warning-default)",
            danger: "var(--text-danger-default)",
          },
          border: {
            default: "var(--border-base-default)",
            secondary: "var(--border-base-secondary)",
            brand: "var(--border-brand-default)",
            danger: "var(--border-danger-default)",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },
    },
  },
};

export default config;
