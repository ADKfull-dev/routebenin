/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media', // suit le thème du système
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identité RouteBénin : bleu nuit + bleu électrique, verts/alertes sobres.
        nuit: {
          DEFAULT: '#0B1F3A', // bleu nuit — couleur principale
          600: '#13294B',
          500: '#1C3A63',
        },
        electrique: {
          DEFAULT: '#2563EB', // bleu électrique — actions
          600: '#1D4ED8',
          400: '#60A5FA',
        },
        succes: '#16A34A',
        alerte: '#DC2626',
        attention: '#EA580C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        carte: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)',
        'carte-hover': '0 8px 24px rgba(16,24,40,0.10)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};
