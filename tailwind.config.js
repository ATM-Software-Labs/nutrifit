/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fondos y superficies (claro / oscuro)
        bg: { DEFAULT: '#FAFAFA', dark: '#09090B' },
        card: { DEFAULT: '#FFFFFF', dark: '#18181B' },
        graphite: '#111827',
        // Marca
        mint: {
          DEFAULT: '#10B981',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        // Macros
        protein: '#EF4444',
        carbs: '#3B82F6',
        fats: '#F59E0B',
      },
      fontFamily: {
        sans: [
          'Outfit', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
    },
  },
  plugins: [],
}
