import type { Config } from "tailwindcss";
import typographyPlugin from '@tailwindcss/typography'; // import 구문으로 변경

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
    },
  },
  plugins: [
    typographyPlugin, // import한 변수 사용
  ],
} satisfies Config;
