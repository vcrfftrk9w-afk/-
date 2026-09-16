/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0a0a0d",
          1: "#121218",
          2: "#191922",
          3: "#22222d",
        },
        ink: {
          primary: "#ffffff",
          secondary: "#c3c2cf",
          muted: "#8b8a99",
        },
        cyan: {
          glow: "#25F4EE",
        },
        pink: {
          glow: "#FE2C55",
        },
        good: "#0ca30c",
        warning: "#fab219",
        serious: "#ec835a",
        critical: "#e66767",
      },
      fontFamily: {
        sans: [
          "'Inter'",
          "system-ui",
          "-apple-system",
          "'Segoe UI'",
          "sans-serif",
        ],
      },
      backgroundImage: {
        "tiktok-gradient":
          "linear-gradient(135deg, #FE2C55 0%, #7c3aed 45%, #25F4EE 100%)",
        "glass-card":
          "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(37,244,238,0.35)",
        "glow-pink": "0 0 40px -10px rgba(254,44,85,0.35)",
        card: "0 8px 30px rgba(0,0,0,0.35)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: 0.5 },
          "50%": { opacity: 1 },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
