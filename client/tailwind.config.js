/** @type {import('tailwindcss').Config} */
// Identité RouteBénin : l'encre indigo (texte, navigation) et le jaune des
// chemises de zémidjans (action principale, arrêts de la tournée).
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        encre: {
          DEFAULT: '#171B3F',
          700: '#22274F',
          600: '#2F3563',
        },
        zem: {
          DEFAULT: '#FFC414',
          600: '#EBAD00',
          100: '#FFF3C4',
          50: '#FFFAE6',
        },
        sol: '#F1F2EE',
        ligne: '#DCDED8',
        gain: { DEFAULT: '#0A7D55', 50: '#E3F3EC' },
        alerte: { DEFAULT: '#C8372D', 50: '#FBEAE8' },
        attention: { DEFAULT: '#9A5B00', 50: '#FDF1DC' },
        whatsapp: { DEFAULT: '#128C4B', 600: '#0F7A41' },
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        titre: ['"Barlow Semi Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Échelle typographique (base 16 px, rapport ~1,2)
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
        sm: ['0.875rem', { lineHeight: '1.3rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.1875rem', { lineHeight: '1.6rem' }],
        xl: ['1.5rem', { lineHeight: '1.9rem' }],
        '2xl': ['2rem', { lineHeight: '2.3rem' }],
        '3xl': ['2.75rem', { lineHeight: '1' }],
      },
      boxShadow: {
        pop: '0 12px 32px -12px rgba(23,27,63,0.28), 0 2px 6px -2px rgba(23,27,63,0.12)',
        panneau: '1px 0 0 #DCDED8',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
