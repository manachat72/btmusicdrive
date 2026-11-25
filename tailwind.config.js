/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './blog/*.html', './*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#8B7355',
        secondary: 'rgb(15, 23, 42)',
      },
      fontFamily: {
        sans: ['Kanit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
