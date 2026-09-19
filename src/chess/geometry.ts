// Géométrie d'un échiquier paramétré par sa taille (5×5 ou 8×8 pour l'instant,
// aucune autre valeur supposée ailleurs dans ce module). Index de case =
// row * size + col, row 0 = bord des pièces amies (elles avancent vers row
// croissant — voir chess/pieces.ts, pawnDirection) — pur, aucun rendu.

export function cellOf(size: number, row: number, col: number): number {
  return row * size + col;
}

export function rowOf(size: number, cell: number): number {
  return Math.floor(cell / size);
}

export function colOf(size: number, cell: number): number {
  return cell % size;
}

export function inBounds(size: number, row: number, col: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

// Coordonnée algébrique (a1, h8...) — utile pour aria-label ; l'affichage des
// coordonnées à l'écran reste une décision de Board.tsx (spec 06 : seulement
// en 8×8).
export function algebraic(size: number, cell: number): string {
  return `${String.fromCharCode(97 + colOf(size, cell))}${rowOf(size, cell) + 1}`;
}
