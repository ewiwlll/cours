/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        surface: {
          DEFAULT: "#111115",
          elevated: "#16161c",
          muted: "#1c1c24",
        },
        border: {
          DEFAULT: "#23232c",
          subtle: "#181820",
          focus: "#3e3e4f",
        },
        accent: {
          blue: "#3b82f6",
          green: "#22c55e",
          orange: "#f59e0b",
          red: "#ef4444",
          purple: "#a855f7",
        }
      },
    },
  },
  plugins: [],
}
