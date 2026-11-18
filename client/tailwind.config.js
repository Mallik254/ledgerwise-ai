/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          light: '#f3eee3',
          dark: '#0f1512'
        },
        forest: {
          DEFAULT: '#173f2e',
          deep: '#0e2b1f',
          mid: '#245a40',
          soft: '#e4eddf',
          emerald: '#10b981'
        },
        brass: {
          DEFAULT: '#b3874a',
          deep: '#8f6a34',
          soft: '#f2e4cb'
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
