import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Engram — neural-violet theme. Token names kept from the base app so the
        // whole UI re-themes from these values; cream=cool text, gold=violet
        // primary, ember=cyan accent.
        ink: "#0B0E1A",
        surface: "#14172B",
        cream: "#E8E9F2",
        ember: "#38E8D0",
        gold: "#7C5CFF",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
