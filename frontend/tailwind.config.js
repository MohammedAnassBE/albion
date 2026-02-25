/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1a1f36",
          light: "#2a3050",
          lighter: "#3d4470",
        },
        accent: {
          DEFAULT: "#e8a838",
          hover: "#d4952e",
          light: "#fdf3e0",
        },
        success: "#2d8a4e",
        warning: "#d97706",
        danger: "#dc2626",
        text: {
          DEFAULT: "#1c1c1c",
          secondary: "#6b7280",
          muted: "#9ca3af",
        },
        surface: {
          DEFAULT: "#ffffff",
          hover: "#faf8f5",
          alt: "#f9fafb",
        },
        bg: "#f3f4f6",
        border: {
          DEFAULT: "#e2ddd5",
          strong: "#c8c2b8",
        },
      },
    },
  },
  plugins: [],
};
