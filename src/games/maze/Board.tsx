import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { BoardProps } from '../types';
import { HOME_CELLS_BY_SEAT, previewShift, reachableFrom, shortestPath, SIZE, SLOTS } from './logic';
import type { MazeMode, MazeMove, MazeState, Rotation } from './logic';
import { TREASURE_ICONS } from './treasures';
import tileStraight from '../../vendor/maze-tiles/tile-straight.svg';
import tileCorner from '../../vendor/maze-tiles/tile-corner.svg';
import tileTee from '../../vendor/maze-tiles/tile-tee.svg';
import pathIcon from './path-icon.svg';

// Indexé par Shape (logic.ts : STRAIGHT=0, CORNER=1, TEE=2).
const TILE_IMAGES = [tileStraight, tileCorner, tileTee];

// Bande réservée en haut du plateau (tuile en main + bouton Chemin) — même
// principe que king-hunt/piece-quiz (hauteur explicitement réservée, jamais
// une superposition en position absolue qui risquerait de chevaucher une
// case). Volontairement compacte : sur iPhone, chaque pixel de hauteur pris
// ici est un pixel de LARGEUR perdu pour la grille 7×7 une fois celle-ci
// recadrée en carré (voir NOTES.md) — à revalider sur l'appareil réel.
const RESERVED_HEADER_PX = 64;

const REVEAL_STEP_MS = 900;
const REVEAL_LEAD_IN_MS = 400;

// Durée d'un pas du pion le long de son chemin — l'autre animation attendue
// par la spec (« le pion qui parcourt son chemin, tuile par tuile »). Le
// glissement d'une rangée/colonne, lui, n'a pas de minuteur : c'est une
// simple transition CSS sur la position de chaque tuile (voir plus bas,
// tuiles à clé stable `tile.id`), qui s'anime tout seule dès que
// `effectiveBoard` change — pour un décalage prévisualisé par le joueur
// local comme pour un coup déjà joué par un adversaire ou le bot.
const WALK_STEP_MS = 220;

interface WalkAnim {
  playerIndex: number;
  path: number[];
  step: number;
  // Présent seulement pour notre propre geste local : le coup à émettre une
  // fois le parcours terminé. Absent quand on rejoue après coup le parcours
  // d'un coup déjà appliqué (bot, ou un autre joueur sur un appareil
  // partagé) — dans ce cas on ne fait qu'animer, `state` a déjà changé.
  pendingMove?: MazeMove;
}

interface ModeTile {
  mode: MazeMode;
  label: string;
  hint: string;
}

const MODE_TILES: ModeTile[] = [
  { mode: 'course', label: 'La course', hint: 'Le même trésor pour tout le monde' },
  { mode: 'partage', label: 'Le partage', hint: 'Trois trésors chacun' },
  { mode: 'solo', label: 'Solo', hint: 'Six trésors, le moins de décalages possible' },
];

