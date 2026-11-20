/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { blue: '#1e6bff', blueDark: '#1550c7', orange: '#ff7a1a' },
        surface: { 0: '#000000', 1: '#08090d', 2: '#12131a', 3: '#1c1d27' }
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
