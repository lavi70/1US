/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        etsy: {
          orange: '#F96C26',
          dark: '#222222',
          gray: '#757575',
          light: '#F5F5F5',
          border: '#DDDDDD',
        },
      },
    },
  },
  plugins: [],
};