export function Board({ state, players, onMove }: BoardProps<MazeState, MazeMove>) {
  const [rotation, setRotation] = useState<Rotation>(0);
  const [chosenSlot, setChosenSlot] = useState<number | null>(null);
  const [pathHeld, setPathHeld] = useState(false);
  const [walk, setWalk] = useState<WalkAnim | null>(null);
  const prevStateRef = useRef(state);
  // true juste après qu'on ait nous-même déclenché onMove (parcours local
  // terminé, ou coup sans déplacement) — évite que l'effet de détection
  // ci-dessous ne rejoue une deuxième fois un parcours qu'on vient
  // d'animer nous-même.
  const suppressNextWalkDetectionRef = useRef(false);

  // Un coup vient d'être appliqué (accepté) — même patron que
  // king-hunt/chess-race : la nouvelle référence de state réinitialise le
  // geste local en cours.
  useEffect(() => {
    setRotation(0);
    setChosenSlot(null);
  }, [state]);

  // Rejoue après coup le parcours d'un pion pour un coup qu'on n'a pas
  // animé nous-même (le bot, ou un autre joueur sur un appareil partagé) —
  // sans ça, seuls nos propres coups locaux se verraient marcher case par
  // case, ce qui serait incohérent.
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (prev === state) return;
    if (suppressNextWalkDetectionRef.current) {
      suppressNextWalkDetectionRef.current = false;
      return;
    }
    if (!state.lastTurn || state.lastTurn === prev.lastTurn) return;
    const moverIndex = state.players.indexOf(state.lastTurn.playerId);
    if (moverIndex === -1) return;
    const { pawns: wrappedPawns } = previewShift(prev, state.lastTurn.slot, state.lastTurn.rotation);
    const path = shortestPath(state.board, wrappedPawns[moverIndex], state.lastTurn.destination);
    if (path && path.length > 1) setWalk({ playerIndex: moverIndex, path, step: 0 });
  }, [state]);

  // Avance le parcours en cours d'un cran toutes les WALK_STEP_MS ; au
  // dernier cran, émet le coup en attente s'il y en a un (notre propre
  // geste), sinon s'efface simplement (parcours rejoué après coup).
  useEffect(() => {
    if (!walk) return undefined;
    if (walk.step >= walk.path.length - 1) {
      if (walk.pendingMove) {
        suppressNextWalkDetectionRef.current = true;
        onMove(walk.pendingMove);
      }
      setWalk(null);
      return undefined;
    }
    const timer = setTimeout(() => setWalk((w) => (w ? { ...w, step: w.step + 1 } : w)), WALK_STEP_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk]);

  if (state.phase === 'setup') {
    const seatCount = state.players.length;
    const tiles = MODE_TILES.filter((t) => (t.mode === 'solo' ? seatCount === 1 : seatCount === 2));
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-3xl bg-piece/10 p-6">
        <p className="text-xl text-piece/80">Comment joue-t-on ?</p>
        <div className="flex flex-col gap-4">
          {tiles.map((tile) => (
            <button
              key={tile.mode}
              type="button"
              onClick={() => onMove({ type: 'chooseMode', mode: tile.mode })}
              className="flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-3xl bg-piece/20 px-8 py-4"
            >
              <span className="text-xl text-piece">{tile.label}</span>
              <span className="text-sm text-piece/70">{tile.hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (state.phase === 'dealing' && state.progress?.kind === 'perPlayer') {
    return <DealingScreen state={state} players={players} onDone={() => onMove({ type: 'dealingDone' })} />;
  }

  // ---- phase 'playing' / 'gameover' ----

  const moverIndex = state.turnIndex;
  const preview = chosenSlot !== null ? previewShift(state, chosenSlot, rotation) : null;
  const effectiveBoard = preview?.board ?? state.board;
  const effectivePawns = preview?.pawns ?? state.pawns;
  const moverCell = effectivePawns[moverIndex];
  const showingDestinations = chosenSlot !== null && state.phase === 'playing' && !walk;
  const reachable = (showingDestinations || pathHeld) && !walk ? reachableFrom(effectiveBoard, moverCell) : null;

  const forbiddenSlot = state.forbiddenSlot;

  function handleSlotTap(slot: number) {
    if (walk || slot === forbiddenSlot) return;
    setChosenSlot(slot);
  }

  function handleDestinationTap(cell: number) {
    if (walk || chosenSlot === null || !reachable?.[cell]) return;
    const move: MazeMove = { type: 'turn', slot: chosenSlot, rotation, destination: cell };
    const path = shortestPath(effectiveBoard, moverCell, cell);
    if (!path || path.length <= 1) {
      // Reste sur place : rien à faire marcher, coup immédiat.
      suppressNextWalkDetectionRef.current = true;
      onMove(move);
      return;
    }
    setWalk({ playerIndex: moverIndex, path, step: 0, pendingMove: move });
  }

  const currentTargetId =
    state.progress?.kind === 'perPlayer' ? state.progress.queues[moverIndex]?.[0] : state.progress?.queue[0];

  // Position RENDUE de chaque pion — remplace sa case par l'étape courante
  // du parcours animé quand il y en a un pour ce siège (le sien ou celui
  // qu'on rejoue après coup), sinon sa case réelle.
  const renderedPawnCell = state.players.map((_, i) =>
    walk && walk.playerIndex === i ? walk.path[walk.step] : effectivePawns[i],
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center">
      <div className="flex w-full shrink-0 items-center justify-between gap-2 px-1" style={{ height: RESERVED_HEADER_PX }}>
        <button
          type="button"
          onClick={() => setRotation((r) => ((r + 1) % 4) as Rotation)}
          disabled={Boolean(walk)}
          aria-label="Tourner la tuile en main"
          className="relative flex h-full items-center justify-center p-2"
        >
          <img
            src={TILE_IMAGES[state.handTile.shape]}
            alt=""
            className="h-full w-auto rounded-lg transition-transform"
            style={{ transform: `rotate(${rotation * 90}deg)` }}
          />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-victory text-xs text-board">
            ↻
          </span>
        </button>

        {currentTargetId !== undefined && currentTargetId !== null && (
          <div className="flex h-full items-center justify-center rounded-2xl bg-piece/10 px-3">
            <img src={TREASURE_ICONS[currentTargetId]} alt="Trésor recherché" className="h-[70%] w-auto" />
          </div>
        )}

        <button
          type="button"
          onPointerDown={() => setPathHeld(true)}
          onPointerUp={() => setPathHeld(false)}
          onPointerLeave={() => setPathHeld(false)}
          onPointerCancel={() => setPathHeld(false)}
          disabled={Boolean(walk)}
          aria-label="Chemin"
          className="flex h-full items-center justify-center rounded-2xl bg-piece/15 px-4"
        >
          <img src={pathIcon} alt="" className="h-[60%] w-auto opacity-80" />
        </button>
      </div>

      <div
        className="relative mt-1 overflow-visible rounded-2xl bg-board p-[2px] shadow-[0_6px_0_0_rgba(0,0,0,0.25)]"
        style={{ aspectRatio: '1 / 1', height: `calc(100% - ${RESERVED_HEADER_PX}px)` }}
      >
        <div className="relative h-full w-full">
          {/* Tuiles : une clé stable par tuile physique (tile.id, jamais la
              case) — quand `effectiveBoard` change (aperçu d'un décalage,
              ou coup déjà appliqué par un adversaire/le bot), React déplace
              le même nœud DOM plutôt que d'en recréer un, et la transition
              CSS sur top/left fait le reste : c'est tout le glissement
              animé, sans minuteur ni calcul de trajectoire. */}
          {effectiveBoard.map((tile, cell) => {
            const row = Math.floor(cell / SIZE);
            const col = cell % SIZE;
            const isHome = HOME_CELLS_BY_SEAT.includes(cell);
            const homeSeat = HOME_CELLS_BY_SEAT.indexOf(cell);
            const homePlayerId = isHome ? state.players[homeSeat] : undefined;
            const homePlayer = homePlayerId ? players.find((p) => p.id === homePlayerId) ?? null : null;
            const isActiveTreasure = tile.treasure !== -1 && state.activeTreasureIds.includes(tile.treasure);
            const isCollected = tile.treasure !== -1 && state.collectedTreasureIds.includes(tile.treasure);

            return (
              <div
                key={tile.id}
                className="absolute overflow-hidden rounded-md transition-[top,left] duration-[250ms] ease-out"
                style={{
                  width: `${100 / SIZE}%`,
                  height: `${100 / SIZE}%`,
                  top: `${(100 / SIZE) * row}%`,
                  left: `${(100 / SIZE) * col}%`,
                }}
              >
                <img
                  src={TILE_IMAGES[tile.shape]}
                  alt=""
                  className="absolute inset-0 h-full w-full"
                  style={{ transform: `rotate(${tile.rotation * 90}deg)` }}
                />
                {homePlayer && (
                  <span
                    className="absolute inset-[8%] rounded-md"
                    style={{ backgroundColor: homePlayer.color, opacity: 0.35 }}
                  />
                )}
                {homePlayer && (
                  <img
                    src={homePlayer.photo}
                    alt=""
                    className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover"
                    style={{ boxShadow: `0 0 0 2px ${homePlayer.color}` }}
                  />
                )}
                {tile.treasure !== -1 && (
                  <img
                    src={TREASURE_ICONS[tile.treasure]}
                    alt=""
                    className="absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 object-contain"
                    style={{ opacity: isCollected ? 0.12 : isActiveTreasure ? 1 : 0.3 }}
                  />
                )}
              </div>
            );
          })}

          {/* Pions : clé par joueur (pas par case), même technique de
              transition CSS — sert à la fois au glissement (décalage) et,
              combiné au minuteur ci-dessus, au parcours pas à pas. */}
          {state.players.map((playerId, seatIndex) => {
            const player = players.find((p) => p.id === playerId);
            if (!player) return null;
            const cell = renderedPawnCell[seatIndex];
            const row = Math.floor(cell / SIZE);
            const col = cell % SIZE;
            const sharedWith = renderedPawnCell.map((c, i) => (c === cell ? i : -1)).filter((i) => i !== -1);
            const offset = sharedWith.length > 1 ? (sharedWith.indexOf(seatIndex) === 0 ? -18 : 18) : 0;

            return (
              <div
                key={playerId}
                className="pointer-events-none absolute transition-[top,left] duration-[220ms] ease-linear"
                style={{
                  width: `${100 / SIZE}%`,
                  height: `${100 / SIZE}%`,
                  top: `${(100 / SIZE) * row}%`,
                  left: `${(100 / SIZE) * col}%`,
                }}
              >
                <img
                  src={player.photo}
                  alt=""
                  className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-y-1/2 rounded-full object-cover"
                  style={{ boxShadow: `0 0 0 2px ${player.color}`, transform: `translateX(calc(-50% + ${offset}%))` }}
                />
              </div>
            );
          })}

          {/* Cibles tactiles + surbrillances — grille invisible par-dessus,
              jamais déplacée : seule la disponibilité de chaque bouton change. */}
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)` }}
          >
            {Array.from({ length: SIZE * SIZE }, (_, cell) => {
              const isReachable = reachable?.[cell] ?? false;
              const isLastDestination = state.lastTurn?.destination === cell;
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => handleDestinationTap(cell)}
                  disabled={!showingDestinations || !isReachable}
                  className="relative"
                >
                  {isReachable && showingDestinations && (
                    <span className="absolute inset-1 rounded-md ring-4 ring-victory/80" />
                  )}
                  {pathHeld && isReachable && !showingDestinations && (
                    <span className="absolute inset-1 rounded-md ring-4 ring-victory/50" />
                  )}
                  {isLastDestination && <span className="absolute inset-0 bg-victory/20" />}
                </button>
              );
            })}
          </div>

          {!showingDestinations &&
            !walk &&
            state.phase === 'playing' &&
            SLOTS.map((slot, index) => (
              <SlotButton
                key={index}
                slot={slot}
                forbidden={index === forbiddenSlot}
                onTap={() => handleSlotTap(index)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function SlotButton({
  slot,
  forbidden,
  onTap,
}: {
  slot: (typeof SLOTS)[number];
  forbidden: boolean;
  onTap(): void;
}) {
  const pct = (100 / SIZE) * (slot.line + 0.5);
  const isRow = slot.axis === 'row';
  const onWest = isRow && slot.dir === 1;
  const onEast = isRow && slot.dir === -1;
  const onNorth = !isRow && slot.dir === 1;
  const onSouth = !isRow && slot.dir === -1;

  const style: CSSProperties = { position: 'absolute' };
  if (isRow) {
    style.top = `${pct}%`;
    style.transform = 'translateY(-50%)';
    if (onWest) style.left = '-14px';
    if (onEast) style.right = '-14px';
  } else {
    style.left = `${pct}%`;
    style.transform = 'translateX(-50%)';
    if (onNorth) style.top = '-14px';
    if (onSouth) style.bottom = '-14px';
  }

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={forbidden}
      aria-label={`Décaler ${isRow ? 'la ligne' : 'la colonne'} ${slot.line + 1}`}
      style={style}
      className={`z-10 flex h-9 w-9 items-center justify-center rounded-full text-lg ${
        forbidden ? 'bg-piece/10 text-piece/20' : 'bg-victory text-board'
      }`}
    >
      {onWest && '▶'}
      {onEast && '◀'}
      {onNorth && '▼'}
      {onSouth && '▲'}
    </button>
  );
}

function DealingScreen({
  state,
  players,
  onDone,
}: {
  state: MazeState;
  players: BoardProps<MazeState, MazeMove>['players'];
  onDone(): void;
}) {
  const queues = state.progress!.kind === 'perPlayer' ? state.progress!.queues : [];
  const [revealed, setRevealed] = useState(0);
  const totalCards = queues.reduce((n, q) => n + q.length, 0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i <= totalCards; i++) {
      timers.push(setTimeout(() => setRevealed(i), REVEAL_LEAD_IN_MS + i * REVEAL_STEP_MS));
    }
    timers.push(setTimeout(onDone, REVEAL_LEAD_IN_MS + (totalCards + 1) * REVEAL_STEP_MS));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCards]);

  let shown = 0;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 rounded-3xl bg-piece/10 p-6">
      {state.players.map((playerId, seat) => {
        const player = players.find((p) => p.id === playerId);
        if (!player) return null;
        return (
          <div key={playerId} className="flex items-center gap-4">
            <img
              src={player.photo}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 3px ${player.color}` }}
            />
            <div className="flex gap-3">
              {queues[seat]?.map((treasureId, i) => {
                const isShown = shown++ < revealed;
                return (
                  <span
                    key={i}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-piece/15 transition-opacity"
                    style={{ opacity: isShown ? 1 : 0.15 }}
                  >
                    {isShown && <img src={TREASURE_ICONS[treasureId]} alt="" className="h-[70%] w-[70%] object-contain" />}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
