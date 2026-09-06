/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        board: '#1E3D34',
        piece: '#F2E4C9',
        player1: '#C94F3D',
        player2: '#3C6E9F',
        victory: '#F5A623',
      },
      fontFamily: {
        // ui-rounded rend SF Pro Rounded sur iPadOS Safari — la cible réelle —
        // sans police vendorisée ni appel réseau. Bascule sur des polices
        // système grasses ailleurs.
        display: ['ui-rounded', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
