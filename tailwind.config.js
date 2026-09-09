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
        // Palette fixe de l'échiquier (spec 04) : cases et rangées d'arrivée.
        // Les pions, eux, ne sont plus teintés en blanc/noir fixe — leur
        // couleur vient du profil du joueur (voir chess-race/pawnSkin.ts).
        squareLight: '#EDE0C0',
        squareDark: '#2A4A40',
        chessWhite: '#FAF6EC',
        chessBlack: '#201C16',
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
        // Un jeton tombe depuis le haut de sa colonne (--fall, en cases,
        // posé par Board.tsx) jusqu'à sa case d'arrivée. Un seul passage,
        // pas de rebond en keyframes séparées : le petit dépassement vient
        // entièrement du timing-function (cubic-bezier qui overshoot),
        // même approche minimale que win-line ci-dessus.
        'connect4-drop': {
          '0%': { transform: 'translateY(calc(var(--fall, 0) * -100%))' },
          '100%': { transform: 'translateY(0%)' },
        },
      },
      animation: {
        'win-line': 'win-line 200ms ease-out',
        'connect4-drop': 'connect4-drop 384ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
