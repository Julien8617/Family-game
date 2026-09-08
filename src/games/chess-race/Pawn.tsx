import type { PawnSkin } from './pawnSkin';

// Pion « au trait » : tête ronde, col en gélule, jupe évasée, socle plat.
// Silhouette redessinée à la main (app hors ligne, zéro asset de tiers).
// La couleur vient d'un skin calculé par pawnSkin() — voir ce module.

type PawnProps = {
  skin: PawnSkin;
  /** Retourne la pièce à 180° pour le joueur assis en face (mode partagé). */
  rotated?: boolean;
  /** Taille dans la case. Par défaut 72 % comme le plateau actuel. */
  className?: string;
  /** Épaisseur du trait, en unités du viewBox 45×45. */
  strokeWidth?: number;
};

export function Pawn({
  skin,
  rotated = false,
  className = 'h-[72%] w-[72%]',
  strokeWidth = 1.3,
}: PawnProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      className={className}
      style={rotated ? { transform: 'rotate(180deg)' } : undefined}
      aria-hidden
    >
      <g
        fill={skin.fill}
        stroke={skin.stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Ordre de tracé : tête, puis corps, puis col. Le col est dessiné en
            dernier pour masquer le bas de la tête et le haut de la jupe —
            c'est ce qui donne le trait continu du dessin d'origine. */}
        <circle cx="22.5" cy="9.3" r="6.9" />
        <path
          d="M18.3 19.6
             C18.5 28.2 15.0 34.4 10.4 37.1
             L10.4 42.9
             L34.6 42.9
             L34.6 37.1
             C30.0 34.4 26.5 28.2 26.7 19.6
             Z"
        />
        <rect x="12.3" y="15.7" width="20.4" height="5.5" rx="2.75" />
      </g>
    </svg>
  );
}
