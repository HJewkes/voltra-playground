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
      colors: {
        ...titanConfig.theme?.extend?.colors,
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};
