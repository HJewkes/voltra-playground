/** @type {import('tailwindcss').Config} */
const titanConfig = require('@titan-design/react-ui/tailwind.config.js')

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@titan-design/react-ui/dist/**/*.{js,mjs}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      ...titanConfig.theme?.extend,
      // Legacy color aliases for incremental migration
      colors: {
        ...titanConfig.theme?.extend?.colors,
        // Keep old primary palette until all references are migrated
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
        // Keep old surface numeric palette until migrated
        'surface-legacy': {
          50: '#3d3d3d',
          100: '#333333',
          200: '#2d2d2d',
          300: '#262626',
          400: '#1f1f1f',
          500: '#1a1a1a',
          600: '#141414',
          700: '#0f0f0f',
        },
        // Keep old content colors until migrated
        content: {
          primary: '#ffffff',
          secondary: '#a1a1aa',
          tertiary: '#71717a',
          muted: '#52525b',
        },
        // Keep old semantic colors until migrated
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
  darkMode: 'class',
};
