import type { CSSProperties } from 'react';
import type { BoardProps } from '../types';
import { COLS, getWinningLine, ROWS } from './logic';
import type { Connect4Move, Connect4State } from './logic';

// Partagée par la grille décorative (trous + jetons) et par la grille de
// cases tactiles qui la recouvre : mêmes marges et mêmes espacements des
// deux côtés, sinon une case tactile ne tomberait plus exactement sous le
// trou qu'elle est censée couvrir. Volontairement plus serré qu'ailleurs
// dans l'app (2 % au lieu des espacements plus larges du morpion) : sur
// iPhone, 7 colonnes dans une largeur de plateau contrainte par le carré que
// le shell réserve (`GameScreen`, ~352 px sur un iPhone X) laissent sinon
// des cases sous les 44 px — le minimum tactile documenté dans CLAUDE.md.
const GRID_LAYOUT = 'grid grid-cols-7 grid-rows-6 gap-[1.5%] p-[1%]';

export function Board({ state, players, onMove }: BoardProps<Connect4State, Connect4Move>) {
  const winningLine = getWinningLine(state);
  const colorOf = (playerId: string) => players.find((p) => p.id === playerId)?.color;

  // Nombre de pions déjà posés : change à chaque coup, sert de clé pour ne
  // relancer l'animation de chute que sur le jeton qui vient tout juste de
  // tomber (voir plus bas) — jamais sur ceux déjà posés lors des rendus
  // suivants.
  const filledCount = state.board.filter((cell) => cell !== null).length;

  // Rangée 0 (données) = bas du plateau ; on affiche donc du haut vers le
  // bas de l'écran en partant de la rangée la plus haute.
  const visualRows: number[] = [];
  for (let row = ROWS - 1; row >= 0; row--) visualRows.push(row);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div
        className="relative w-full rounded-3xl bg-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)]"
        style={{ aspectRatio: '7 / 6' }}
      >
        {/* Trous et jetons — purement décoratif, aucun gestionnaire de clic
            ici : une case tactile de la largeur d'un trou (~42-45 px sur
            iPhone) reste un mauvais objectif pour un enfant qui vise mal.
            La grille de boutons ci-dessous prend le relai, une par colonne,
            sur toute la hauteur du plateau. */}
        <div className={`${GRID_LAYOUT} h-full w-full`} aria-hidden>
          {visualRows.map((row) =>
            Array.from({ length: COLS }, (_, col) => {
              const cell = row * COLS + col;
              const occupant = state.board[cell];
              const isWinningCell = winningLine?.includes(cell) ?? false;
              const isLastMove = state.lastMove === cell;
              // Distance en nombre de cases depuis le haut du plateau —
              // point de départ de l'animation de chute pour cette case.
              const fallRows = ROWS - 1 - row;

              return (
                <div key={cell} className="relative flex items-center justify-center rounded-full bg-piece/15">
                  {occupant && (
                    <span
                      // Clé stable ('settled') une fois posé : le jeton ne
                      // rejoue pas sa chute aux coups suivants. Clé
                      // changeante ('drop-<n>') seulement pour la case qui
                      // vient de recevoir CE coup-ci — force React à
                      // remonter l'élément et donc à relancer l'animation,
                      // une seule fois.
                      key={isLastMove ? `drop-${filledCount}` : 'settled'}
                      // Anneau clair systématique, quelle que soit la
                      // couleur du joueur : sur un trou sombre, une couleur
                      // de profil elle aussi sombre (vert émeraude, ardoise
                      // — palette.ts) se fondrait presque entièrement dans
                      // le panneau sans lui. Contrairement au pion des
                      // échecs (case claire, trait sombre), ici le fond est
                      // toujours sombre : c'est un anneau clair, pas un
                      // contour sombre, qui garantit le contraste pour les
                      // 8 couleurs.
                      className={`absolute inset-[8%] rounded-full shadow-inner ring-2 ring-inset ring-piece/60 ${
                        isLastMove ? 'animate-connect4-drop' : ''
                      }`}
                      style={
                        {
                          backgroundColor: colorOf(occupant),
                          '--fall': fallRows,
                        } as CSSProperties
                      }
                    />
                  )}
                  {isWinningCell && (
                    <span className="absolute inset-0 rounded-full ring-4 ring-inset ring-victory" />
                  )}
                </div>
              );
            }),
          )}
        </div>

        {/* Cases tactiles — un seul bouton par colonne, étiré sur toute la
            hauteur du plateau (`gridRow: '1 / -1'`) plutôt qu'une case par
            trou : à ~42 px de large sur iPhone (7 colonnes dans un plateau
            contraint par le carré du shell), une case carrée de cette
            taille est un mauvais objectif pour un enfant qui vise mal — la
            hauteur pleine du plateau rend le geste bien plus tolérant.
            Même disposition (GRID_LAYOUT) que la grille décorative en
            dessous pour rester alignée sous elle. */}
        <div className={`${GRID_LAYOUT} absolute inset-0 h-full w-full`}>
          {Array.from({ length: COLS }, (_, col) => (
            <button
              key={col}
              type="button"
              onClick={() => onMove({ col })}
              aria-label={`Colonne ${col + 1}`}
              className="h-full w-full"
              style={{ gridRow: '1 / -1', gridColumn: col + 1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
