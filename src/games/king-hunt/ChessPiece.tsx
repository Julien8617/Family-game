import { PIECE_SHAPES } from '../../chess/shapes';
import type { PieceType } from '../../chess/pieces';
import type { PieceSkin } from '../../chess/skin';

// Copie volontaire de piece-quiz/ChessPiece.tsx (spec 07 : la chasse ne peut
// pas importer piece-quiz/, dossier d'un autre jeu — critère d'acceptation
// 2). Les silhouettes et skins qu'il transforme en SVG restent celles de
// src/chess/, strictement inchangées — voir NOTES.md pour cette duplication
// assumée, même précédent que pawnSkin.ts (chess-race → chess/skin.ts).

interface ChessPieceProps {
  type: PieceType;
  skin: PieceSkin;
  className?: string;
  strokeWidth?: number;
}

export function ChessPiece({ type, skin, className = 'h-[72%] w-[72%]', strokeWidth = 1.3 }: ChessPieceProps) {
  const shape = PIECE_SHAPES[type];
  return (
    <svg viewBox={shape.viewBox} className={className} aria-hidden>
      <g fill={skin.fill} stroke={skin.stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round">
        {shape.elements.map((el, i) => {
          switch (el.kind) {
            case 'circle':
              return <circle key={i} cx={el.cx} cy={el.cy} r={el.r} />;
            case 'rect':
              return <rect key={i} x={el.x} y={el.y} width={el.width} height={el.height} rx={el.rx} />;
            case 'path':
              return <path key={i} d={el.d} fill={el.fill} />;
          }
        })}
      </g>
    </svg>
  );
}
