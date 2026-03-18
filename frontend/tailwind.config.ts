import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E8561B",
          hover: "#D44A12",
          light: "rgba(232,86,27,0.12)",
          glow: "rgba(232,86,27,0.25)",
        },
        cream: "#F8F4EF",
        "cream-dark": "#F0EAE1",
        surface: "#FFFFFF",
        ink: "#0D0D0D",
        muted: "#6B6B6B",
        border: "#E4DDD4",
        dark: "#111111",
      },
      fontFamily: {
        display: ["var(--font-instrument)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        fadeUp: "fadeUp 0.7s ease forwards",
        floatY: "floatY 3s ease-in-out infinite",
        glowPulse: "glowPulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
