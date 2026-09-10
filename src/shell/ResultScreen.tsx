import { useEffect } from 'react';
import type { Result } from '../games/types';
import { celebrate } from '../fx/confetti';
import { play } from '../fx/sound';
import type { Player } from '../players/types';

// Résultat d'un jeu solo à score (Result.score défini), enrichi par App.tsx
// via storage/index.ts (getHighScore/recordScore) — le shell calcule ça
// génériquement, sans connaître la signification du score pour le jeu.
export interface ScoreInfo {
  value: number;
  best: number;
  isNewBest: boolean;
  // Optionnel (Result.score.maxValue, games/types.ts) : quand présent, le
  // score s'affiche en pourcentage plutôt qu'en nombre brut — le shell ne
  // sait toujours pas ce qu'une « unité » de score représente pour ce jeu.
  maxValue?: number;
}

interface ResultScreenProps {
  result: Result;
  players: Player[];
  scoreInfo?: ScoreInfo;
  onReplay(): void;
  onMenu(): void;
}

// Laisse la photo du gagnant s'afficher un instant avant les confettis —
// spec 03, critère 9 : ligne, puis photo, puis confettis.
const CONFETTI_DELAY_MS = 200;

function toPercent(value: number, maxValue: number): number {
  return Math.round((value / maxValue) * 100);
}

export function ResultScreen({ result, players, scoreInfo, onReplay, onMenu }: ResultScreenProps) {
  const resultPlayer = result.kind === 'win' ? players.find((p) => p.id === result.winner) : undefined;
  // Un jeu solo à score (result.score défini) n'a pas de vraie « victoire » à
  // fêter en soi — seul un nouveau record en a une (le score en lui-même ne
  // fait que confirmer une valeur, « rien ne bouge tout seul »).
  const scorer = result.kind === 'win' && result.score ? resultPlayer : undefined;
  const winner = scorer ? undefined : resultPlayer;
  const celebrationColor = winner?.color ?? (scoreInfo?.isNewBest ? scorer?.color : undefined);

  useEffect(() => {
    if (!celebrationColor) return;
    const timer = setTimeout(() => celebrate(celebrationColor), CONFETTI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [celebrationColor]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-12 bg-board px-4 sm:px-12">
      <div className="flex flex-col items-center gap-6">
        {winner || scorer ? (
          <img
            src={(winner ?? scorer)!.photo}
            alt=""
            className="h-32 w-32 rounded-full object-cover sm:h-48 sm:w-48"
            style={{ boxShadow: `0 0 0 6px ${(winner ?? scorer)!.color}` }}
          />
        ) : (
          <div className="flex items-center gap-4 sm:gap-8">
            {players.map((player) => (
              <img
                key={player.id}
                src={player.photo}
                alt=""
                className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
                style={{ boxShadow: `0 0 0 5px ${player.color}` }}
              />
            ))}
          </div>
        )}
        {scorer && scoreInfo ? (
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl text-piece">
              {scoreInfo.isNewBest ? 'Nouveau record !' : scorer.name}
            </h1>
            {scoreInfo.maxValue ? (
              <>
                <p className="text-2xl text-piece/80">Score : {toPercent(scoreInfo.value, scoreInfo.maxValue)} %</p>
                <p className="text-xl text-piece/60">
                  Meilleur score : {toPercent(scoreInfo.best, scoreInfo.maxValue)} %
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl text-piece/80">Score : {scoreInfo.value}</p>
                <p className="text-xl text-piece/60">Meilleur score : {scoreInfo.best}</p>
              </>
            )}
          </div>
        ) : (
          <h1 className="text-5xl text-piece">{winner ? `${winner.name} gagne !` : 'Match nul !'}</h1>
        )}
      </div>
      <div className="flex gap-6">
        <button
          type="button"
          onClick={() => {
            play('tap');
            onReplay();
          }}
          className="h-24 rounded-3xl bg-victory px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Rejouer
        </button>
        <button
          type="button"
          onClick={() => {
            play('tap');
            onMenu();
          }}
          className="h-24 rounded-3xl bg-piece px-10 text-2xl text-board shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
        >
          Retour au menu
        </button>
      </div>
    </div>
  );
}
