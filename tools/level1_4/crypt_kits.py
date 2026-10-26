#!/usr/bin/env python3
"""Levels 1-4 — four crypts, four architectural languages. Kit art.

The four opening levels share a renderer with Levels 5-10 but had nothing else: they
were dressed by one generic facade plus a palette triple, so the Ossuary Fork and the
Crossfire Archive were the same room in two tints. This module gives each of them its
own kit - its own stone, its own masonry vocabulary and its own props - chosen from
what the level actually *is*:

* **L1, the Sealing Crypt** (`crypt`) - the chapter's threshold. Cold blue-grey
  limestone, a columbarium of small arched loculi, iron-bound doors, sarcophagi,
  grave goods, the worn threshold. Everything is formal and closed.
* **L2, the White Bone Fork** (`ossuary`) - a charnel junction. Chalk and bone: walls
  coursed from stacked femurs with skulls at the joints, banks of skulls, hanging
  bone chandeliers, a great bone arch over the fork.
* **L3, the Crossfire Archive** (`archive`) - a scriptorium that has been shot
  through. Warm sandstone gone sooty, iron grilles over the shelves, lecterns,
  scroll racks, iron chandeliers, brazier coals, and arrow-scarred wall.
* **L4, the Spiral Reliquary** (`spiral`) - a helical procession around one relic.
  Aged ivory, bronze and deep green serpentine; an inlaid spiral in the floor, a
  stepped shrine plinth, hanging reliquary lamps, bronze doors.

Every kit provides the base frame names the renderer always asks for (BASE_TILES), so
`crucible_art.gd` can draw any of the four without knowing which one it has.

Run: python3 tools/level1_4/crypt_kits.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, T, _h01, block, courses, dither, finish, flag_quadrant, frame_box, glow,
    hline, mix, new, px, rect, rock_tile, shade, shadow_tile, vline,
    wall_cap_tile, wall_cornice_tile, wall_field_tile, wall_plinth_tile, write_kit,
)

ART_ROOT = os.path.join(ROOT, "assets", "environment", "chapter1")


# ---------------------------------------------------------------------------
# palettes
# ---------------------------------------------------------------------------
PALETTES = {
    # Cold, damp, closed. The threshold of the chapter: nothing here is warm except
    # the candle the player carries past it.
    "crypt": {
        "stone_dark": (62, 68, 78),
        "stone": (104, 112, 122),
        "stone_light": (144, 152, 160),
        "stone_pale": (182, 190, 196),
        "mortar": (44, 48, 56),
        "rock_dark": (46, 50, 58),
        "rock": (66, 72, 82),
        "rock_light": (90, 98, 108),
        "iron_dark": (28, 30, 34),
        "iron": (52, 56, 62),
        "iron_light": (88, 94, 102),
        "accent": (196, 176, 126),      # candle brass
        "accent_light": (240, 214, 150),
        "bone": (206, 200, 184),
        "bone_dark": (154, 148, 132),
        "cloth": (74, 58, 92),          # violet mourning cloth
        "cloth_light": (108, 86, 130),
    },
    # Chalk and bone. The coldest room in the chapter, and the whitest.
    "ossuary": {
        "stone_dark": (128, 122, 110),
        "stone": (170, 164, 150),
        "stone_light": (204, 198, 184),
        "stone_pale": (228, 224, 210),
        "mortar": (96, 90, 80),
        "rock_dark": (86, 82, 74),
        "rock": (108, 104, 94),
        "rock_light": (132, 128, 116),
        "iron_dark": (42, 38, 34),
        "iron": (68, 62, 54),
        "iron_light": (100, 94, 84),
        "accent": (168, 122, 62),       # old bronze fittings
        "accent_light": (216, 172, 100),
        "bone": (232, 228, 210),
        "bone_dark": (186, 180, 160),
        "cloth": (86, 34, 34),
        "cloth_light": (126, 56, 48),
    },
    # Warm sandstone buried under soot, and a lot of iron.
    "archive": {
        "stone_dark": (110, 84, 58),
        "stone": (152, 120, 84),
        "stone_light": (184, 152, 112),
        "stone_pale": (210, 182, 142),
        "mortar": (70, 54, 38),
        "rock_dark": (66, 50, 36),
        "rock": (88, 68, 48),
        "rock_light": (112, 88, 62),
        "iron_dark": (34, 30, 26),
        "iron": (58, 52, 44),
        "iron_light": (92, 84, 70),
        "accent": (150, 108, 52),
        "accent_light": (206, 158, 84),
        "paper": (206, 190, 152),
        "paper_dark": (164, 146, 108),
        "cloth": (58, 46, 34),
        "cloth_light": (86, 68, 48),
        "soot": (40, 32, 26),
        "ember": (196, 92, 40),
        "ember_light": (236, 148, 66),
    },
    # Aged ivory, bronze and a green so dark it reads as black until it is lit.
    "spiral": {
        "stone_dark": (98, 96, 82),
        "stone": (140, 138, 118),
        "stone_light": (176, 174, 152),
        "stone_pale": (206, 204, 182),
        "mortar": (62, 62, 54),
        "rock_dark": (54, 56, 50),
        "rock": (74, 78, 68),
        "rock_light": (96, 100, 88),
        "iron_dark": (30, 32, 30),
        "iron": (52, 56, 52),
        "iron_light": (84, 90, 84),
        "accent": (150, 118, 62),       # bronze
        "accent_light": (214, 176, 104),
        "jade": (52, 78, 66),
        "jade_light": (78, 112, 92),
        "cloth": (58, 62, 54),
        "cloth_light": (88, 94, 78),
    },
}


# ---------------------------------------------------------------------------
# shared base tiles
# ---------------------------------------------------------------------------
def rock(seed: int, p: dict):
    return rock_tile(seed, p["rock_dark"], p["rock"], p["rock_light"])


def flag(p: dict, seed: int, quad: int, *, tone: float = 1.0, joint=None):
    """One quadrant of a 32 px flagstone, laid with clustered grain.

    kitlib's flag adds a per-pixel highlight at about one pixel in a hundred, which
    on a pale stone reads as confetti scattered over the floor: the eye finds the
    speckle before it finds the slabs. The joints are the same, the value is the
    same; the grain is drawn in two-pixel patches instead, which is how a sawn stone
    actually weathers.
    """
    base = shade(p["stone"], tone)
    mortar = joint or p["mortar"]
    img = new(T, T)
    rect(img, 0, 0, T, T, base)
    # The grain is *smooth*, and that is a correction. It used to be a flat tone per
    # 2x2 block, and on a pale stone a five-percent step between adjacent blocks is
    # plainly visible once the camera doubles the sprite: the floor of the Ossuary
    # read as a mosaic of soft grey squares, which is the loudest possible way to say
    # "generated". Stone mottles continuously, so the value is now read from a coarse
    # lattice of hash values and bilinearly interpolated, with a fine dither of one
    # or two units on top.
    step = 4
    nodes = T // step + 1

    def lattice(ix, iy):
        return _h01(seed, ix % nodes, iy % nodes, 11)

    for y in range(T):
        gy, fy = divmod(y, step)
        for x in range(T):
            gx, fx = divmod(x, step)
            tx, ty = fx / float(step), fy / float(step)
            a = lattice(gx, gy) * (1 - tx) + lattice(gx + 1, gy) * tx
            b = lattice(gx, gy + 1) * (1 - tx) + lattice(gx + 1, gy + 1) * tx
            value = a * (1 - ty) + b * ty
            grain = (value - 0.5) * 0.075
            grain += (_h01(seed, x, y, 13) - 0.5) * 0.022
            if abs(grain) > 0.004:
                px(img, x, y, shade(base, 1.0 + grain))
    # a single vein or fault, sometimes
    if _h01(seed, quad, 5) < 0.35:
        vein = mix(base, p["stone_dark"], 0.35)
        vx = 3 + int(_h01(seed, quad, 1, 3) * (T - 6))
        for y in range(1, T - 1):
            px(img, vx, y, vein)
            if _h01(seed, quad, 1, y) > 0.78:
                vx = max(1, min(T - 2, vx + (1 if _h01(seed, quad, 2, y) > 0.5 else -1)))
    # the joints: outside edges of the flag only, so a 32 px rhythm
    if quad == 0:
        vline(img, 0, 0, T, mortar)
        vline(img, 1, 0, T, shade(base, 0.90))
        hline(img, 0, 0, T, mortar)
        hline(img, 0, 1, T, shade(base, 0.90))
    elif quad == 3:
        vline(img, T - 1, 0, T, shade(base, 0.87))
        hline(img, 0, T - 1, T, shade(base, 0.87))
    elif quad == 1:
        vline(img, T - 1, 0, T, shade(base, 0.94))
    else:
        hline(img, 0, T - 1, T, shade(base, 0.94))
    # a chipped arris, occasionally
    if _h01(seed, quad, 9) < 0.12:
        for i in range(2 + int(_h01(seed, quad, 10) * 3)):
            px(img, T - 2 - i, 2, shade(base, 0.72))
    return img


def worn(p: dict, seed: int):
    """A slab that feet have darkened, and dirt gathered in its joints.

    The darkening used to be a 24% single-pixel dither, which at gameplay zoom is a
    spray of dark specks over the paving - "grit" only if you are looking at one
    pixel at a time. Traffic wears a path and grime collects at the edges, so both
    are drawn as regions: a cool wash over the slab and a shadow in the joint.
    """
    img = flag(p, seed, 2, tone=0.90)
    grime = shade(p["stone_dark"], 1.05)
    for y in range(T):
        for x in range(T):
            # a soft wash, densest toward the joints and toward the south-east corner
            edge = min(x, y, T - 1 - x, T - 1 - y)
            wash = max(0.0, (3.5 - edge) / 3.5) * 0.55 + 0.15
            wash *= 0.6 + 0.4 * _h01(seed + 1, x // 3, y // 3)
            if wash > 0.18:
                px(img, x, y, mix(p["stone"], grime, min(0.55, wash)))
    return img


def broken(p: dict, seed: int):
    img = flag(p, seed, 1, tone=0.94)
    # one diagonal fracture through the slab, and a chipped corner
    for i in range(T):
        px(img, i, (i * 3 // 4 + 2) % T, p["stone_dark"])
        px(img, i, (i * 3 // 4 + 3) % T, shade(p["stone_dark"], 1.12))
    for y in range(0, 4):
        for x in range(0, 4 - y):
            px(img, x, y, (0, 0, 0, 0))
    return img


def base_tiles(p: dict, *, floor_extra=None, wall=None) -> list:
    tiles = [("bedrock_a", lambda: rock(7, p)), ("bedrock_b", lambda: rock(13, p))]
    # Eight paving variants, not four. Four quadrants of one flag is exactly right for
    # the *joint* rhythm, but it is also only four pixels of variation across a
    # thirty-row room: the eye finds the repeat in two cells and the hall becomes
    # wallpaper whatever is standing on it. The extra four are the same quadrants at
    # a different tone and with a different grain seed, so the joint rhythm is
    # untouched and the repeat no longer lands on a two-cell period.
    # The tone spread is deliberately tiny. It was five to eight percent, and the
    # renderer picks the variant from the cell's parity, so a room's floor came out as
    # a checkerboard of 16 px squares in two greys - the single most generated-looking
    # thing in the frame. Variation belongs in the *grain* (a different seed per
    # variant), not in the value: a flagstone floor is one material.
    variants = ((29, 1.00), (33, 0.985), (35, 1.010), (39, 0.995),
                (41, 1.005), (43, 0.990), (45, 1.000), (47, 0.995))
    for index, (seed, tone) in enumerate(variants):
        name = "floor_%s" % "abcdefgh"[index]
        tiles.append((name, lambda sd=seed, tn=tone, q=index % 4: flag(p, sd, q, tone=tn)))
    tiles.append(("floor_worn", lambda: worn(p, 31)))
    tiles.append(("floor_broken", lambda: broken(p, 37)))
    tiles.append(("shadow_edge", lambda: shadow_tile(96)))
    # The wall mass sits a full step *below* the paving, not on top of it. These
    # four levels were originally dressed with a wall base within two percent of the
    # floor's own value, and at gameplay zoom that is one continuous field of stone
    # from wall to wall with no plane a viewer can tell from another - the same
    # contrast fault the Reliquary had. The socle is darker still and only the pier
    # stays pale, so the vertical surfaces read as vertical.
    # The wall vocabulary is per kit, and it is the *base* material rather than an
    # overlay. These levels' maps are one cell thick, so the only authored wall cell
    # is the bottom course and everything above it is the renderer's own storey; a
    # document that named a frame on every face cell therefore painted the same
    # motif along the entire wall, which is a stamped pattern and nothing else. The
    # level's language lives in these five frames instead, and the document keeps
    # only its specials.
    vocab = wall or {}
    tiles.append(("wall_plinth", vocab.get("plinth",
        lambda: wall_plinth_tile(shade(p["stone"], 0.74), p["iron"]))))
    tiles.append(("wall_field_a", vocab.get("field_a",
        lambda: wall_field_tile(41, shade(p["stone"], 0.88), p["mortar"]))))
    tiles.append(("wall_field_b", vocab.get("field_b",
        lambda: wall_field_tile(43, shade(p["stone"], 0.78), p["mortar"]))))
    tiles.append(("wall_dado_a", vocab.get("dado",
        lambda: wall_field_tile(47, shade(p["stone"], 0.96), p["mortar"], dado=True))))
    tiles.append(("wall_pier", vocab.get("pier",
        lambda: wall_field_tile(53, shade(p["stone_light"], 0.98), p["mortar"], pier=True))))
    tiles.append(("wall_cornice", vocab.get("cornice",
        lambda: wall_cornice_tile(shade(p["accent"], 0.9), p["stone"]))))
    tiles.append(("wall_cap", vocab.get("cap",
        lambda: wall_cap_tile(shade(p["stone_pale"], 0.90), p["stone"]))))
    if floor_extra:
        tiles.extend(floor_extra)
    return tiles


# ---------------------------------------------------------------------------
# Level 1 - the Sealing Crypt
# ---------------------------------------------------------------------------
def crypt_loculus_band(p: dict):
    """A columbarium course: three small arched recesses with a shelf of urns.

    The Sealing Crypt's long galleries are lined with these. It has to read as a
    *grid of openings* at gameplay scale, so each recess is a dark five-pixel arch
    with a lit arris, and the course between them is plain ashlar.
    """
    img = new(T, T)
    body = shade(p["stone"], 0.94)
    rect(img, 0, 0, T, T, body)
    courses(img, 0, 0, T, T, body, row_h=T, seed=71, mortar=p["mortar"])
    for i, x0 in enumerate((2, 10)):
        if x0 + 5 > T:
            continue
        rect(img, x0, 3, 5, 10, p["mortar"])
        rect(img, x0 + 1, 4, 3, 8, (16, 18, 22))
        px(img, x0 + 2, 3, p["mortar"])
        px(img, x0 + 1, 3, shade(body, 1.18))
        vline(img, x0 - 1, 3, 10, shade(body, 1.26))
        vline(img, x0 + 5, 3, 10, shade(body, 0.74))
        hline(img, x0 - 1, 13, 7, shade(body, 1.16))
        hline(img, x0 - 1, 14, 7, shade(body, 0.62))
        # a small urn on the shelf, catching a little candle light
        px(img, x0 + 2, 11, p["bone"])
        px(img, x0 + 2, 12, p["bone_dark"])
    return img


def crypt_threshold_band(p: dict, seed: int = 0):
    """A worn sill course: the stone under every doorway, rounded by feet."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(p["stone"], 1.06))
    courses(img, 0, 0, T, T, shade(p["stone"], 1.06), row_h=T, seed=73, mortar=p["mortar"])
    for y in range(3, 13):
        t = 1.0 - abs(y - 8) / 5.0
        hline(img, 1, y, T - 2, shade(p["stone"], 1.06 - 0.05 * (1 - t)))
    hline(img, 0, 2, T, shade(p["stone_pale"], 0.96))
    hline(img, 0, 13, T, shade(p["stone_dark"], 0.86))
    for x in range(2, T, 4):
        px(img, x, 7 + (x % 3), p["stone_dark"])
    return img


