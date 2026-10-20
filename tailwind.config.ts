import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3f0e8",
        card: "#fffdf8",
        ink: "#14201b",
        muted: "#6d675e",
        line: "#e4dccf",
        moss: "#1c7a52",
        mossDark: "#145c3e",
        ember: "#c2410c",
        rail: "#13201b",
        gold: "#a68446",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
