# Tuiles du labyrinthe — une seule source de verite pour la largeur de couloir.
S    = 100          # cote de la tuile
W    = 36           # largeur du couloir : reference = la tuile droite
A    = (S - W) / 2  # 32
B    = A + W        # 68
R    = 11           # rayon des coins de la tuile
RB   = 8            # rayon des coins des blocs de mur
OV   = 14           # debord des blocs hors tuile

MORTAR   = "#553A7D"   # fond entre les pierres
STONE_A  = "#7B57A8"
STONE_B  = "#8664B4"
SPECK    = "#3E2C63"
INK      = "#191225"
PATH     = "#F2E4C9"
PATH_DSH = "#D9C29A"

BW, BH, GAP = 33.0, 26.0, 2.8   # appareil de pierre

TILES = {
    "tile-straight": {
        "walls": [(-OV, -OV, A + OV, S + 2 * OV), (B, -OV, S - B + OV, S + 2 * OV)],
        "axes":  ["M50 0 L50 100"],
    },
    "tile-tee": {
        "walls": [(-OV, -OV, S + 2 * OV, A + OV),
                  (-OV, B, A + OV, S - B + OV),
                  (B, B, S - B + OV, S - B + OV)],
        "axes":  ["M0 50 L100 50", "M50 50 L50 100"],
    },
    "tile-corner": {
        "walls": [(-OV, -OV, A + OV, S + 2 * OV),
                  (A, B, S - A + OV, S - B + OV),
                  (B, -OV, S - B + OV, A + OV)],
        "axes":  ["M50 0 L50 50 L100 50"],
    },
}


def stones(x, y, w, h, cid):
    """Appareil de pierre decale, decoupe au bloc. Grille globale a la tuile :
    les pierres s'alignent d'un bloc a l'autre au lieu de repartir a zero."""
    out = [f'      <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{RB}" fill="{MORTAR}"/>',
           f'      <g clip-path="url(#{cid})">']
    row = -2
    while row * BH < y + h + BH:
        yy = row * BH
        if yy + BH > y - BH and yy < y + h + BH:
            offset = (BW / 2) if row % 2 else 0.0
            col = -2
            while col * BW + offset < x + w + BW:
                xx = col * BW + offset
                if xx + BW > x - BW and xx < x + w + BW:
                    fill = STONE_A if (row + col) % 3 else STONE_B
                    out.append(
                        f'        <rect x="{xx + GAP / 2:.1f}" y="{yy + GAP / 2:.1f}" '
                        f'width="{BW - GAP:.1f}" height="{BH - GAP:.1f}" rx="5" fill="{fill}"/>')
                    if (row * 7 + col * 3) % 4 == 0:
                        out.append(
                            f'        <rect x="{xx + BW * 0.58:.1f}" y="{yy + BH * 0.30:.1f}" '
                            f'width="6.5" height="3" rx="1.5" fill="{SPECK}" opacity="0.55"/>')
                col += 1
        row += 1
    out.append('      </g>')
    out.append(f'      <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{RB}" fill="none" '
               f'stroke="{INK}" stroke-width="3"/>')
    return "\n".join(out)


def svg(name, spec, uid=""):
    clips, blocks = [], []
    for i, (x, y, w, h) in enumerate(spec["walls"]):
        cid = f"b{uid}_{i}"
        clips.append(f'    <clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{RB}"/></clipPath>')
        blocks.append(stones(x, y, w, h, cid))
    dashes = "\n".join(
        f'    <path d="{d}" fill="none" stroke="{PATH_DSH}" stroke-width="3.5" stroke-linecap="round" '
        f'stroke-dasharray="5 17" stroke-dashoffset="11" opacity="0.8"/>' for d in spec["axes"])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}" role="img" aria-label="{name}">
  <defs>
    <clipPath id="c{uid}"><rect x="0" y="0" width="{S}" height="{S}" rx="{R}"/></clipPath>
{chr(10).join(clips)}
  </defs>
  <g clip-path="url(#c{uid})">
    <rect x="0" y="0" width="{S}" height="{S}" fill="{PATH}"/>
{dashes}
{chr(10).join(blocks)}
  </g>
  <rect x="1.4" y="1.4" width="{S - 2.8}" height="{S - 2.8}" rx="{R - 1}" fill="none" stroke="{INK}" stroke-width="2.8"/>
</svg>
'''


for name, spec in TILES.items():
    open(f"{name}.svg", "w").write(svg(name, spec))

gap = 30
total = 3 * S + 2 * gap
parts = [f'<g transform="translate({i * (S + gap)},0)">'
         + svg(n, s, uid=str(i)).split("\n", 1)[1].rsplit("</svg>", 1)[0] + "</g>"
         for i, (n, s) in enumerate(TILES.items())]
open("preview.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 {total + 32} {S + 32}" '
    f'width="{total + 32}" height="{S + 32}">'
    f'<rect x="-16" y="-16" width="{total + 32}" height="{S + 32}" fill="#F7F4EE"/>' + "".join(parts) + "</svg>")
print("ok")
