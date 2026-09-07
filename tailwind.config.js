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
        // Cases de l'échiquier (spec 04) — un vrai jeu d'échecs a des pièces à
        // couleur fixe, pas teintées par le profil du joueur.
        squareLight: '#EDE0C0',
        squareDark: '#2A4A40',
        chickYellow: '#E3B23C',
        chickRed: '#C94F3D',
      },
      fontFamily: {
        // ui-rounded rend SF Pro Rounded sur iPadOS Safari — la cible réelle —
        // sans police vendorisée ni appel réseau. Bascule sur des polices
        // système grasses ailleurs.
        display: ['ui-rounded', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'win-line': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'win-line': 'win-line 200ms ease-out',
      },
    },
  },
  plugins: [],
};