def crypt_vault_band(p: dict):
    """A blind arcade: the wall above a gallery, two round-headed arches per cell."""
    img = new(T, T)
    body = shade(p["stone"], 0.88)
    rect(img, 0, 0, T, T, body)
    courses(img, 0, 0, T, T, body, row_h=T, seed=77, mortar=p["mortar"])
    for cx in (4, 12):
        for y in range(2, 15):
            half = int(4.5 * math.sqrt(max(0.0, 1.0 - ((9 - y) / 7.0) ** 2)))
            if half <= 0:
                continue
            vline(img, cx - half, y, 1, shade(body, 1.22))
            vline(img, cx + half, y, 1, shade(body, 0.66))
        for y in range(2, 15):
            half = int(4.5 * math.sqrt(max(0.0, 1.0 - ((9 - y) / 7.0) ** 2)))
            if half <= 0:
                continue
            px(img, cx, y, shade(body, 0.84) if y % 3 else shade(body, 1.06))
    vline(img, 0, 0, T, shade(body, 1.24))
    vline(img, T - 1, 0, T, shade(body, 0.62))
    return img


def crypt_floor_aisle(p: dict, side: str, seed: int = 3):
    """Half the processional strip: a dressed slab, a kerb on the outside edge.

    One frame used on both columns of the aisle drew two parallel pale lines down a
    hall, which reads as a painted marking, not as a floor. The strip is two frames -
    the west half carries the kerb on its west edge, the east half on its east - so
    the aisle is one dressed band with a raised edge either side of it, and a bronze
    inlay down the joint between the halves.
    """
    img = flag(p, seed, 0, tone=1.12)
    # the strip is a different stone from the galleries: dressed and warmed, so the
    # processional way is visible from the doorway without being a painted line
    dressed = mix(p["stone"], p["accent"], 0.16)
    rect(img, 0, 0, T, T, dressed)
    for y in range(T):
        for x in range(T):
            h = _h01(seed + 2, x // 2, y // 2)
            if h > 0.90:
                px(img, x, y, shade(dressed, 1.06))
            elif h < 0.10:
                px(img, x, y, shade(dressed, 0.95))
    # Cross joints, so it reads as laid slabs rather than as a painted stripe. They
    # run *across* the strip, so they turn with it: a horizontal passage needs the
    # joints standing up, not lying down.
    if side in ("w", "e"):
        for y in (0, 8):
            hline(img, 0, y, T, shade(dressed, 0.80))
            hline(img, 0, y + 1, T, shade(dressed, 1.06))
    else:
        for x in (0, 8):
            vline(img, x, 0, T, shade(dressed, 0.80))
            vline(img, x + 1, 0, T, shade(dressed, 1.06))
    # The kerb sits on the strip's *outside* edge and the bronze inlay on its inside
    # one, which is the joint it shares with the other half of the strip. That is why
    # the frame comes in four sides rather than two: the crossing at Level 1's shaft
    # runs east-west, and laying the north-south halves across it turned the kerb into
    # a row of railings perpendicular to the passage.
    if side == "w":
        vline(img, 0, 0, T, p["stone_dark"])
        vline(img, 1, 0, T, p["stone_pale"])
        vline(img, T - 1, 0, T, p["accent"])
    elif side == "e":
        vline(img, T - 1, 0, T, p["stone_dark"])
        vline(img, T - 2, 0, T, p["stone_pale"])
        vline(img, 0, 0, T, p["accent"])
    elif side == "n":
        hline(img, 0, 0, T, p["stone_dark"])
        hline(img, 0, 1, T, p["stone_pale"])
        hline(img, 0, T - 1, T, p["accent"])
    else:
        hline(img, 0, T - 1, T, p["stone_dark"])
        hline(img, 0, T - 2, T, p["stone_pale"])
        hline(img, 0, 0, T, p["accent"])
    return img


def crypt_threshold_floor(p: dict, seed: int = 4):
    """The sill of a doorway: a worn dressed course, wider than the aisle."""
    img = flag(p, seed, 0, tone=1.04)
    hline(img, 0, 3, T, p["stone_pale"])
    hline(img, 0, 4, T, shade(p["stone"], 0.86))
    hline(img, 0, T - 5, T, shade(p["stone"], 0.90))
    for x in range(1, T, 5):
        px(img, x, 8, p["stone_dark"])
        px(img, x, 9, shade(p["stone"], 0.88))
    return img


# --- L1 props ---------------------------------------------------------------
def crypt_sarcophagus(p: dict):
    """A lid-on tomb chest: moulded plinth, panelled side, a carved gisant relief."""
    w, h = 64, 48
    img = new(w, h)
    # The chest is a full step under the paving and the lid a step over it. Built in
    # one value the tomb was invisible against the floor it stands on.
    body = shade(p["stone_dark"], 1.16)
    rect(img, 4, 34, w - 8, 4, shade(body, 0.72))
    rect(img, 5, 36, w - 10, 8, shade(body, 0.58))
    # chest
    block(img, 4, 16, w - 8, 20, body, bevel=1)
    for x0 in range(8, w - 10, 12):
        rect(img, x0, 20, 8, 12, shade(body, 0.84))
        frame_box(img, x0, 20, 8, 12, shade(body, 1.14))
        rect(img, x0 + 2, 23, 4, 6, shade(body, 0.70))
    # lid, slightly proud, with a carved figure in relief
    block(img, 2, 10, w - 4, 8, shade(body, 1.12), bevel=1)
    hline(img, 2, 10, w - 4, p["stone_pale"])
    rect(img, 14, 12, w - 28, 4, shade(body, 1.24))
    # gisant: head, shoulders, folded hands, feet
    px(img, 20, 13, p["stone_pale"])
    rect(img, 21, 13, 5, 2, p["stone_pale"])
    rect(img, 26, 12, 12, 3, shade(body, 1.30))
    rect(img, 38, 13, 8, 2, shade(body, 1.18))
    rect(img, 46, 12, 4, 3, p["stone_pale"])
    hline(img, 2, 17, w - 4, shade(body, 0.64))
    return finish(img)


def crypt_sarcophagus_worn(p: dict) -> "Image.Image":
    """A plainer tomb: a lid with a cross cut into it, weathered, and chipped.

    Nine gisants in a row is a stamped pattern however well the figure is carved.
    This is the same chest in a cheaper stone - no effigy, a cut cross and an
    inscription band - and a corner knocked off, so a rank of tombs reads as a rank
    of tombs rather than as one sprite repeated.
    """
    w, h = 58, 46
    img = new(w, h)
    body = shade(p["stone"], 0.94)          # a cheaper stone than the effigy chests
    rect(img, 3, 32, w - 6, 4, shade(body, 0.74))
    rect(img, 4, 34, w - 8, 8, shade(body, 0.60))
    block(img, 3, 15, w - 6, 19, body, bevel=1)
    # two panels, not four: a plain lid goes with a plain chest
    for x0 in (7, w // 2 + 2):
        rect(img, x0, 19, w // 2 - 12, 11, shade(body, 0.86))
        frame_box(img, x0, 19, w // 2 - 12, 11, shade(body, 1.12))
    # the lid: a cut cross and a band of lettering below it
    block(img, 2, 9, w - 4, 8, shade(body, 1.10), bevel=1)
    hline(img, 2, 9, w - 4, shade(p["stone_pale"], 0.94))
    cx = w // 2 - 1
    vline(img, cx, 10, 4, shade(body, 0.56))
    hline(img, cx - 4, 12, 9, shade(body, 0.56))
    for x in range(6, w - 6, 3):
        px(img, x, 15, shade(body, 0.70))
    # weathering: a few pale lichen spots and a chipped corner
    for i, (x, y) in enumerate(((9, 36), (w - 12, 24), (16, 21), (w - 18, 37))):
        px(img, x, y, mix(body, p["stone_pale"], 0.55))
        px(img, x + 1, y, mix(body, p["stone_pale"], 0.35))
    for y in range(h - 6, h):
        for x in range(w - 7, w - 1):
            if (x + y) % 3:
                px(img, x, y, (0, 0, 0, 0))
    hline(img, 2, 16, w - 4, shade(body, 0.66))
    return finish(img)


def crypt_sarcophagus_pair(p: dict) -> "Image.Image":
    """Two small chests end to end in one slot: a family tomb, not a single burial.

    The rank reads as furniture because every occupant is the same size. Splitting
    one slot into two smaller chests changes the rhythm of the rank without changing
    the floor it occupies.
    """
    w, h = 64, 44
    img = new(w, h)
    body = shade(p["stone_dark"], 1.12)
    for index, (x0, cw) in enumerate(((2, 28), (34, 28))):
        tone = shade(body, 1.0 if index == 0 else 0.94)
        rect(img, x0, 30, cw, 3, shade(tone, 0.74))
        rect(img, x0 + 1, 32, cw - 2, 7, shade(tone, 0.60))
        block(img, x0, 16, cw, 16, tone, bevel=1)
        rect(img, x0 + 4, 20, cw - 8, 8, shade(tone, 0.84))
        frame_box(img, x0 + 4, 20, cw - 8, 8, shade(tone, 1.12))
        # a small lid, one with a cross, one with a plain panel
        block(img, x0, 11, cw, 6, shade(tone, 1.10), bevel=1)
        hline(img, x0, 11, cw, shade(p["stone_pale"], 0.92))
        if index == 0:
            vline(img, x0 + cw // 2, 12, 3, shade(tone, 0.56))
            hline(img, x0 + cw // 2 - 3, 13, 7, shade(tone, 0.56))
        else:
            rect(img, x0 + 6, 13, cw - 12, 2, shade(tone, 0.72))
        hline(img, x0, 22, cw, shade(tone, 0.92))
    # the gap between them is shadow, not floor
    vline(img, 31, 12, 25, (18, 19, 22))
    vline(img, 32, 12, 25, (30, 32, 36))
    return finish(img)


def crypt_sarcophagus_open(p: dict):
    """A chest with its lid levered off and leaning on the end: the chamber was opened.

    One open tomb among the closed ones is worth more than a third lid variant - it
    changes what the player thinks the room is for - but it has to be built as an
    open box, not as a closed one with a piece cut out of it. The interior is a dark
    tub with a pale inner lip, and the lid stands on its edge against the foot end.
    """
    w, h = 64, 48
    img = new(w, h)
    body = shade(p["stone_dark"], 1.16)
    rect(img, 4, 34, w - 8, 4, shade(body, 0.72))
    rect(img, 5, 36, w - 10, 8, shade(body, 0.58))
    block(img, 4, 16, w - 8, 20, body, bevel=1)
    for x0 in range(8, w - 10, 12):
        rect(img, x0, 20, 8, 12, shade(body, 0.84))
        frame_box(img, x0, 20, 8, 12, shade(body, 1.14))
    # the open tub: pale lip, dark inside, a little dust left in the bottom
    rect(img, 4, 10, w - 8, 7, shade(body, 1.06))
    hline(img, 4, 10, w - 8, p["stone_pale"])
    rect(img, 7, 12, w - 26, 4, (14, 15, 18))
    rect(img, 7, 14, w - 26, 2, (30, 32, 36))
    for x in range(9, w - 20, 4):
        px(img, x, 13, (140, 136, 126))
    # the lid, standing on its edge at the foot: a slab seen almost edge-on
    lid_x = w - 17
    block(img, lid_x, 8, 13, 28, shade(body, 1.12), bevel=1)
    hline(img, lid_x, 8, 13, p["stone_pale"])
    for y in range(12, 34, 5):
        hline(img, lid_x + 1, y, 11, shade(body, 0.92))
    for i in range(3):
        px(img, lid_x + 2 + i * 4, 11, shade(body, 1.26))
    hline(img, 2, 17, w - 4, shade(body, 0.64))
    return finish(img)


def crypt_door(p: dict, *, ajar: bool = False):
    """An iron-bound door in a stone surround: the sealed way out of a gallery."""
    w, h = 40, 62
    img = new(w, h)
    stone = shade(p["stone"], 1.02)
    block(img, 0, 4, 8, h - 4, stone)
    block(img, w - 8, 4, 8, h - 4, stone)
    block(img, 0, 0, w, 8, shade(stone, 1.10))
    hline(img, 0, 0, w, p["stone_pale"])
    # the leaf
    leaf_x, leaf_w = 8, w - 16
    rect(img, leaf_x, 8, leaf_w, h - 8, p["cloth"])
    for x in range(leaf_x + 2, leaf_x + leaf_w - 2, 6):
        vline(img, x, 8, h - 8, shade(p["cloth"], 0.86))
        vline(img, x + 1, 8, h - 8, shade(p["cloth_light"], 1.10))
    for y in (16, 34, 52):
        hline(img, leaf_x, y, leaf_w, p["iron"])
        hline(img, leaf_x, y + 1, leaf_w, p["iron_light"])
        for x in range(leaf_x + 2, leaf_x + leaf_w, 5):
            px(img, x, y, p["iron_dark"])
    # ring handle and a chalk ward mark
    px(img, leaf_x + leaf_w - 5, 34, p["accent"])
    px(img, leaf_x + leaf_w - 5, 35, p["accent_light"])
    arc_like = [(0, -2), (1, -1), (1, 0), (0, 1), (-1, 0), (-1, -1)]
    for dx, dy in arc_like:
        px(img, 14 + dx, 24 + dy, p["bone"])
    if ajar:
        rect(img, leaf_x, 8, 3, h - 8, (10, 11, 14))
    return finish(img)


def crypt_loculus_tall(p: dict):
    """A standing loculus: three stacked burial recesses in a stone frame."""
    w, h = 34, 88
    img = new(w, h)
    frame = shade(p["stone"], 1.04)
    block(img, 0, 0, w, h, frame)
    rect(img, 4, 4, w - 8, h - 10, shade(frame, 0.86))
    for i in range(3):
        y0 = 8 + i * 25
        rect(img, 7, y0, w - 14, 19, p["mortar"])
        for y in range(y0 + 2, y0 + 19):
            half = int(9 * math.sqrt(max(0.0, 1.0 - ((y0 + 2 - y) / 11.0) ** 2)))
            if half <= 0:
                continue
        rect(img, 9, y0 + 3, w - 18, 15, (14, 16, 20))
        vline(img, 7, y0, 20, shade(frame, 1.28))
        vline(img, w - 8, y0, 20, shade(frame, 0.62))
        hline(img, 6, y0 + 20, w - 12, shade(frame, 1.20))
        hline(img, 6, y0 + 21, w - 12, shade(frame, 0.60))
        # a skull and long bone on each shelf
        px(img, 13, y0 + 16, p["bone"])
        px(img, 14, y0 + 16, p["bone"])
        px(img, 14, y0 + 17, p["bone_dark"])
        hline(img, 16, y0 + 17, 5, p["bone_dark"])
    hline(img, 0, 0, w, p["stone_pale"])
    return finish(img)


def crypt_candelabrum(p: dict):
    """A floor candelabrum: three candles on an iron stem, in a stone socket."""
    w, h = 26, 58
    img = new(w, h)
    cx = w // 2
    block(img, cx - 7, h - 12, 14, 12, shade(p["stone"], 0.92))
    hline(img, cx - 7, h - 12, 14, p["stone_pale"])
    vline(img, cx - 1, h - 34, 22, p["iron_light"])
    vline(img, cx, h - 34, 22, p["iron"])
    hline(img, cx - 9, h - 34, 18, p["iron"])
    hline(img, cx - 9, h - 33, 18, p["iron_light"])
    for x in (cx - 8, cx, cx + 8):
        vline(img, x, h - 44, 10, p["accent"])
        px(img, x, h - 45, p["accent_light"])
        # flame
        px(img, x, h - 48, p["accent_light"])
        px(img, x, h - 49, (255, 236, 190))
        px(img, x, h - 47, p["accent"])
        glow(img, x, h - 48, 5, 7, p["accent_light"], 90, steps=3)
    return finish(img, shadow=False)


def crypt_grave_goods(p: dict, *, urn: bool = True):
    """A low shelf of grave goods: an urn, a wreath, a folded cloth."""
    w, h = 30, 24
    img = new(w, h)
    block(img, 1, h - 8, w - 2, 8, shade(p["stone"], 0.90))
    hline(img, 1, h - 8, w - 2, p["stone_pale"])
    if urn:
        rect(img, 6, 6, 7, 9, shade(p["stone_light"], 0.96))
        rect(img, 7, 4, 5, 3, p["stone_pale"])
        px(img, 9, 3, p["stone_pale"])
        vline(img, 6, 8, 6, p["stone_pale"])
        hline(img, 5, 10, 9, p["accent"])
    # wreath: a ring of leaves
    for i in range(10):
        a = i / 10 * math.pi * 2
        px(img, int(21 + math.cos(a) * 4), int(12 + math.sin(a) * 3), p["cloth_light"])
        px(img, int(21 + math.cos(a) * 4) + 1, int(12 + math.sin(a) * 3), p["cloth"])
    return finish(img)


def crypt_hanging_lamp(p: dict):
    """An iron corona hanging from a chain. Height comes from the chain."""
    # Six rows of chain, so a lamp hung from a wall band actually reaches it. A chain
    # that stops in mid-air is the most obvious "unfinished" tell there is.
    w, h = 28, 104
    img = new(w, h)
    cx = w // 2
    for link in range(0, 68, 4):
        vline(img, cx - 1, link, 2, p["iron"])
        vline(img, cx, link, 2, p["iron_light"])
        hline(img, cx - 1, link, 2, p["iron_light"])
    # corona ring
    for i in range(24):
        a = math.pi + i / 24 * math.pi
        x = int(cx + math.cos(a) * 11)
        y = int(76 + math.sin(a) * 5)
        px(img, x, y, p["iron"])
        px(img, x, y + 1, p["iron_light"])
    # the corona: a bar of six iron cups, each with a candle and a flame
    hline(img, cx - 13, 70, 27, p["iron"])
    hline(img, cx - 13, 71, 27, p["iron_light"])
    for x in range(cx - 12, cx + 13, 4):
        vline(img, x, 72, 5, p["accent"])
        vline(img, x + 1, 72, 5, p["iron_dark"])
        rect(img, x - 1, 76, 4, 2, p["iron"])
        px(img, x, 69, (255, 244, 208))
        px(img, x, 68, (255, 220, 150))
        glow(img, x, 70, 6, 8, p["accent_light"], 110, steps=3)
    # chain finial, and the ring the chain is hung from
    rect(img, cx - 3, 0, 6, 3, p["iron_light"])
    hline(img, cx - 5, 1, 11, p["iron"])
    rect(img, cx - 1, 0, 2, 2, (12, 12, 14))
    return finish(img, shadow=False)


def crypt_bier(p: dict):
    """A low bier: a stone trestle where the dead waited."""
    w, h = 46, 22
    img = new(w, h)
    block(img, 2, 6, w - 4, 6, shade(p["stone"], 1.02))
    hline(img, 2, 6, w - 4, p["stone_pale"])
    hline(img, 2, 11, w - 4, shade(p["stone"], 0.66))
    for x in (5, w - 11):
        block(img, x, 12, 6, 8, shade(p["stone"], 0.84))
    # shroud left on it
    rect(img, 10, 4, w - 22, 4, mix(p["cloth"], p["bone"], 0.35))
    hline(img, 10, 3, w - 22, shade(p["cloth_light"], 0.9))
    return finish(img)


# ---------------------------------------------------------------------------
# Level 2 - the White Bone Fork
# ---------------------------------------------------------------------------
def skull(img, x0: int, y0: int, p: dict, *, tone: float = 1.0, sockets=True) -> None:
    """A skull in a ten-by-nine box: cranium, brow, two sockets, nasal, jaw teeth.

    Drawn once and used everywhere the ossuary has a skull, because a hand-copied
    skull per prop is how a kit ends up with four subtly different skulls. At this
    size the read comes from three things only - the round cranium, the two deep
    sockets, and the tooth row along the bottom - so those are the only features it
    spends pixels on.
    """
    bone = shade(p["bone"], tone)
    light = shade(bone, 1.10)
    dark = shade(bone, 0.74)
    # cranium: rounded top, straight sides
    for i, half in enumerate((3, 4, 4, 4, 4, 4, 3)):
        rect(img, x0 + 5 - half, y0 + i, half * 2, 1, bone)
        px(img, x0 + 5 - half, y0 + i, light)
        px(img, x0 + 4 + half, y0 + i, dark)
    # brow and sockets
    hline(img, x0 + 3, y0 + 3, 5, shade(bone, 0.86))
    if sockets:
        rect(img, x0 + 3, y0 + 4, 3, 2, (18, 17, 16))
        rect(img, x0 + 6, y0 + 4, 3, 2, (18, 17, 16))
    # nasal and jaw
    px(img, x0 + 5, y0 + 5, (22, 21, 20))
    px(img, x0 + 4, y0 + 6, (22, 21, 20))
    px(img, x0 + 5, y0 + 6, (22, 21, 20))
    hline(img, x0 + 3, y0 + 7, 5, shade(bone, 0.84))
    for i in range(3):
        px(img, x0 + 3 + i * 2, y0 + 8, shade(bone, 0.66))


def ossuary_bone_course(p: dict, seed: int = 0, *, skulls: bool = True):
    """A wall coursed from stacked long bones, with a skull at every joint.

    This is the Ossuary Fork's wall. The bones are drawn as paired rounded shafts
    with dark seams between them; the skulls sit at the quarter points, so a run of
    these tiles reads as a *bond* of bone rather than as texture.

    The skull is a *frieze*, not a texture, and that is why `skulls` exists. Stamped
    into every course of every wall it was a repeating motif over the whole storey -
    the renderer paints `field_a` on the second course and `field_b` above it - so
    the level's walls read as wallpaper made of identical faces. The kit now gives
    the skull to the framed course only and leaves the courses above it plain bone,
    which is how a charnel wall is actually built: a frieze at eye height over plain
    coursing.
    """
    img = new(T, T)
    base = shade(p["stone"], 0.88)
    rect(img, 0, 0, T, T, base)
    for row, y0 in enumerate((1, 9)):
        offset = 0 if row == 0 else 4
        for i in range(-1, 3):
            x0 = offset + i * 8
            shaft = mix(p["bone"], p["stone"], 0.18 if (i + row) % 2 else 0.30)
            rect(img, x0, y0, 7, 6, shaft)
            hline(img, x0, y0, 7, shade(shaft, 1.14))
            hline(img, x0, y0 + 5, 7, shade(shaft, 0.74))
            px(img, x0, y0 + 2, shade(shaft, 0.88))
            px(img, x0 + 3, y0 + 3, shade(shaft, 0.92))
            px(img, x0 + 6, y0 + 2, shade(shaft, 0.86))
        hline(img, 0, y0 + 7, T, p["mortar"])
    # a skull set into the bond - on the framed course only
    if skulls:
        skull(img, 1, 5, p, tone=1.04)
    return img


def ossuary_skull_band(p: dict):
    """A frieze of skulls over a shelf course: the ossuary's cornice."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(p["stone"], 0.80))
    hline(img, 0, 0, T, shade(p["stone"], 0.62))
    hline(img, 0, 4, T, shade(p["stone_light"], 0.9))
    for x0 in (0, 8):
        skull(img, x0, 3, p, tone=1.02)
    hline(img, 0, 13, T, shade(p["stone"], 0.62))
    return img


def ossuary_charnel_floor(p: dict, seed: int = 5):
    """Paving under a charnel: slabs dusted with bone grit and old dark stains."""
    img = flag(p, seed, 3, tone=0.98)
    for i in range(26):
        x = int(_h01(seed, i, 1) * T)
        y = int(_h01(seed, i, 2) * T)
        px(img, x, y, p["bone_dark"] if i % 3 else p["bone"])
    for i in range(3):
        cx = int(_h01(seed, i, 9) * T)
        cy = int(_h01(seed, i, 10) * T)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if abs(dx) + abs(dy) < 2:
                    px(img, cx + dx, cy + dy, mix(p["stone"], p["cloth"], 0.30))
    return img


def ossuary_procession(p: dict, seed: int = 6):
    """A pale bone-dust procession strip, marked out by pairs of vertebrae."""
    img = flag(p, seed, 2, tone=1.08)
    vline(img, 0, 0, T, p["bone_dark"])
    vline(img, T - 1, 0, T, shade(p["bone_dark"], 0.9))
    for y in range(3, T, 5):
        rect(img, 6, y, 4, 3, p["stone_pale"])
        px(img, 7, y + 1, shade(p["stone"], 0.8))
        rect(img, 6, y + 4, 4, 1, p["mortar"])
    return img


# --- L2 props ---------------------------------------------------------------
def ossuary_bone_arch(p: dict):
    """The fork's monument: a gate of bone and skulls, standing across the crossing.

    It has to read as *built* - bundles of femurs lashed to a lintel, skulls at the
    springing, a skull keystone - because the gameplay asks the player to find the
    fork and this is the only thing marking it. It is a gate the player walks past,
    not a viaduct over them: two solid plinths, a lintel above them, and the way
    through left open between the feet.
    """
    w, h = 104, 126
    img = new(w, h)
    leg_w = 30
    inner = 16            # the clear opening between the plinths
    left_x = inner
    right_x = w - inner - leg_w
    for x0 in (left_x, right_x):
        block(img, x0, h - 24, leg_w, 24, shade(p["stone"], 0.92))
        hline(img, x0, h - 24, leg_w, p["stone_pale"])
        hline(img, x0, h - 6, leg_w, shade(p["stone"], 0.58))
        # femur bundles: four lathed shafts per leg, two band of iron lashings
        for i in range(4):
            bx = x0 + 3 + i * 7
            shaft = mix(p["bone"], p["stone"], 0.08 + 0.06 * i)
            rect(img, bx, 44, 5, h - 68, shaft)
            hline(img, bx, 44, 5, shade(shaft, 1.16))
            vline(img, bx, 44, h - 68, shade(shaft, 1.06))
            vline(img, bx + 4, 44, h - 68, shade(shaft, 0.76))
            for y in range(52, h - 34, 22):
                px(img, bx + 1, y, shade(shaft, 0.84))
                px(img, bx + 3, y + 3, shade(shaft, 0.84))
        for y in (52, 86):
            hline(img, x0 + 1, y, leg_w - 2, p["iron"])
            hline(img, x0 + 1, y + 1, leg_w - 2, p["iron_light"])
            px(img, x0 + 3, y + 2, p["accent"])
            px(img, x0 + leg_w - 5, y + 2, p["accent"])
    # The arch: a true semicircle of radial bone voussoirs springing off the tops of
    # both legs, with a skull at each springing and one at the apex. A rectangular
    # lintel of bone courses read as a beige brick door frame; an arch reads as bone
    # construction at any zoom, which is the whole point of the prop.
    kx = w // 2
    spring_y = 42
    inner_r = 17
    ring = 13
    for x in range(w):
        for y in range(4, spring_y):
            dx, dy = x - kx, y - spring_y
            d = math.hypot(dx, dy)
            if not (inner_r <= d <= inner_r + ring):
                continue
            # yousssoir seams every eight degrees, radial, so the ring reads as
            # separate bones
            a = math.degrees(math.atan2(dy, dx))
            seam = (a % 12.0)
            base = mix(p["bone"], p["stone"], 0.06 + 0.05 * (int((a + 180) // 12) % 3))
            if seam < 1.1 or d > inner_r + ring - 1.2 or d < inner_r + 1.0:
                px(img, x, y, shade(base, 0.62))
            else:
                px(img, x, y, base)
                if seam < 2.4:
                    px(img, x, y, shade(base, 1.18))
                elif seam > 9.6:
                    px(img, x, y, shade(base, 0.86))
    # a stringer of iron across the springing, and the shafts' capitals under it
    hline(img, left_x - 1, spring_y, leg_w + 2, shade(p["bone"], 0.86))
    hline(img, right_x - 1, spring_y, leg_w + 2, shade(p["bone"], 0.86))
    hline(img, left_x - 1, spring_y + 1, leg_w + 2, p["iron"])
    hline(img, right_x - 1, spring_y + 1, leg_w + 2, p["iron"])
    # skulls: apex keystone and one at each springing
    def skull(sx, sy, scale=1):
        rect(img, sx - 6, sy - 5, 13, 11, p["bone"])
        hline(img, sx - 6, sy - 6, 13, p["stone_pale"])
        rect(img, sx - 4, sy - 1, 4, 5, (24, 22, 20))
        rect(img, sx + 2, sy - 1, 4, 5, (24, 22, 20))
        px(img, sx - 1, sy + 3, (24, 22, 20))
        px(img, sx + 1, sy + 3, (24, 22, 20))
        hline(img, sx - 4, sy + 5, 9, shade(p["bone_dark"], 0.84))
    skull(kx, 12)
    skull(left_x + 1, spring_y + 6)
    skull(right_x + leg_w - 2, spring_y + 6)
    glow(img, kx, 14, 22, 14, (255, 226, 168), 36, steps=3)
    return finish(img)


def ossuary_skull_bank(p: dict):
    """A bank of stacked skulls, packed face-out in rows. A low wall of the dead."""
    w, h = 48, 38
    img = new(w, h)
    for row, y0 in enumerate((24, 15, 6)):
        offset = 0 if row % 2 == 0 else 5
        for i in range(-1, 5):
            x0 = offset + i * 10
            if x0 < -6 or x0 > w:
                continue
            shade_t = 0.84 + 0.06 * row
            # set each row back into the bank a little, so the courses read as
            # packed rather than as a sticker sheet
            rect(img, x0, y0 - 1, 11, 10, shade(p["stone_dark"], 0.72))
            skull(img, x0, y0 - 1, p, tone=shade_t)
    hline(img, 0, h - 2, w, shade(p["stone"], 0.7))
    return finish(img)


def ossuary_ossuary_stack(p: dict, kind: str = "mixed"):
    """A tall stack of bones in a stone frame: the ossuary's standing furniture.

    Three kinds, because fifteen identical cases in one frame read as wallpaper. The
    `shaft` kind is packed with long bones, the `skull` kind is faced with skulls
    set into the openings, and the `mixed` kind has a shelf of each. All three are
    the same cabinet, so a row of them still reads as a set.
    """
    w, h = 36, 92
    img = new(w, h)
    frame = shade(p["stone"], 1.00)
    block(img, 0, 0, w, h, frame)
    rect(img, 4, 5, w - 8, h - 12, shade(frame, 0.72))
    for y0 in range(9, h - 12, 11):
        row = y0 // 11
        if kind == "skull" or (kind == "mixed" and row % 2 == 0):
            # a recess faced with skulls, packed two by two, sockets and all
            for i in range(2):
                skull(img, 5 + i * 12, y0 + 1, p, tone=0.98 + 0.04 * i)
        else:
            # a recess packed with long bones laid end-on, sawn ends facing out
            for i in range(3):
                x0 = 6 + i * 8
                shaft = mix(p["bone"], p["stone"], 0.10 + 0.10 * ((row + i) % 2))
                rect(img, x0, y0, 7, 9, shaft)
                hline(img, x0, y0, 7, shade(shaft, 1.14))
                hline(img, x0, y0 + 8, 7, shade(shaft, 0.72))
                # the sawn end: a ring with a dark marrow
                rect(img, x0 + 2, y0 + 3, 3, 3, shade(shaft, 0.7))
                px(img, x0 + 3, y0 + 4, (40, 36, 32))
        # shelf course
        hline(img, 4, y0 + 9, w - 8, shade(frame, 1.22))
        hline(img, 4, y0 + 10, w - 8, shade(frame, 0.6))
    hline(img, 0, 0, w, p["stone_pale"])
    hline(img, 0, h - 1, w, shade(frame, 0.6))
    vline(img, 0, 0, h, shade(frame, 1.24))
    vline(img, w - 1, 0, h, shade(frame, 0.6))
    return finish(img)


def ossuary_bone_lantern(p: dict):
    """A lantern hung inside a vertebra cage: the ossuary's own light."""
    w, h = 26, 66
    img = new(w, h)
    cx = w // 2
    vline(img, cx, 0, 26, p["iron"])
    for i in range(0, 26, 6):
        px(img, cx, i, p["iron_light"])
    # vertebra cage
    for dy in range(0, 22, 2):
        half = int(9 * math.sqrt(max(0.0, 1.0 - ((11 - dy) / 12.0) ** 2)))
        if half <= 0:
            continue
        px(img, cx - half, 30 + dy, p["bone_dark"])
        px(img, cx + half, 30 + dy, p["bone"])
    rect(img, cx - 5, 34, 10, 12, (255, 214, 150))
    rect(img, cx - 3, 36, 6, 8, (255, 242, 206))
    glow(img, cx, 40, 13, 14, (255, 216, 150), 140, steps=4)
    hline(img, cx - 8, 52, 16, p["iron"])
    return finish(img, shadow=False)


def ossuary_femur_bundle(p: dict):
    """A tied bundle of long bones leaning against a wall."""
    w, h = 30, 40
    img = new(w, h)
    for i, x0 in enumerate((5, 11, 17, 23)):
        rect(img, x0, 8 + i % 2 * 3, 5, h - 12, mix(p["bone"], p["stone"], 0.12 + i * 0.05))
        hline(img, x0, 8 + i % 2 * 3, 5, p["stone_pale"])
        px(img, x0 + 2, 10 + i % 2 * 3, shade(p["bone"], 0.84))
        px(img, x0 + 2, h - 9, shade(p["bone"], 0.84))
    hline(img, 4, 22, w - 8, p["iron"])
    hline(img, 4, 23, w - 8, p["iron_light"])
    hline(img, 0, h - 3, w, shade(p["stone"], 0.72))
    return finish(img)


def ossuary_charnel_hearth(p: dict):
    """A hearth of stacked bone, burning with a cold black flame."""
    w, h = 40, 34
    img = new(w, h)
    for i in range(9):
        x0 = 3 + (i % 5) * 7
        y0 = h - 8 - (i // 5) * 6
        rect(img, x0, y0, 8, 5, mix(p["bone"], p["stone"], 0.16))
    rect(img, 12, 12, 16, 8, shade(p["stone"], 0.6))
    for i in range(7):
        px(img, 16 + i, 12 - i % 3, (120, 136, 140))
        px(img, 16 + i, 13 - i % 3, (168, 188, 192))
    glow(img, 20, 12, 14, 12, (150, 190, 200), 90, steps=3)
    hline(img, 0, h - 2, w, shade(p["stone"], 0.66))
    return finish(img, shadow=False)


# ---------------------------------------------------------------------------
# Level 3 - the Crossfire Archive
# ---------------------------------------------------------------------------
def archive_soot_band(p: dict):
    """Stone above a burnt shelf: coursed sandstone, blackened at the top.

    The body is mixed *down* toward soot, not left at the paving's own value. Floor
    and wall were within a few percent of each other across the whole level, so a
    room had no ground plane at all - the floor, the wall below the cornice and the
    cases all sat in one brown field and the only thing separating them was a joint
    line. A burnt archive's walls are soot-blackened stone; the paving under the ash
    is not.
    """
    img = new(T, T)
    body = shade(mix(p["stone_dark"], p["soot"], 0.42), 1.12)
    rect(img, 0, 0, T, T, body)
    courses(img, 0, 0, T, T, body, row_h=T, seed=81, mortar=p["mortar"])
    for i in range(30):
        x = int(_h01(81, i, 1) * T)
        y = int(_h01(81, i, 2) * 7)
        px(img, x, y, shade(p["soot"], 0.9))
    hline(img, 0, 0, T, shade(p["soot"], 0.9))
    hline(img, 0, 1, T, shade(p["soot"], 1.55))
    return img


def archive_grille_band(p: dict):
    """An iron grille over a shelf recess, and a second one barred with boards.

    Two variants, because one grille stamped every six cells along a wall is a
    repeating glyph, not architecture. The recess is a genuine hole: dark inside,
    with a lit arris down its left edge and a shadowed one down its right.
    """
    img = new(T, T)
    body = shade(p["stone"], 0.86)
    rect(img, 0, 0, T, T, body)
    courses(img, 0, 0, T, T, body, row_h=T, seed=83, mortar=p["mortar"])
    rect(img, 2, 3, T - 4, 11, shade(body, 0.5))
    rect(img, 3, 4, T - 6, 9, (22, 19, 16))
    for x in range(4, T - 4, 4):
        vline(img, x, 4, 9, p["iron"])
        vline(img, x + 1, 4, 9, p["iron_light"])
    hline(img, 3, 7, T - 6, p["iron"])
    vline(img, 2, 3, 11, shade(body, 1.22))
    vline(img, T - 3, 3, 11, shade(body, 0.62))
    hline(img, 1, 2, T - 2, shade(body, 1.18))
    hline(img, 1, 14, T - 2, p["iron"])
    # a book pressed against the bars
    rect(img, 5, 8, 3, 4, p["paper_dark"])
    hline(img, 5, 8, 3, p["paper"])
    return img


def archive_boarded_band(p: dict):
    """A recess boarded over: the shelf behind it is gone."""
    img = new(T, T)
    body = shade(p["stone"], 0.86)
    rect(img, 0, 0, T, T, body)
    courses(img, 0, 0, T, T, body, row_h=T, seed=87, mortar=p["mortar"])
    rect(img, 2, 4, T - 4, 10, shade(p["soot"], 0.9))
    for i, y in enumerate((5, 8, 11)):
        plank = shade(p["stone_dark"], 1.0 + i * 0.08)
        rect(img, 1, y, T - 2, 2, plank)
        hline(img, 1, y, T - 2, shade(plank, 1.22))
        px(img, 3, y + 1, p["iron"])
        px(img, T - 4, y + 1, p["iron"])
    vline(img, 1, 4, 10, shade(body, 1.22))
    return img


def archive_ash_floor(p: dict, seed: int = 7):
    """Paving under a burnt archive: grit, ash drifts, a scatter of scrap paper.

    The first version dusted the slab with a per-pixel dither at one fifth density,
    and because every cell of a room gets the same four tiles the dither lined up
    across the whole floor into a diagonal lattice - a printed trellis over a
    scriptorium. Ash settles in drifts, so it is drawn as two or three soft patches
    placed by patch, not as noise.
    """
    img = flag(p, seed, 2, tone=0.96)
    # Ash is a *continuous* deposit, not a set of marks. The blobs and the scrap of
    # paper that used to sit on this tile were placed by a fixed hash, so they landed
    # in the same spot inside every cell of the room - a repeating glyph on a grid,
    # which is the loudest thing in the frame at gameplay zoom. What repeats safely
    # is a gradient, so the tile carries a soft drift of ash across one corner and
    # nothing else; the debris is furniture and belongs in props, where it can be
    # placed once.
    ashy = mix(p["stone"], p["soot"], 0.30)
    for y in range(T):
        for x in range(T):
            # a drift that thickens toward the south-east corner, with a torn edge
            reach = ((x + y) / float(2 * T - 2))
            torn = 0.72 + 0.28 * _h01(seed, x // 2, y // 2, 3)
            amount = max(0.0, (reach - torn) / max(1e-6, 1.0 - torn))
            if amount > 0.02:
                px(img, x, y, mix(img.getpixel((x, y))[:3], ashy, min(0.75, amount)))
    return img


def archive_board_floor(p: dict, seed: int = 8):
    """A boardwalk over the reading floor: planks end-on, iron nails."""
    img = new(T, T)
    rect(img, 0, 0, T, T, p["mortar"])
    for i in range(2):
        y0 = i * 8
        plank = shade(p["stone_dark"], 1.05 + i * 0.06)
        rect(img, 0, y0 + 1, T, 6, plank)
        hline(img, 0, y0 + 1, T, shade(plank, 1.24))
        hline(img, 0, y0 + 6, T, shade(plank, 0.72))
        for x in range(1, T, 5):
            px(img, x, y0 + 3, shade(plank, 0.86))
        px(img, 2, y0 + 2, p["iron"])
        px(img, T - 3, y0 + 2, p["iron"])
    return img


def archive_register_ring(p: dict):
    """A chalk register ring painted on the floor: where the catalogue was kept."""
    w = T
    img = flag(p, 4, 0, tone=1.04)
    for i in range(30):
        a = i / 30 * math.pi * 2
        px(img, int(8 + math.cos(a) * 6), int(8 + math.sin(a) * 6), p["paper"])
        px(img, int(8 + math.cos(a) * 5), int(8 + math.sin(a) * 5), p["paper_dark"])
    return img


# --- L3 props ---------------------------------------------------------------
def archive_shelf(p: dict, *, burnt=False, variant: int = 0):
    """A tall bookcase: five shelves, chains on the rare volumes, one gap.

    `variant` re-rolls the books. A rank of a scriptorium's cases is nine copies of
    one sprite, and because every copy is byte-identical the eye reads the spines as
    a printed pattern rather than as nine different cases of books - the same
    stamping fault as a repeated prop, one level down. Three variants of the same
    case cost three frames and break the repeat.
    """
    w, h = 44, 96
    img = new(w, h)
    frame = shade(p["stone_dark"], 1.06)
    block(img, 0, 0, w, h, frame)
    rect(img, 3, 4, w - 6, h - 8, shade(p["soot"], 1.12))
    for shelf in range(5):
        y0 = 8 + shelf * 17
        hline(img, 3, y0 + 14, w - 6, shade(frame, 1.30))
        hline(img, 3, y0 + 15, w - 6, shade(frame, 0.66))
        if burnt and shelf == 2:
            for i in range(3):
                rect(img, 6 + i * 11, y0 + 8, 8, 6, shade(p["soot"], 1.35))
            continue
        for i in range(4):
            x0 = 5 + i * 10
            if _h01(11 + variant * 7, shelf, i) < 0.16:
                continue
            tall = 9 + int(_h01(12 + variant * 7, shelf, i) * 4)
            body = shade(p["paper_dark"], 0.8 + 0.35 * _h01(13 + variant * 7, shelf, i))
            rect(img, x0, y0 + 14 - tall, 7, tall, body)
            vline(img, x0, y0 + 14 - tall, tall, shade(body, 1.20))
            vline(img, x0 + 6, y0 + 14 - tall, tall, shade(body, 0.74))
            hline(img, x0, y0 + 14 - tall + 2, 7, shade(body, 0.80))
        # a chained volume left out on the shelf
        if shelf in ((0, 3) if variant % 2 == 0 else (1,)):
            rect(img, w - 14, y0 + 6, 8, 8, p["cloth"])
            hline(img, w - 14, y0 + 6, 8, p["accent"])
            for k in range(4):
                px(img, w - 12 + (k % 2), y0 + 15 + k, p["iron_light"])
    hline(img, 0, 0, w, shade(frame, 1.28))
    hline(img, 0, h - 1, w, shade(frame, 0.6))
    return finish(img)


def archive_lectern(p: dict):
    """A reading lectern with an open book and a candle stub."""
    w, h = 30, 44
    img = new(w, h)
    cx = w // 2
    block(img, cx - 8, h - 7, 16, 7, shade(p["stone"], 0.9))
    vline(img, cx - 1, 18, h - 24, p["stone"])
    vline(img, cx, 18, h - 24, shade(p["stone"], 0.8))
    # desk, raked
    for i in range(9):
        hline(img, cx - 12 + i, 10 + i, 24 - i * 2, shade(p["stone"], 1.06))
    hline(img, cx - 12, 10, 24, p["stone_pale"])
    # open book
    rect(img, cx - 9, 8, 8, 4, p["paper"])
    rect(img, cx + 1, 8, 8, 4, p["paper"])
    vline(img, cx, 6, 6, p["paper_dark"])
    hline(img, cx - 8, 9, 6, p["paper_dark"])
    hline(img, cx + 2, 9, 6, p["paper_dark"])
    # candle stub on the corner
    rect(img, cx + 10, 4, 2, 5, p["paper"])
    px(img, cx + 10, 3, (255, 220, 160))
    glow(img, cx + 10, 3, 6, 8, p["accent_light"], 100, steps=3)
    return finish(img)


def archive_scroll_rack(p: dict):
    """A rack of scrolls in pigeonholes, one spilled on the floor."""
    w, h = 34, 44
    img = new(w, h)
    block(img, 0, 4, w, h - 4, shade(p["stone"], 0.92))
    rect(img, 2, 7, w - 4, h - 12, shade(p["soot"], 1.15))
    for row in range(3):
        for col in range(4):
            x0 = 4 + col * 8
            y0 = 9 + row * 9
            rect(img, x0, y0, 6, 6, (22, 18, 14))
            if _h01(21, row, col) > 0.3:
                rect(img, x0, y0 + 1, 6, 2, p["paper_dark"])
                px(img, x0, y0 + 1, p["paper"])
    # fallen scroll
    rect(img, w - 12, h - 10, 10, 3, p["paper"])
    hline(img, w - 12, h - 10, 10, p["paper_dark"])
    return finish(img)


def archive_chandelier(p: dict):
    """An iron chandelier on a chain: three cups of coals, all the light here."""
    w, h = 44, 88
    img = new(w, h)
    cx = w // 2
    vline(img, cx, 0, 40, p["iron"])
    for i in range(0, 40, 5):
        px(img, cx, i, p["iron_light"])
    hline(img, cx - 18, 40, 37, p["iron"])
    hline(img, cx - 18, 41, 37, p["iron_light"])
    for x in (cx - 16, cx, cx + 16):
        vline(img, x, 42, 6, p["iron"])
        rect(img, x - 3, 48, 7, 4, p["iron_light"])
        rect(img, x - 2, 47, 5, 2, (255, 168, 96))
        px(img, x, 46, (255, 226, 170))
        glow(img, x, 47, 8, 9, p["ember_light"], 120, steps=3)
    return finish(img, shadow=False)


def archive_brazier(p: dict):
    """A brazier of burning papers: the archive's own destruction."""
    w, h = 32, 40
    img = new(w, h)
    cx = w // 2
    for i, x in enumerate((cx - 8, cx - 3, cx + 4)):
        vline(img, x, h - 16, 14, p["iron"])
        px(img, x, h - 2, p["iron_light"])
    rect(img, cx - 10, h - 20, 20, 6, p["iron"])
    hline(img, cx - 10, h - 20, 20, p["iron_light"])
    for i in range(6):
        px(img, cx - 6 + i * 2, h - 24 - i % 3, p["ember"])
        px(img, cx - 6 + i * 2, h - 25 - i % 3, p["ember_light"])
    # a half-burnt page hanging out of the bowl
    rect(img, cx + 4, h - 24, 5, 4, p["paper_dark"])
    glow(img, cx, h - 24, 14, 12, p["ember_light"], 120, steps=3)
    return finish(img, shadow=False)


def archive_grille_door(p: dict):
    """A barred archive door: the way between reading rooms, and it is locked."""
    w, h = 38, 60
    img = new(w, h)
    stone = shade(p["stone"], 1.02)
    block(img, 0, 2, 7, h - 2, stone)
    block(img, w - 7, 2, 7, h - 2, stone)
    block(img, 0, 0, w, 6, shade(stone, 1.12))
    hline(img, 0, 0, w, p["stone_pale"])
    rect(img, 7, 6, w - 14, h - 6, (18, 15, 12))
    for x in range(9, w - 8, 5):
        vline(img, x, 8, h - 10, p["iron"])
        vline(img, x + 1, 8, h - 10, p["iron_light"])
    for y in (16, 30, 44):
        hline(img, 8, y, w - 16, p["iron"])
        hline(img, 8, y + 1, w - 16, p["iron_light"])
    # padlock and a chain loop
    rect(img, w // 2 - 3, 28, 6, 6, p["accent"])
    px(img, w // 2, 29, p["iron_dark"])
    return finish(img)


def archive_ladder(p: dict):
    """A library ladder hooked to a shelf rail."""
    w, h = 26, 84
    img = new(w, h)
    for x0 in (4, w - 8):
        rect(img, x0, 4, 4, h - 8, shade(p["stone_dark"], 1.12))
        vline(img, x0, 4, h - 8, shade(p["stone_dark"], 1.30))
        vline(img, x0 + 3, 4, h - 8, shade(p["stone_dark"], 0.72))
    for y in range(12, h - 8, 11):
        hline(img, 5, y, w - 10, shade(p["stone_dark"], 1.05))
        hline(img, 5, y + 1, w - 10, shade(p["stone_dark"], 0.7))
    # iron hooks at the top
    px(img, 4, 2, p["iron_light"])
    px(img, w - 5, 2, p["iron_light"])
    hline(img, 2, 2, w - 4, p["iron"])
    return finish(img)


# ---------------------------------------------------------------------------
# Level 4 - the Spiral Reliquary
# ---------------------------------------------------------------------------
def spiral_rings(radius: int = 5):
    """Concentric floor inlay for the spiral reliquary, as 16 px tiles.

    The level is a helix around one relic, and a helix is not something a tiled floor
    can show with four flagstone variants. So the inlay is cut out of one large plate
    - bronze rings, a jade ground, ward notches on the diagonals - and sliced into
    tiles per offset, exactly the way the Vigil's ward ring is.
    """
    span = 2 * radius + 1
    size = span * T
    canvas = new(size, size)
    c = size / 2 - 0.5
    r_out = radius * T - 6
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            n = _h01(41, x // 2, y // 2)
            if d > r_out:
                base = mix(PALETTES["spiral"]["stone"], PALETTES["spiral"]["stone_dark"], 0.35)
                px(canvas, x, y, shade(base, 0.96 + n * 0.10))
                continue
            ring = int(d // 11)
            base = mix(PALETTES["spiral"]["jade"], PALETTES["spiral"]["stone_dark"],
                       0.30 if ring % 2 == 0 else 0.55)
            px(canvas, x, y, shade(base, 0.95 + n * 0.09))
            # bronze bands at every ring boundary
            if d % 11 < 2:
                px(canvas, x, y, PALETTES["spiral"]["accent"] if (x + y) % 4 else
                   PALETTES["spiral"]["accent_light"])
    # the spiral itself: a bronze line that turns once over the whole plate
    for i in range(0, int(r_out * 7)):
        a = i / 7.0
        r = 6 + (r_out - 14) * (a / (r_out * 1.1))
        x = int(c + math.cos(a) * r)
        y = int(c + math.sin(a) * r)
        px(canvas, x, y, PALETTES["spiral"]["accent_light"])
        px(canvas, x + 1, y, PALETTES["spiral"]["accent"])
    # eight ward notches
    for i in range(8):
        a = math.pi / 4 * i
        for r in range(int(r_out) - 24, int(r_out) - 10):
            px(canvas, int(c + math.cos(a) * r), int(c + math.sin(a) * r),
               PALETTES["spiral"]["stone_pale"])
    glow(canvas, c, c, 20, 20, PALETTES["spiral"]["accent_light"], 70, steps=4)
    frames = {}
    for ty in range(span):
        for tx in range(span):
            frames["spiral_%d_%d" % (tx - radius, ty - radius)] = \
                canvas.crop((tx * T, ty * T, tx * T + T, ty * T + T))
    return frames


def spiral_shrine_band(p: dict):
    """A shrine niche course: one arched niche with a bronze lamp and a relic box."""
    img = new(T, T)
    body = shade(p["stone"], 0.94)
    rect(img, 0, 0, T, T, body)
    courses(img, 0, 0, T, T, body, row_h=T, seed=91, mortar=p["mortar"])
    rect(img, 4, 3, 8, 11, p["mortar"])
    for y in range(3, 8):
        half = int(4 * math.sqrt(max(0.0, 1.0 - ((5 - y) / 3.0) ** 2)))
        if half <= 0:
            continue
        hline(img, 8 - half, y, half * 2, (20, 22, 20))
    rect(img, 4, 8, 8, 6, (20, 22, 20))
    vline(img, 3, 3, 11, p["stone_pale"])
    vline(img, 12, 3, 11, shade(body, 0.66))
    hline(img, 3, 14, 10, shade(body, 1.20))
    # relic box and a bronze lamp inside
    rect(img, 5, 11, 6, 3, p["accent"])
    hline(img, 5, 11, 6, p["accent_light"])
    px(img, 8, 9, p["accent_light"])
    return img


# --- L4 props ---------------------------------------------------------------
def spiral_relic_plinth(p: dict):
    """The relic plinth: a stepped ivory drum under a bronze reliquary.

    The level's whole composition turns on this cell, so it is built as three
    stepped plinths, a fluted drum, a bronze collar, and a crystal reliquary with a
    lit core - tall enough to be seen over the player from across the room.
    """
    w, h = 88, 148
    img = new(w, h)
    cx = w // 2
    for i, (width, y0, tone) in enumerate(((84, h - 18, 0.86), (70, h - 30, 0.94),
                                           (58, h - 40, 1.02))):
        block(img, cx - width // 2, y0, width, 14, shade(p["stone"], tone))
        hline(img, cx - width // 2, y0, width, p["stone_pale"])
        hline(img, cx - width // 2, y0 + 12, width, shade(p["stone"], 0.62))
    # drum
    block(img, cx - 21, 52, 42, h - 90, shade(p["stone"], 1.04))
    for x in range(cx - 18, cx + 19, 5):
        vline(img, x, 56, h - 98, shade(p["stone"], 1.16))
        vline(img, x + 1, 56, h - 98, shade(p["stone"], 0.88))
    for y in (66, 96):
        hline(img, cx - 21, y, 42, p["accent"])
        hline(img, cx - 21, y + 2, 42, p["accent_light"])
    # collar
    block(img, cx - 25, 44, 50, 10, shade(p["stone_pale"], 0.96))
    hline(img, cx - 25, 44, 50, p["stone_pale"])
    hline(img, cx - 25, 52, 50, p["accent"])
    # reliquary: a bronze frame around a lit crystal
    rect(img, cx - 15, 10, 30, 34, p["accent"])
    frame_box(img, cx - 15, 10, 30, 34, p["accent_light"])
    rect(img, cx - 11, 14, 22, 26, (26, 30, 30))
    for i in range(9):
        half = int(9 * (1 - abs(i - 4) / 6.0))
        if half <= 0:
            continue
        rect(img, cx - half, 18 + i * 2, half * 2, 2, mix((120, 160, 140), (196, 240, 214),
                                                         1.0 - abs(i - 4) / 5.0))
    glow(img, cx, 30, 24, 26, (150, 220, 190), 130, steps=4)
    # bronze finial
    rect(img, cx - 4, 2, 8, 8, p["accent"])
    hline(img, cx - 4, 2, 8, p["accent_light"])
    return finish(img, shadow=False)


def spiral_hanging_lamp(p: dict):
    """A reliquary lamp on a long chain: bronze, green glass, one flame."""
    w, h = 26, 82
    img = new(w, h)
    cx = w // 2
    vline(img, cx, 0, 36, p["iron"])
    for i in range(0, 36, 5):
        px(img, cx, i, p["iron_light"])
    rect(img, cx - 7, 36, 14, 4, p["accent"])
    hline(img, cx - 7, 36, 14, p["accent_light"])
    # glass bowl
    for y in range(40, 56):
        t = (y - 40) / 16.0
        half = int(4 + t * 6)
        rect(img, cx - half, y, half * 2, 1, mix(p["jade"], p["jade_light"], 1.0 - t))
    rect(img, cx - 1, 44, 2, 8, (255, 236, 190))
    rect(img, cx - 7, 56, 14, 3, p["accent"])
    hline(img, cx - 7, 58, 14, p["accent_light"])
    glow(img, cx, 48, 15, 17, (255, 216, 150), 140, steps=4)
    return finish(img, shadow=False)


def spiral_shrine(p: dict):
    """A bronze niche shrine: a relic box on a bracket, with a votive flame."""
    w, h = 34, 62
    img = new(w, h)
    cx = w // 2
    block(img, 2, 8, w - 4, h - 8, shade(p["stone"], 0.94))
    rect(img, 5, 12, w - 10, h - 18, (22, 24, 22))
    # bronze frame inside
    frame_box(img, 6, 13, w - 12, h - 20, p["accent"])
    rect(img, 10, 36, w - 20, 10, shade(p["stone"], 1.02))
    hline(img, 10, 36, w - 20, p["stone_pale"])
    rect(img, 11, 28, 12, 8, p["accent"])
    hline(img, 11, 28, 12, p["accent_light"])
    vline(img, 17, 30, 4, p["accent_light"])
    px(img, cx, 22, (255, 228, 176))
    glow(img, cx, 23, 9, 11, (255, 216, 150), 110, steps=3)
    hline(img, 0, 8, w, p["stone_pale"])
    return finish(img, shadow=False)


def spiral_processional_dais(p: dict):
    """A low dais drum: what the procession steps onto at each turn."""
    w, h = 52, 18
    img = new(w, h)
    for i, (width, y0) in enumerate(((52, h - 8), (44, h - 13), (36, h - 18))):
        block(img, (w - width) // 2, y0, width, 7, shade(p["stone"], 0.98 + i * 0.04))
        hline(img, (w - width) // 2, y0, width, p["stone_pale"])
        hline(img, (w - width) // 2, y0 + 5, width, shade(p["stone"], 0.66))
        if i == 2:
            hline(img, (w - width) // 2, y0 + 6, width, p["accent"])
    return finish(img)


def spiral_route_floor(p: dict):
    """The processional way: darker paving with a bronze lozenge set in it.

    A tonal change alone does not read as a route at gameplay zoom - the eye needs a
    repeating *mark* along the line, and a chain of bronze lozenges is the cheapest
    honest one: each cell of the way carries a metal inlay, so the path is legible
    from across the hall without a painted stripe.
    """
    img = flag(p, 73, 2, tone=0.86)
    bronze = p["accent"]
    bright = p["accent_light"]
    dark = shade(p["accent"], 0.60)
    cx, cy = T // 2 - 1, T // 2 - 1
    for i in range(4):
        for j in range(4 - i):
            if i == 0 and j == 0:
                px(img, cx, cy - 1, bright)
                continue
            px(img, cx + j, cy - i + 1, bronze if i + j < 3 else dark)
            px(img, cx - j, cy - i + 1, bronze if i + j < 3 else dark)
            px(img, cx + j, cy + i + 1, dark if i + j > 1 else bronze)
            px(img, cx - j, cy + i + 1, dark if i + j > 1 else bronze)
    # a bronze arris along the tile's own edges, so a run of these is continuous
    hline(img, 0, 0, T, shade(p["accent"], 0.55))
    hline(img, 0, 1, T, shade(p["stone_pale"], 0.80))
    return img


def spiral_pier(p: dict):
    """An engaged pier: ivory drum, bronze astragals, jade capital.

    The reliquary had no vertical elements at all outside the five chapel niches,
    so its halls were a continuous pale floor with a small opening in the far wall
    and nothing to give the eye a scale or a depth cue. A run of these along the
    walls is what makes a hall read as a hall: each pier is a lit arris, a shadowed
    side and a cast shadow on the paving.

    Built wide on purpose. The first version was two cells of shaft in a thirty-pixel
    frame, and at gameplay zoom a run of them read as a row of white sticks rather
    than as architecture - a colonnade needs enough stone in the shaft to carry two
    flutes and a shadow on its own east side.
    """
    w, h = 40, 84
    img = new(w, h)
    stone = shade(p["stone"], 1.04)
    shaft_x, shaft_w = 5, w - 10
    # shaft, lit from the north-west: lit west face, shadowed east face
    block(img, shaft_x, 12, shaft_w, h - 18, stone, bevel=1)
    rect(img, shaft_x + 2, 14, 9, h - 22, shade(stone, 1.08))
    rect(img, shaft_x + shaft_w - 11, 14, 9, h - 22, shade(stone, 0.82))
    rect(img, shaft_x + shaft_w - 3, 14, 3, h - 22, shade(stone, 0.70))
    # fluting: grooves that catch the light on their west edge
    for x in (shaft_x + 12, shaft_x + 16, shaft_x + 20):
        vline(img, x, 15, h - 24, shade(stone, 0.84))
        vline(img, x + 1, 15, h - 24, shade(stone, 1.10))
    # bronze astragals at the waist, jade capital
    for y in (28, 52):
        rect(img, shaft_x - 1, y, shaft_w + 2, 4, p["accent"])
        hline(img, shaft_x - 1, y, shaft_w + 2, p["accent_light"])
        hline(img, shaft_x - 1, y + 3, shaft_w + 2, shade(p["accent"], 0.62))
    block(img, 1, 2, w - 2, 12, shade(stone, 1.12), bevel=1)
    hline(img, 1, 2, w - 2, p["stone_pale"])
    hline(img, 1, 12, w - 2, shade(stone, 0.66))
    rect(img, 6, 5, w - 12, 4, p["jade"])
    hline(img, 6, 5, w - 12, p["jade_light"])
    hline(img, 6, 8, w - 12, shade(p["jade"], 0.66))
    # base, wider than the shaft, with a moulded course
    block(img, 1, h - 14, w - 2, 12, shade(stone, 0.92), bevel=1)
    hline(img, 1, h - 14, w - 2, p["stone_pale"])
    hline(img, 1, h - 10, w - 2, shade(stone, 0.78))
    hline(img, 1, h - 3, w - 2, shade(stone, 0.58))
    return finish(img)


def spiral_ossuary_urn(p: dict):
    """A tall jade urn on a bronze tripod: liquid offerings at each turn."""
    w, h = 28, 46
    img = new(w, h)
    cx = w // 2
    rect(img, cx - 8, 8, 17, 24, p["jade"])
    vline(img, cx - 8, 8, 24, p["jade_light"])
    vline(img, cx + 8, 8, 24, shade(p["jade"], 0.72))
    for y in (14, 22, 30):
        hline(img, cx - 9, y, 19, p["accent"])
        hline(img, cx - 9, y + 1, 19, p["accent_light"])
    rect(img, cx - 5, 4, 11, 5, p["accent"])
    hline(img, cx - 5, 4, 11, p["accent_light"])
    for x in (cx - 7, cx + 7):
        vline(img, x, 32, 10, p["accent"])
    px(img, cx, 34, p["accent_light"])
    hline(img, 0, h - 2, w, shade(p["stone"], 0.7))
    return finish(img)


def spiral_serpent_relief(p: dict):
    """A wall panel of the serpent the reliquary is dedicated to: a spiral coil."""
    w, h = 26, 60
    img = new(w, h)
    block(img, 0, 2, w, h - 4, shade(p["stone"], 1.00))
    rect(img, 3, 6, w - 6, h - 14, shade(p["stone"], 0.84))
    cx, cy = w // 2, h // 2
    for i in range(120):
        a = i / 12.0
        r = 2 + i * 0.09
        x = int(cx + math.cos(a) * r)
        y = int(cy + math.sin(a * 0.94) * r * 1.2)
        px(img, x, y, p["jade_light"])
        px(img, x, y + 1, p["jade"])
    # head
    rect(img, cx - 2, 12, 5, 4, p["jade_light"])
    px(img, cx - 1, 13, (24, 30, 26))
    px(img, cx + 2, 13, (24, 30, 26))
    hline(img, 0, 2, w, p["stone_pale"])
    return finish(img)


# ---------------------------------------------------------------------------
# kit assembly
# ---------------------------------------------------------------------------
def build_crypt_kit() -> None:
    p = PALETTES["crypt"]
    tiles = base_tiles(p, floor_extra=[
        ("floor_aisle_w", lambda: crypt_floor_aisle(p, "w")),
        ("floor_aisle_e", lambda: crypt_floor_aisle(p, "e")),
        ("floor_aisle_n", lambda: crypt_floor_aisle(p, "n")),
        ("floor_aisle_s", lambda: crypt_floor_aisle(p, "s")),
        ("floor_threshold", lambda: crypt_threshold_floor(p)),
    ], wall={
        # the storey above the socle is the columbarium: two arched loculi per cell,
        # lit arris, urn on the shelf. The socle stays a socle, so the wall reads
        # bottom-up as base, burial course, cornice, cap.
        "field_a": lambda: crypt_loculus_band(p),
        "field_b": lambda: crypt_vault_band(p),
        "dado": lambda: crypt_threshold_band(p),
        "cornice": lambda: wall_cornice_tile(p["stone_pale"], shade(p["stone"], 0.86)),
    })
    tiles += [
        ("wall_loculus", lambda: crypt_loculus_band(p)),
        ("wall_threshold", lambda: crypt_threshold_band(p)),
        ("wall_vault", lambda: crypt_vault_band(p)),
    ]
    props = [
        ("sarcophagus", lambda: crypt_sarcophagus(p)),
        ("sarcophagus_worn", lambda: crypt_sarcophagus_worn(p)),
        ("sarcophagus_pair", lambda: crypt_sarcophagus_pair(p)),
        ("sarcophagus_open", lambda: crypt_sarcophagus_open(p)),
        ("crypt_door", lambda: crypt_door(p)),
        ("crypt_door_ajar", lambda: crypt_door(p, ajar=True)),
        ("loculus", lambda: crypt_loculus_tall(p)),
        ("candelabrum", lambda: crypt_candelabrum(p)),
        ("grave_goods", lambda: crypt_grave_goods(p)),
        ("grave_urn", lambda: crypt_grave_goods(p, urn=True)),
        ("hanging_lamp", lambda: crypt_hanging_lamp(p)),
        ("bier", lambda: crypt_bier(p)),
    ]
    write_kit(os.path.join(ART_ROOT, "crypt"), "crypt", tiles, props,
              light_colour=(255, 226, 186), gamma=0.92)


def build_ossuary_kit() -> None:
    p = PALETTES["ossuary"]
    tiles = base_tiles(p, floor_extra=[
        ("floor_charnel", lambda: ossuary_charnel_floor(p)),
        ("floor_procession", lambda: ossuary_procession(p)),
    ], wall={
        "field_a": lambda: ossuary_bone_course(p),
        "field_b": lambda: ossuary_bone_course(p, seed=3, skulls=False),
        "dado": lambda: ossuary_skull_band(p),
        "plinth": lambda: wall_plinth_tile(shade(p["stone"], 0.70), p["iron"]),
        "cornice": lambda: ossuary_skull_band(p),
        "cap": lambda: wall_cap_tile(p["stone_pale"], shade(p["stone"], 0.9)),
    })
    tiles += [
        ("wall_bone", lambda: ossuary_bone_course(p, skulls=False)),
        ("wall_skulls", lambda: ossuary_skull_band(p)),
        ("wall_field_c", lambda: wall_field_tile(61, shade(p["stone"], 0.94), p["mortar"])),
    ]
    props = [
        ("bone_arch", lambda: ossuary_bone_arch(p)),
        ("skull_bank", lambda: ossuary_skull_bank(p)),
        ("ossuary_stack", lambda: ossuary_ossuary_stack(p)),
        ("ossuary_stack_skull", lambda: ossuary_ossuary_stack(p, "skull")),
        ("ossuary_stack_shaft", lambda: ossuary_ossuary_stack(p, "shaft")),
        ("bone_lantern", lambda: ossuary_bone_lantern(p)),
        ("bone_bundle", lambda: ossuary_femur_bundle(p)),
        ("charnel_hearth", lambda: ossuary_charnel_hearth(p)),
    ]
    write_kit(os.path.join(ART_ROOT, "ossuary"), "ossuary", tiles, props,
              light_colour=(255, 238, 206), gamma=0.94)


def build_archive_kit() -> None:
    p = PALETTES["archive"]
    tiles = base_tiles(p, floor_extra=[
        ("floor_ash", lambda: archive_ash_floor(p)),
        ("floor_boards", lambda: archive_board_floor(p)),
        ("floor_register", lambda: archive_register_ring(p)),
    ], wall={
        "field_a": lambda: archive_soot_band(p),
        "field_b": lambda: archive_soot_band(p),
        "dado": lambda: archive_boarded_band(p),
        "cornice": lambda: wall_cornice_tile(shade(p["soot"], 1.5), shade(p["stone"], 0.8)),
    })
    tiles += [
        ("wall_soot", lambda: archive_soot_band(p)),
        ("wall_grille", lambda: archive_grille_band(p)),
        ("wall_boarded", lambda: archive_boarded_band(p)),
    ]
    props = [
        ("bookshelf", lambda: archive_shelf(p)),
        ("bookshelf_b", lambda: archive_shelf(p, variant=1)),
        ("bookshelf_c", lambda: archive_shelf(p, variant=2)),
        ("bookshelf_burnt", lambda: archive_shelf(p, burnt=True)),
        ("bookshelf_burnt_b", lambda: archive_shelf(p, burnt=True, variant=1)),
        ("lectern", lambda: archive_lectern(p)),
        ("scroll_rack", lambda: archive_scroll_rack(p)),
        ("chandelier", lambda: archive_chandelier(p)),
        ("brazier", lambda: archive_brazier(p)),
        ("grille_door", lambda: archive_grille_door(p)),
        ("ladder", lambda: archive_ladder(p)),
    ]
    write_kit(os.path.join(ART_ROOT, "archive"), "archive", tiles, props,
              light_colour=(255, 214, 164), gamma=0.86)


def build_spiral_kit() -> None:
    p = PALETTES["spiral"]
    tiles = base_tiles(p, floor_extra=[
        ("floor_shrine", lambda: flag(p, 67, 2, tone=1.04)),
        ("floor_dais", lambda: flag(p, 69, 0, tone=0.90)),
        ("floor_route", lambda: spiral_route_floor(p)),
    ], wall={
        # The reliquary's walls are a dark warm plaster, and the ivory is what the
        # *piers*, the shrine band and the paving are made of. Walls cut from the same
        # ivory as the floor left the level as one pale field with no ground plane;
        # the contrast is carried by material, not by turning the lights down.
        "field_a": lambda: wall_field_tile(63, shade(mix(p["stone_dark"], p["cloth"], 0.45),
                                                     0.92), p["mortar"]),
        "field_b": lambda: wall_field_tile(65, shade(mix(p["stone_dark"], p["cloth"], 0.45),
                                                     0.80), p["mortar"]),
        "dado": lambda: spiral_shrine_band(p),
        "cornice": lambda: wall_cornice_tile(p["accent"], shade(p["stone"], 0.86)),
    })
    tiles += [
        ("wall_shrine", lambda: spiral_shrine_band(p)),
        ("wall_pier_bronze", lambda: wall_field_tile(71, shade(p["stone_pale"], 0.92),
                                                     p["mortar"], pier=True)),
    ]
    frames = spiral_rings(5)
    for name, image in frames.items():
        tiles.append((name, lambda i=image: i.copy()))
    props = [
        ("relic_plinth", lambda: spiral_relic_plinth(p)),
        ("reliquary_lamp", lambda: spiral_hanging_lamp(p)),
        ("shrine", lambda: spiral_shrine(p)),
        ("processional_dais", lambda: spiral_processional_dais(p)),
        ("pier", lambda: spiral_pier(p)),
        ("jade_urn", lambda: spiral_ossuary_urn(p)),
        ("serpent_relief", lambda: spiral_serpent_relief(p)),
    ]
    write_kit(os.path.join(ART_ROOT, "spiral"), "spiral", tiles, props,
              light_colour=(255, 222, 178), gamma=0.90)


def main() -> None:
    build_crypt_kit()
    build_ossuary_kit()
    build_archive_kit()
    build_spiral_kit()


if __name__ == "__main__":
    main()
