/** @type {import('tailwindcss').Config} */
export default {
  // Thème clair uniquement (fond blanc garanti) : le mode sombre ne s'active
  // jamais automatiquement. Les classes `dark:` restent inertes.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Encre (bleu nuit) : texte principal + bloc d'accent fort (le gain).
        nuit: {
          DEFAULT: '#0A1A2F',
          900: '#07131F',
          600: '#0F2947',
          500: '#16365C',
        },
        // Cobalt : actions principales, tracé d'itinéraire, liens.
        electrique: {
          DEFAULT: '#1A56DB',
          600: '#1347B5',
          400: '#7AA0F5',
          50: '#EEF3FF',
        },
        // Émeraude : gains et résultats positifs.
        succes: {
          DEFAULT: '#0E9F6E',
          50: '#E6F6EF',
        },
        alerte: '#E02424',
        attention: '#D97706',
        // Filet hairline pour délimiter sans ombre.
        ligne: '#E6E8EC',
        brume: '#F7F8FA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Ombres discrètes, réservées aux éléments en relief (menus, modale).
        carte: '0 1px 2px rgba(10,26,47,0.04)',
        pop: '0 10px 30px -10px rgba(10,26,47,0.18)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};
