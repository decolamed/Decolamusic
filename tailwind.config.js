/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { blue: '#1e6bff', blueDark: '#1550c7', orange: '#ff7a1a' },
        surface: { 0: '#000000', 1: '#0b0b10', 2: '#14141c', 3: '#1d1d28' }
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } }
      },
      animation: { fadeIn: 'fadeIn .35s ease both', slideUp: 'slideUp .3s ease both' }
    }
  },
  plugins: []
};
