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
        brand: {
          navy: "#0F172A", // Slate 900
          blue: "#2563EB", // Blue 600
          "blue-hover": "#1D4ED8", // Blue 700
          "blue-light": "#EFF6FF", // Blue 50
        },
        operativo: {
          enruta: "#2563EB", // Blue 600
          detenido: "#D97706", // Amber 600
          validada: "#059669", // Emerald 600
          desviacion: "#DC2626", // Red 600
          desconectado: "#64748B", // Slate 500
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
