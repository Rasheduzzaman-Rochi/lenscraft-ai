import type { Config } from "tailwindcss";

const config: Config = {
  content: {
    relative: true,
    files: [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
      "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    ],
  },
  theme: {
    extend: {
      colors: {
        ink: "#171612",
        bone: "#F3EFE7",
        paper: "#FAF8F3",
        clay: "#B9A995",
        bronze: "#9A754E",
        moss: "#566052",
        charcoal: "#25241F"
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
        serif: ["Iowan Old Style", "Baskerville", "Times New Roman", "serif"]
      },
      letterSpacing: {
        editorial: "0.18em"
      },
      boxShadow: {
        soft: "0 22px 70px rgba(23, 22, 18, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
