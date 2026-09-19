import { PIECE_SHAPES } from '../../chess/shapes';
import type { PieceType } from '../../chess/pieces';
import type { PieceSkin } from '../../chess/skin';

// Rendu React des silhouettes pures de src/chess/shapes.ts — ce fichier est
// le seul, dans tout piece-quiz/, à importer React pour ça (chess/shapes.ts
// reste des données pures, voir CLAUDE.md règle 5).

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
