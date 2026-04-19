/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#8B7355',
        secondary: '#0F172A',
      },
      fontFamily: {
        sans: ['Kanit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
