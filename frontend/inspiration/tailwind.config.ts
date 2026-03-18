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
        floatY2: "floatY 3.5s ease-in-out infinite 0.5s",
        floatY3: "floatY 4s ease-in-out infinite 1s",
        floatY4: "floatY 3.2s ease-in-out infinite 1.5s",
        glowPulse: "glowPulse 2s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        orbitSpin: "orbitSpin 20s linear infinite",
        "spin-slow": "spin 8s linear infinite",
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
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        orbitSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(232,86,27,0.06) 0%, transparent 70%)",
        "cream-gradient":
          "linear-gradient(180deg, #F8F4EF 0%, #F0EAE1 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
