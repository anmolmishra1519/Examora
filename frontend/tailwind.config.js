/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F6F1",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#1B2130",
          muted: "#5B6172",
          faint: "#8A90A0",
        },
        navy: {
          50: "#EEF0F8",
          100: "#D9DEEF",
          200: "#B4BCDD",
          300: "#8B98C9",
          400: "#5C6BA8",
          500: "#374688",
          600: "#26326B",
          700: "#1D2755",
          800: "#161D40",
          900: "#10152F",
        },
        line: "#E5E4DE",
        success: { DEFAULT: "#1E8A5F", bg: "#E7F5EE" },
        warning: { DEFAULT: "#A8710A", bg: "#FBF1DD" },
        danger: { DEFAULT: "#B23A2E", bg: "#FBEAE7" },
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        card: "14px",
        control: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 24, 40, 0.04), 0 8px 24px -12px rgba(20, 24, 40, 0.10)",
        pop: "0 4px 14px -4px rgba(20, 24, 40, 0.18)",
      },
    },
  },
  plugins: [],
};
