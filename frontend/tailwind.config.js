/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#0e0e0f',
          800: '#131313',
          700: '#1a1a1d',
          600: '#232327',
        },
        gold: {
          500: '#d4af37',
          400: '#e3c96a',
          300: '#f2df9e',
        },
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.35), 0 10px 30px rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        'obsidian-gradient':
          'radial-gradient(circle at top right, #232327 0%, #131313 45%, #0e0e0f 100%)',
      },
    },
  },
  plugins: [],
}

