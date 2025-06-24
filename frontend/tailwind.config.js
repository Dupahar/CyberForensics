/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'forensics-blue': '#1e3a8a',
        'forensics-gray': '#374151',
        'evidence-green': '#10b981',
        'warning-red': '#ef4444',
      }
    },
  },
  plugins: [],
}