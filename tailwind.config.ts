import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#97C972",
          light: "#D3FDD7",
          dark: "#434343",
          ink: "#000000",
          surface: "#F6FAF2"
        }
      },
      fontFamily: {
        sans: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 8px 24px rgba(67, 67, 67, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
