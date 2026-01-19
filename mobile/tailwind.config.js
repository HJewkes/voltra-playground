/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Orange primary palette
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Dark mode surface colors (neumorphic)
        surface: {
          50: '#3d3d3d',   // Lightest (highlight)
          100: '#333333',  // Light
          200: '#2d2d2d',  // Card background
          300: '#262626',  // Elevated surface
          400: '#1f1f1f',  // Main background
          500: '#1a1a1a',  // Darker background
          600: '#141414',  // Darkest
          700: '#0f0f0f',  // Shadow color base
        },
        // Text colors for dark mode
        content: {
          primary: '#ffffff',
          secondary: '#a1a1aa',
          tertiary: '#71717a',
          muted: '#52525b',
        },
        // Semantic colors (adjusted for dark mode)
        success: {
          DEFAULT: '#22c55e',
          dark: '#166534',
          light: '#4ade80',
        },
        warning: {
          DEFAULT: '#eab308',
          dark: '#854d0e',
          light: '#facc15',
        },
        danger: {
          DEFAULT: '#ef4444',
          dark: '#991b1b',
          light: '#f87171',
        },
        info: {
          DEFAULT: '#3b82f6',
          dark: '#1e40af',
          light: '#60a5fa',
        },
      },
    },
  },
  plugins: [],
};
