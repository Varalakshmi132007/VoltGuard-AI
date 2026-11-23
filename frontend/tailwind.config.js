/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060B16',
          900: '#0B1329',
          850: '#0E1733',
          800: '#131E3D',
          700: '#1C2B54',
          600: '#263B73',
        },
        electric: {
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          blue: '#00F0FF',
        },
        volt: {
          green: '#10B981',
          yellow: '#F59E0B',
          orange: '#F97316',
          red: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
