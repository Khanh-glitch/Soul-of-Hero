#!/usr/bin/env python3
"""Level 8 — The Divided Reliquary. Kit art.

One building, two funerary traditions. The base material is the same pale marble
throughout — this is one reliquary, divided — and the two wings are told apart by
what has been brought into them:

* **The Reaper wing** (west): austere and cold. Black iron, bone white, sarcophagi,
  standing figures behind grilles, thin niches, no decoration that is not
  structural. Its light is a cold blue.
* **The Vampire wing** (east): decadent and damaged. Deep wine velvet, gilt
  frames, a wine fountain, candelabra, a cracked mirror, a banquet left standing.
  Its light is rose.

Both families are in this one kit because both wings are in one room, and the
player has to be able to see the choice from the threshold.

Run: python3 tools/level8/art_reliquary.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, T, _h01, block, courses, dither, finish, flag_quadrant, frame_box, glow,
    hline, mix, new, px, rect, rock_tile, shade, shadow_tile, vline,
    wall_cap_tile, wall_cornice_tile, wall_field_tile, wall_plinth_tile,
    write_kit,
)

ART = os.path.join(ROOT, "assets", "environment", "chapter1", "reliquary")
KIT = "reliquary"

# --- palette ---------------------------------------------------------------
MARBLE_DARK = (96, 98, 106)
MARBLE_BASE = (150, 152, 158)
MARBLE_LIGHT = (186, 188, 190)
MARBLE_PALE = (214, 214, 210)
VEIN = (118, 120, 132)
MORTAR = (78, 80, 88)
ROCK_DARK = (52, 54, 60)
ROCK_BASE = (70, 72, 78)
ROCK_LIGHT = (94, 96, 102)

IRON_DARK = (30, 32, 38)
IRON = (54, 58, 66)
IRON_LIGHT = (88, 94, 104)
BONE = (198, 196, 180)
BONE_DARK = (150, 148, 134)

WINE_DARK = (62, 20, 30)
WINE = (104, 32, 46)
WINE_LIGHT = (150, 54, 70)
GILT_DARK = (122, 90, 42)
GILT = (176, 136, 66)
GILT_LIGHT = (222, 186, 116)
ROSE_LIGHT = (255, 176, 168)
COLD_LIGHT = (150, 196, 255)
COLD_PALE = (198, 224, 255)


def arc(img, cx, cy, r, a0, a1, colour, thickness=1.0) -> None:
    steps = max(8, int(abs(a1 - a0) * r))
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        for k in range(max(1, int(thickness))):
            px(img, int(cx + math.cos(a) * (r + k)), int(cy + math.sin(a) * (r + k)), colour)


# --- tiles -----------------------------------------------------------------
def rock(seed: int):
    return rock_tile(seed, ROCK_DARK, ROCK_BASE, ROCK_LIGHT)


def marble(seed: int, quad: int, *, tone: float = 1.0, cold: bool = False):
    """A pale marble flag with a joint on two edges and (sometimes) one vein.

    The veins are deliberately faint and rare: at sixteen pixels a bright vein
    reads as a repeating glyph rather than as stone, and a whole room of them
    turns the floor into wallpaper.
    """
    img = flag_quadrant(seed, quad, MARBLE_BASE, MORTAR, tone=tone)
    if _h01(seed, quad, 5) < 0.45:
        shade_colour = mix(MARBLE_BASE, MARBLE_DARK, 0.35 if cold else 0.28)
        x = 2 + int(_h01(seed, quad, 1, 3) * (T - 5))
        for y in range(1, T - 1):
            px(img, x, y, shade_colour)
            if _h01(seed, quad, 1, y) > 0.72:
                x += 1 if _h01(seed, quad, 2, y) > 0.5 else -1
            x = max(1, min(T - 2, x))
    return img


def cold_slab(seed: int, quad: int):
    """Reaper-wing paving: a black inlay line across each slab."""
    img = marble(seed, quad, tone=0.91, cold=True)
    if quad in (0, 3):
        hline(img, 0, 8, T, mix(IRON, MARBLE_BASE, 0.55))
    return img


def wine_slab(seed: int, quad: int):
    """Vampire-wing paving: rose marble with old stains."""
    img = marble(seed, quad, tone=1.02)
    if quad == 1:
        cx = 4 + int(_h01(seed, quad, 11) * 8)
        cy = 4 + int(_h01(seed, quad, 13) * 8)
        for y in range(max(0, cy - 2), min(T, cy + 3)):
            for x in range(max(0, cx - 2), min(T, cx + 3)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= 4:
                    px(img, x, y, mix(MARBLE_BASE, WINE, 0.30))
    return img


def inlay(direction: str, seed: int):
    """The spine's processional inlay: two gilt lines with a dark field."""
    img = marble(seed, 0, tone=1.02)
    if direction == "v":
        vline(img, 2, 0, T, GILT_DARK)
        vline(img, 3, 0, T, GILT)
        vline(img, 12, 0, T, GILT)
        vline(img, 13, 0, T, GILT_DARK)
        rect(img, 5, 0, 6, T, shade(MARBLE_PALE, 0.92))
    else:
        hline(img, 0, 2, T, GILT_DARK)
        hline(img, 0, 3, T, GILT)
        hline(img, 0, 12, T, GILT)
        hline(img, 0, 13, T, GILT_DARK)
        rect(img, 0, 5, T, 6, shade(MARBLE_PALE, 0.92))
    return img


def cold_inlay(direction: str, seed: int):
    """Iron-set inlay for the Reaper wing: the same gramib as the spine, in iron."""
    img = marble(seed, 0, tone=1.0 if direction == "v" else 0.98, cold=True)
    if direction == "v":
        vline(img, 3, 0, T, IRON)
        vline(img, 4, 0, T, mix(IRON_LIGHT, MARBLE_PALE, 0.45))
        vline(img, 11, 0, T, IRON)
        rect(img, 6, 0, 4, T, mix(shade(MARBLE_PALE, 0.94), IRON, 0.18))
    else:
        hline(img, 0, 3, T, IRON)
        hline(img, 0, 4, T, mix(IRON_LIGHT, MARBLE_PALE, 0.45))
        hline(img, 0, 11, T, IRON)
        rect(img, 0, 6, T, 4, mix(shade(MARBLE_PALE, 0.94), IRON, 0.18))
    return img


def disc_tiles(radius: int, cold: bool):
    """The branch emblem cut into the floor at each threshold.

    Three hard values only — a dark matte field, a bright ring, and the emblem in
    the branch's own metal — so the emblem still reads at gameplay zoom instead of
    turning into a smudge of gradients.
    """
    span = 2 * radius + 1
    size = span * T
    canvas = new(size, size)
    cx = cy = (size - 1) / 2.0
    r_out = radius * T - 2
    ring = COLD_PALE if cold else GILT_LIGHT

    # the medallion is baked onto the wing's own paving, so its corners are stone
    # rather than a see-through hole the renderer would fill with the backdrop
    for ty in range(span):
        for tx in range(span):
            cell = (tx - radius, ty - radius)
            quad = (cell[0] % 2) * 2 + (cell[1] % 2)
            base = cold_slab(59, quad) if cold else wine_slab(61, quad)
            canvas.paste(base, (tx * T, ty * T))

    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d > r_out:
                continue
            speck = (x * 7 + y * 13) % 17 == 0
            if d > r_out - 4:
                colour = IRON_LIGHT if cold else GILT_DARK
            elif d > r_out - 8:
                colour = ring
            elif d > r_out - 11:
                colour = IRON if cold else WINE_DARK
            else:
                colour = (mix(IRON, MARBLE_DARK, 0.70) if cold else
                          mix(WINE_DARK, MARBLE_DARK, 0.40))
                if speck:
                    colour = shade(colour, 1.16)
            px(canvas, x, y, colour)

    # eight studs on the outer band
    for i in range(8):
        a = math.radians(i * 45 + 22)
        sx = int(cx + math.cos(a) * (r_out - 6))
        sy = int(cy + math.sin(a) * (r_out - 6))
        rect(canvas, sx - 1, sy - 1, 3, 3, ring)

    if cold:
        # a scythe: shaft across the disc, blade sweeping over the top
        int_cx, int_cy = int(cx), int(cy)
        for y in range(int_cy - 16, int_cy + 15):
            for x in range(int_cx + 5, int_cx + 8):
                px(canvas, x, y, COLD_PALE if x == int_cx + 6 else MARBLE_PALE)
        pivot_y = int_cy - 16
        for i in range(46):
            a = math.radians(178 + i * 3.6)
            for k in range(3):
                bx = int(int_cx + 6 + math.cos(a) * (13 + k))
                by = int(pivot_y + math.sin(a) * (11 + k))
                if 0 <= bx < size and 0 <= by < size:
                    px(canvas, bx, by, COLD_PALE if k < 2 else MARBLE_PALE)
        # a grip and a pommel, so it is a weapon and not a hook
        rect(canvas, int_cx + 4, int_cy + 12, 5, 3, BONE_DARK)
        px(canvas, int_cx + 6, int_cy + 16, COLD_PALE)
    else:
        # a chalice on a foot
        int_cx, int_cy = int(cx), int(cy)
        for i in range(15):
            half = int(10 - abs(7 - i) * 1.05)
            for x in range(int_cx - half, int_cx + half):
                px(canvas, x, int_cy - 15 + i, GILT_LIGHT if i % 4 else GILT)
        vline(canvas, int_cx, int_cy + 1, 10, GILT)
        rect(canvas, int_cx - 6, int_cy + 11, 13, 3, GILT_LIGHT)
        hline(canvas, int_cx - 9, int_cy - 13, 19, GILT_LIGHT)
        for x in (int_cx - 9, int_cx + 8):
            vline(canvas, x, int_cy - 13, 4, GILT)

    frames = {}
    for ty in range(span):
        for tx in range(span):
            frames["disc_%d_%d" % (tx - radius, ty - radius)] = \
                canvas.crop((tx * T, ty * T, tx * T + T, ty * T + T))
    return frames


def disc_offsets(radius: int):
    return {(dx, dy): "disc_%d_%d" % (dx, dy)
            for dy in range(-radius, radius + 1)
            for dx in range(-radius, radius + 1)}


# --- props: shared marble vocabulary ---------------------------------------
def prop_column(seed: int = 1, *, broken: bool = False):
    """A fluted marble column with a cast shadow down one side.

    The first version was a flat pale rectangle with hatching, which read as a
    ladder. This one is lit from the left: a bright edge, a mid shaft, and a dark
    three-pixel shadow that never leaves the right side.
    """
    w, h = 34, (124 if not broken else 74)
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    # base: two stepped blocks
    block(img, 2, base_y - 9, w - 4, 9, MARBLE_BASE, bevel=1)
    block(img, 4, base_y - 14, w - 8, 5, MARBLE_LIGHT)
    rect(img, 2, base_y - 2, w - 4, 2, shade(MARBLE_DARK, 0.82))
    shaft_top = 20 if not broken else 26
    half = 10
    for y in range(shaft_top, base_y - 14):
        for x in range(cx - half, cx + half):
            t = (x - (cx - half)) / (2.0 * half)
            if t < 0.10:
                colour = MARBLE_PALE
            elif t < 0.34:
                colour = MARBLE_LIGHT
            elif t < 0.66:
                colour = MARBLE_BASE
            elif t < 0.86:
                colour = shade(MARBLE_BASE, 0.90)
            else:
                colour = shade(MARBLE_DARK, 0.94)
            # fluting: two dark grooves on the lit side, one on the shadow side
            for gx in (-6, -1, 5):
                if x == cx + gx:
                    colour = shade(colour, 0.93)
                if x == cx + gx + 1:
                    colour = shade(colour, 1.05)
            px(img, x, y, colour)
    if not broken:
        # capital: abacus, echinus, then the necking ring
        block(img, 1, shaft_top - 8, w - 2, 6, MARBLE_PALE)
        block(img, 4, shaft_top - 3, w - 8, 4, MARBLE_LIGHT)
        for i in range(4):
            rect(img, 5 + i, shaft_top - 12 + i, w - 10 - i * 2, 1, MARBLE_LIGHT)
        hline(img, 1, shaft_top - 9, w - 2, shade(MARBLE_DARK, 0.9))
        for i in range(3):
            px(img, cx - 7 + i * 7, shaft_top - 13, GILT)
    else:
        # a snapped shaft: the break line is jagged, the core is pale
        for i in range(18):
            px(img, cx - half + i, shaft_top + (i * 5 % 4), MARBLE_PALE)
            px(img, cx - half + i, shaft_top + 1 + (i * 5 % 4), shade(MARBLE_DARK, 0.92))
        for i in range(5):
            px(img, cx - 4 + i * 2, shaft_top - 2 - (i % 3), MARBLE_LIGHT)
    return finish(img)


def prop_sarcophagus(seed: int = 2, *, open_lid: bool = False):
    """A marble chest with a carved front, an overhanging lid and an effigy.

    Drawn in three value bands — lit lid, mid chest, dark base — because a marble
    box with one flat value reads as a bench, which is what the first version of
    this prop did.
    """
    w, h = 78, 50
    img = new(w, h)
    base_y = h - 3
    # base moulding, in shadow
    block(img, 6, base_y - 7, w - 12, 7, shade(MARBLE_DARK, 0.92), bevel=1)
    # chest: front face darker than the lid
    chest_top = base_y - 30
    block(img, 8, chest_top, w - 16, 24, MARBLE_BASE)
    rect(img, 10, chest_top + 4, w - 20, 16, shade(MARBLE_BASE, 0.86))
    # blind arcading on the front
    for i in range(5):
        x = 13 + i * 12
        arc(img, x + 5, chest_top + 18, 4, 180, 360, MARBLE_DARK, 1)
        vline(img, x + 1, chest_top + 18, 8, MARBLE_DARK)
        vline(img, x + 9, chest_top + 18, 8, shade(MARBLE_DARK, 0.86))
        px(img, x + 5, chest_top + 11, MARBLE_LIGHT)
    # lid: overhangs by three pixels on each side, lit from the top left
    if open_lid:
        block(img, 4, chest_top - 8, w - 24, 9, MARBLE_PALE)
        block(img, w - 30, chest_top - 20, 26, 10, MARBLE_PALE)
        rect(img, 12, chest_top - 6, w - 34, 6, (22, 20, 24))
        for i in range(7):
            px(img, 16 + i * 5, chest_top - 4, BONE if i % 2 else BONE_DARK)
            px(img, 17 + i * 5, chest_top - 3, shade(BONE, 0.82))
    else:
        block(img, 5, chest_top - 8, w - 10, 9, MARBLE_PALE)
        hline(img, 5, chest_top - 9, w - 10, MARBLE_LIGHT)
        # recumbent effigy on the lid: head, shoulders, feet
        rect(img, 16, chest_top - 13, 12, 5, MARBLE_LIGHT)
        rect(img, 18, chest_top - 17, 8, 5, MARBLE_PALE)
        for i in range(28):
            px(img, 30 + i, chest_top - 12, MARBLE_LIGHT if i % 5 else MARBLE_PALE)
        rect(img, w - 24, chest_top - 14, 8, 6, MARBLE_LIGHT)
        rect(img, 20, chest_top - 6, w - 40, 2, GILT_DARK)
    return finish(img)


def prop_reaper_statue(seed: int = 3):
    """A hooded figure holding a scythe: the Reaper wing's ornament is absence."""
    w, h = 40, 104
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    block(img, 8, base_y - 9, w - 16, 9, MARBLE_BASE)
    block(img, 6, base_y - 13, w - 12, 5, MARBLE_LIGHT)
    # robe: a widening cone of vertical folds
    for i in range(66):
        y = base_y - 13 - i
        t = i / 66
        half = int(5 + t * 9)
        for x in range(cx - half, cx + half):
            fold = (x - cx) % 4
            colour = mix(MARBLE_LIGHT, IRON, 0.22)
            if fold == 0:
                colour = shade(colour, 0.84)
            elif fold == 2:
                colour = shade(colour, 1.08)
            if x > cx + half - 3:
                colour = shade(colour, 0.74)
            px(img, x, y, colour)
    # shoulders and hood
    for i in range(10):
        half = int(11 - i * 0.4)
        for x in range(cx - half, cx + half):
            px(img, x, base_y - 76 - i, mix(IRON, MARBLE_DARK, 0.35 + i / 26))
    for i in range(12):
        half = int(8 - i * 0.5)
        for x in range(cx - half, cx + half):
            px(img, x, base_y - 87 - i, mix(IRON, MARBLE_PALE, 0.18 + i / 30))
    rect(img, cx - 4, base_y - 82, 9, 5, (16, 16, 20))
    px(img, cx - 2, base_y - 80, COLD_LIGHT)
    px(img, cx + 2, base_y - 80, COLD_LIGHT)
    # scythe: shaft, then the blade sweeping left
    vline(img, cx + 13, base_y - 88, 76, IRON)
    vline(img, cx + 14, base_y - 88, 76, IRON_LIGHT)
    for i in range(20):
        a = math.radians(200 + i * 5)
        for k in range(3):
            px(img, int(cx + 13 + math.cos(a) * (14 + k)),
               int(base_y - 96 + math.sin(a) * (12 + k)), IRON_LIGHT if k else IRON)
    glow(img, cx, base_y - 78, 11, 12, COLD_LIGHT, 60, steps=3)
    return finish(img)


def prop_bier(seed: int = 4):
    """A stone bier: where the honoured dead lay in state."""
    w, h = 60, 34
    img = new(w, h)
    block(img, 2, h - 20, w - 4, 8, MARBLE_LIGHT)
    hline(img, 2, h - 20, w - 4, MARBLE_PALE)
    rect(img, 6, h - 12, 5, 10, MARBLE_BASE)
    rect(img, w - 11, h - 12, 5, 10, MARBLE_BASE)
    for i in range(4):
        rect(img, 10 + i * 12, h - 26, 8, 6, MARBLE_DARK)
    return finish(img)


def prop_grille(seed: int = 5):
    """An iron grille over a niche: the Reaper wing's recurring motif."""
    w, h = 34, 62
    img = new(w, h)
    rect(img, 2, 2, w - 4, h - 6, IRON_DARK)
    for i in range(2, w - 2, 5):
        vline(img, i, 2, h - 6, IRON)
        vline(img, i + 1, 2, h - 6, IRON_LIGHT)
    for y in range(6, h - 6, 10):
        hline(img, 2, y, w - 4, IRON)
    # something behind the bars: a pale figure, low contrast but present
    for i in range(10):
        half = int(4 - abs(5 - i) * 0.5)
        for x in range(17 - half, 17 + half):
            px(img, x, 18 + i, BONE_DARK if (x + i) % 3 else BONE)
    for i in range(14):
        half = int(2 + i * 0.5)
        for x in range(17 - half, 17 + half):
            if (x * 3 + i) % 5:
                px(img, x, 28 + i, shade(BONE_DARK, 0.86))
    glow(img, 17, 26, 7, 9, COLD_LIGHT, 50, steps=3)
    return finish(img, shadow=False)


def prop_censer(seed: int = 6):
    """A hanging censer: a pierced bowl on three chains, still smoking."""
    w, h = 28, 58
    img = new(w, h)
    cx = w // 2
    ring_y = 8
    hline(img, cx - 5, ring_y, 11, IRON_LIGHT)
    for dx in (-5, 0, 5):
        for i in range(14):
            px(img, cx + dx + int(i * (dx / 22)), ring_y + 1 + i, IRON if i % 2 else IRON_LIGHT)
    bowl_top = ring_y + 16
    for y in range(bowl_top, bowl_top + 12):
        t = (y - bowl_top) / 12.0
        half = int(9 - t * 5)
        for x in range(cx - half, cx + half):
            lit = x < cx - 1
            colour = GILT_LIGHT if lit else (GILT if x < cx + 2 else GILT_DARK)
            if (x + y) % 4 == 0 and 1 < y - bowl_top < 10:
                colour = shade(colour, 0.82)
            px(img, x, y, colour)
    hline(img, cx - 9, bowl_top, 19, GILT_LIGHT)
    hline(img, cx - 9, bowl_top + 1, 19, GILT)
    # smoke
    for i in range(10):
        px(img, cx - 3 + (i % 3) - 1, bowl_top - 3 - i, shade(ROSE_LIGHT, 0.9) if i % 3 else (120, 100, 110))
    glow(img, cx, bowl_top + 5, 9, 9, ROSE_LIGHT, 80, steps=3)
    return finish(img, shadow=False)


def prop_candlestand(seed: int = 7):
    w, h = 22, 66
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    block(img, 4, base_y - 6, 14, 6, GILT_DARK)
    vline(img, cx, 12, base_y - 18, GILT)
    vline(img, cx + 1, 12, base_y - 18, GILT_DARK)
    for y in (24, 38):
        hline(img, cx - 6, y, 13, GILT_LIGHT)
        for dx in (-6, 6):
            vline(img, cx + dx, y - 6, 6, GILT)
            rect(img, cx + dx - 1, y - 9, 3, 4, MARBLE_PALE)
            px(img, cx + dx, y - 10, ROSE_LIGHT)
    rect(img, cx - 1, 4, 3, 5, MARBLE_PALE)
    px(img, cx, 2, ROSE_LIGHT)
    glow(img, cx, 6, 9, 9, ROSE_LIGHT, 90, steps=3)
    return finish(img)


# --- props: the Vampire wing ------------------------------------------------
def prop_drape(seed: int = 8):
    """A wine velvet hanging with a gilt rod: the east wing's signature."""
    w, h = 40, 100
    img = new(w, h)
    cx = w // 2
    block(img, 1, 4, w - 2, 4, GILT)
    hline(img, 1, 4, w - 2, GILT_LIGHT)
    px(img, 2, 2, GILT_LIGHT)
    px(img, w - 3, 2, GILT_LIGHT)
    for y in range(10, 94):
        t = (y - 10) / 84
        half = int(15 - t * 1.5)
        for x in range(cx - half, cx + half):
            # vertical folds: three lights and three darks across the cloth
            fold = math.sin((x - cx) / 3.0 + t * 0.6)
            base = (shade(WINE_LIGHT, 1.10) if fold > 0.80 else
                    WINE_LIGHT if fold > 0.30 else
                    WINE if fold > -0.35 else WINE_DARK)
            if (x + y * 3) % 37 == 0:
                base = shade(base, 1.18)
            px(img, x, y, base)
    # torn hem: the wing is damaged, not merely dark
    for x in range(cx - 15, cx + 16):
        cut = 2 + int(_h01(seed, x, 3) * 5)
        for y in range(94 - cut, 96):
            px(img, x, y, (0, 0, 0, 0)) if False else None
    # gilt fringe
    for x in range(cx - 15, cx + 16, 2):
        px(img, x, 93, GILT)
    # a heraldic bat on the field
    for i in range(9):
        px(img, cx - 8 + i, 50 + abs(i - 4) // 2, GILT_DARK)
        px(img, cx + 8 - i, 50 + abs(i - 4) // 2, GILT_DARK)
    return finish(img, shadow=False)


def prop_mirror(seed: int = 9):
    """A cracked gilt mirror, still reflecting something."""
    w, h = 40, 62
    img = new(w, h)
    frame_box(img, 1, 1, w - 2, h - 2, GILT_DARK)
    frame_box(img, 3, 3, w - 6, h - 6, GILT)
    frame_box(img, 5, 5, w - 10, h - 10, GILT_LIGHT)
    rect(img, 7, 7, w - 14, h - 14, (58, 62, 74))
    for y in range(8, h - 8):
        for x in range(8, w - 8):
            t = (x + y) / (w + h)
            px(img, x, y, mix((40, 44, 56), (96, 104, 120), 1.0 - abs(t - 0.45)))
    # cracks: everything radiates from one impact, high and left of centre
    ix, iy = 15, 17
    for i in range(6):
        a = math.radians(18 + i * 47)
        for r in range(2, 34):
            x = int(ix + math.cos(a) * r + math.sin(r / 4.0 + i) * 1.6)
            y = int(iy + math.sin(a) * r)
            if 8 <= x < w - 8 and 8 <= y < h - 8:
                px(img, x, y, MARBLE_PALE)
    for i in range(2):
        for r in range(2, 16):
            px(img, ix + r, iy + 4 + (r * 3 % 5), shade(MARBLE_PALE, 0.88))
    arc(img, 15, 20, 6, 0, 360, WINE_DARK, 2)
    glow(img, w // 2, 24, 12, 12, ROSE_LIGHT, 40, steps=3)
    return finish(img, shadow=False)


def prop_fountain(seed: int = 10):
    """The wine fountain: three bowls, overflowing, and it has not been cleaned."""
    w, h = 66, 88
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    # octagonal foot
    block(img, 6, base_y - 16, w - 12, 16, MARBLE_BASE, bevel=1)
    block(img, 10, base_y - 21, w - 20, 6, MARBLE_LIGHT)
    tiers = ((base_y - 21, 19, 13), (base_y - 49, 13, 11), (base_y - 71, 8, 9))
    for (yy, half, depth) in tiers:
        # bowl: an elliptical rim over a dark interior over a curved belly
        for i in range(depth):
            t = i / float(depth)
            spread = int(half * (1.0 - t * 0.35))
            for x in range(cx - spread, cx + spread):
                lit = x < cx - 2
                colour = (MARBLE_PALE if i == 0 else
                          MARBLE_LIGHT if i < 2 else
                          MARBLE_BASE if lit else shade(MARBLE_DARK, 0.94))
                px(img, x, yy - depth + i, colour)
        rect(img, cx - half + 2, yy - depth + 2, half * 2 - 4, 2, WINE_DARK)
        hline(img, cx - half, yy - depth, half * 2, MARBLE_PALE)
        hline(img, cx - half, yy, half * 2, shade(MARBLE_DARK, 0.88))
        for x in range(cx - half + 1, cx + half, 3):
            px(img, x, yy - 1, shade(MARBLE_BASE, 1.08))
    # neck between bowls, with the wine running down it
    for (y0, y1) in ((base_y - 71, base_y - 49), (base_y - 49, base_y - 21)):
        half = 4 if y1 - y0 > 20 else 5
        rect(img, cx - half, y0, half * 2, y1 - y0, MARBLE_LIGHT)
        vline(img, cx + half - 1, y0, y1 - y0, shade(MARBLE_DARK, 0.92))
        for y in range(y0 + 2, y1 - 4, 2):
            px(img, cx - 1, y, WINE if y % 5 else WINE_LIGHT)
            px(img, cx + 1, y, WINE_DARK)
    # spill down the foot in three tongues
    for tongue, dx in enumerate((-9, 0, 7)):
        for i in range(14 - tongue * 3):
            px(img, cx + dx + (i % 2), base_y - 19 + i, WINE_DARK if i % 3 else WINE)
    rect(img, cx - 2, base_y - 80, 5, 7, GILT)
    px(img, cx, base_y - 82, GILT_LIGHT)
    glow(img, cx, base_y - 62, 17, 12, ROSE_LIGHT, 55, steps=3)
    return finish(img)


def prop_banquet(seed: int = 11):
    """A banquet table left standing: plates, cups, a knocked chair."""
    w, h = 76, 46
    img = new(w, h)
    base_y = h - 3
    # trestles
    rect(img, 8, base_y - 14, 6, 12, shade(MARBLE_DARK, 0.9))
    rect(img, w - 14, base_y - 14, 6, 12, shade(MARBLE_DARK, 0.9))
    # cloth over the top and down the front
    rect(img, 3, base_y - 24, w - 6, 8, WINE)
    for x in range(4, w - 4, 5):
        vline(img, x, base_y - 24, 8, WINE_DARK)
    hline(img, 3, base_y - 24, w - 6, WINE_LIGHT)
    rect(img, 5, base_y - 16, w - 10, 5, shade(WINE, 0.86))
    for x in range(6, w - 6, 7):
        px(img, x, base_y - 12, GILT)
    # table top
    rect(img, 3, base_y - 28, w - 6, 5, MARBLE_LIGHT)
    hline(img, 3, base_y - 28, w - 6, MARBLE_PALE)
    # plates, cups, a spilled goblet
    for i in range(4):
        x = 10 + i * 15
        rect(img, x, base_y - 32, 8, 4, MARBLE_PALE)
        px(img, x + 4, base_y - 30, WINE_LIGHT)
        vline(img, x + 11, base_y - 37, 6, GILT)
        rect(img, x + 10, base_y - 38, 4, 2, GILT_LIGHT)
    rect(img, w - 20, base_y - 34, 7, 4, GILT_DARK)
    return finish(img)


def prop_bench_stone(seed: int = 15):
    """A plain slab bench: the approach and the vault have no velvet."""
    w, h = 48, 26
    img = new(w, h)
    base_y = h - 3
    block(img, 2, base_y - 8, w - 4, 8, MARBLE_BASE, bevel=1)
    block(img, 1, base_y - 13, w - 2, 6, MARBLE_LIGHT)
    hline(img, 1, base_y - 13, w - 2, MARBLE_PALE)
    rect(img, 5, base_y - 6, 4, 5, shade(MARBLE_DARK, 0.88))
    rect(img, w - 9, base_y - 6, 4, 5, shade(MARBLE_DARK, 0.88))
    return finish(img)


def prop_throne_bench(seed: int = 12):
    """A velvet bench: the east wing's seating, gilt and worn."""
    w, h = 52, 34
    img = new(w, h)
    base_y = h - 3
    block(img, 2, base_y - 8, w - 4, 8, GILT_DARK)
    rect(img, 4, base_y - 18, w - 8, 11, WINE)
    for x in range(5, w - 6, 4):
        vline(img, x, base_y - 18, 11, WINE_DARK)
    hline(img, 4, base_y - 18, w - 8, WINE_LIGHT)
    block(img, w - 15, base_y - 32, 14, 16, GILT_DARK)
    rect(img, w - 13, base_y - 30, 10, 12, WINE)
    vline(img, w - 10, base_y - 30, 12, WINE_DARK)
    hline(img, w - 13, base_y - 30, 10, WINE_LIGHT)
    px(img, w - 8, base_y - 33, GILT_LIGHT)
    return finish(img)


def prop_goblets(seed: int = 13):
    w, h = 28, 24
    img = new(w, h)
    for i, (x, y) in enumerate(((4, h - 10), (11, h - 8), (18, h - 11))):
        for k in range(5):
            half = 3 - k // 3
            for dx in range(-half, half + 1):
                px(img, x + dx, y - k, GILT if k else GILT_LIGHT)
        vline(img, x, y + 1, 3, GILT_DARK)
        px(img, x, y - 4, WINE_LIGHT)
    rect(img, 2, h - 6, 24, 4, MARBLE_LIGHT)
    return finish(img)


def prop_broken_column(seed: int = 14):
    w, h = 56, 24
    img = new(w, h)
    for (x, ww, hh) in ((3, 24, 16), (22, 17, 11), (38, 16, 13)):
        block(img, x, h - 4 - hh, ww, hh, MARBLE_BASE, bevel=1)
        for yy in range(h - 4 - hh + 2, h - 4, 4):
            hline(img, x + 1, yy, ww - 2, shade(MARBLE_BASE, 0.88))
        hline(img, x, h - 4 - hh, ww, MARBLE_PALE)
        for i in range(ww - 6):
            px(img, x + 2 + i, h - 4 - hh - 1 - (i % 3), MARBLE_LIGHT)
    for i in range(4):
        px(img, 26 + i * 3, 8 + i, MARBLE_PALE)
    return finish(img)


# --- wall overlays ---------------------------------------------------------
def _wall_niche():
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(MARBLE_LIGHT, 0.98))
    courses(img, 0, 0, T, T, shade(MARBLE_LIGHT, 0.98), row_h=8, seed=71, mortar=MORTAR)
    rect(img, 5, 0, 6, T, shade(MARBLE_DARK, 0.62))
    rect(img, 6, 0, 4, T, (26, 28, 32))
    vline(img, 4, 0, T, MARBLE_PALE)
    vline(img, 11, 0, T, shade(MARBLE_DARK, 0.9))
    px(img, 8, 6, COLD_LIGHT)
    return img


def _wall_gilt():
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(MARBLE_LIGHT, 1.02))
    courses(img, 0, 0, T, T, shade(MARBLE_LIGHT, 1.02), row_h=8, seed=73, mortar=MORTAR)
    rect(img, 0, 5, T, 6, WINE_DARK)
    hline(img, 0, 5, T, WINE)
    hline(img, 0, 10, T, WINE)
    for x in (3, 12):
        vline(img, x, 5, 6, GILT)
    hline(img, 0, 4, T, GILT_DARK)
    hline(img, 0, 11, T, GILT_DARK)
    return img


def _wall_iron_band():
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(MARBLE_LIGHT, 0.94))
    courses(img, 0, 0, T, T, shade(MARBLE_LIGHT, 0.94), row_h=8, seed=77, mortar=MORTAR)
    rect(img, 0, 7, T, 3, IRON)
    hline(img, 0, 7, T, IRON_LIGHT)
    hline(img, 0, 9, T, IRON_DARK)
    for x in (2, 9):
        rect(img, x, 5, 2, 6, IRON_LIGHT)
    return img


def build_tiles() -> list:
    tiles = [("bedrock_a", lambda: rock(7)), ("bedrock_b", lambda: rock(13))]
    for quad, name in enumerate(("floor_a", "floor_b", "floor_c", "floor_d")):
        tiles.append((name, lambda q=quad: marble(29, q)))
    tiles.append(("floor_worn", lambda: marble(31, 0, tone=0.90)))
    tiles.append(("floor_broken", lambda: marble(37, 1, tone=0.94)))
    tiles.append(("shadow_edge", lambda: shadow_tile(94)))
    tiles.append(("wall_plinth", lambda: wall_plinth_tile(shade(MARBLE_LIGHT, 0.94), IRON)))
    tiles.append(("wall_field_a", lambda: wall_field_tile(41, shade(MARBLE_LIGHT, 1.02), MORTAR)))
    tiles.append(("wall_field_b", lambda: wall_field_tile(43, shade(MARBLE_LIGHT, 0.94), MORTAR)))
    tiles.append(("wall_dado_a", lambda: wall_field_tile(47, shade(MARBLE_PALE, 0.94), MORTAR, dado=True)))
    tiles.append(("wall_pier", lambda: wall_field_tile(53, shade(MARBLE_LIGHT, 1.06), MORTAR, pier=True)))
    tiles.append(("wall_cornice", lambda: wall_cornice_tile(shade(GILT, 0.9), MARBLE_LIGHT)))
    tiles.append(("wall_cap", lambda: wall_cap_tile(shade(MARBLE_PALE, 0.90), MARBLE_LIGHT)))
    tiles.append(("wall_niche", lambda: _wall_niche()))
    tiles.append(("wall_gilt", lambda: _wall_gilt()))
    tiles.append(("wall_iron", lambda: _wall_iron_band()))
    for direction in ("h", "v"):
        tiles.append(("inlay_" + direction, lambda d=direction: inlay(d, 17)))
        tiles.append(("cold_inlay_" + direction, lambda d=direction: cold_inlay(d, 23)))
    for quad, name in enumerate(("cold_a", "cold_b", "cold_c", "cold_d")):
        tiles.append((name, lambda q=quad: cold_slab(59, q)))
    for quad, name in enumerate(("wine_a", "wine_b", "wine_c", "wine_d")):
        tiles.append((name, lambda q=quad: wine_slab(61, q)))
    for name, image in disc_tiles(3, True).items():
        tiles.append((("cold_" + name), lambda i=image: i.copy()))
    for name, image in disc_tiles(3, False).items():
        tiles.append((("wine_" + name), lambda i=image: i.copy()))
    return tiles


def prop_gate_frame(seed: int = 16):
    """The exit: a pointed arch with a dark opening, voussoirs and a threshold.

    Drawn as an opening rather than a frame, because a rectangle of stone with a
    hole in it reads as a window from any distance.
    """
    w, h = 60, 84
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    # piers
    for y in range(34, base_y):
        for x in range(4, 14):
            px(img, x, y, MARBLE_BASE if x < 9 else shade(MARBLE_BASE, 0.9))
            px(img, w - 1 - x, y, MARBLE_BASE if x < 9 else shade(MARBLE_BASE, 0.9))
    # the opening, lit from inside
    for y in range(18, base_y):
        if y < 34:
            half = int(14 * math.sqrt(max(0.0, 1 - ((34 - y) / 16.0) ** 2)))
        else:
            half = 14
        for x in range(cx - half, cx + half):
            depth = abs(x - cx) / max(1, half)
            px(img, x, y, mix((10, 12, 18), (54, 66, 86), depth * 0.8))
    # voussoirs round the arch
    for step in range(26):
        a = math.pi * (step / 25.0)
        bx = int(cx - math.cos(a) * 20)
        by = int(34 - math.sin(a) * 20)
        for k in range(4):
            px(img, bx, by - k, MARBLE_PALE if k == 0 else MARBLE_LIGHT)
            px(img, bx + 1, by - k, MARBLE_LIGHT if k < 2 else MARBLE_BASE)
    # keystone and threshold
    rect(img, cx - 4, 10, 9, 9, MARBLE_PALE)
    hline(img, cx - 5, 10, 11, MARBLE_LIGHT)
    block(img, 2, base_y - 5, w - 4, 5, MARBLE_LIGHT, bevel=1)
    hline(img, 2, base_y - 6, w - 4, MARBLE_PALE)
    # two lamps in the opening
    for x in (cx - 8, cx + 6):
        rect(img, x, 40, 3, 4, GILT)
        px(img, x + 1, 39, GILT_LIGHT)
    glow(img, cx, 44, 18, 22, (238, 244, 255), 70, steps=4)
    return finish(img)


def build_props() -> list:
    return [
        ("column", lambda: prop_column()),
        ("column_broken", lambda: prop_column(broken=True)),
        ("sarcophagus", lambda: prop_sarcophagus()),
        ("sarcophagus_open", lambda: prop_sarcophagus(open_lid=True)),
        ("reaper_statue", lambda: prop_reaper_statue()),
        ("bier", lambda: prop_bier()),
        ("grille", lambda: prop_grille()),
        ("censer", lambda: prop_censer()),
        ("candlestand", lambda: prop_candlestand()),
        ("drape", lambda: prop_drape()),
        ("mirror", lambda: prop_mirror()),
        ("fountain", lambda: prop_fountain()),
        ("banquet", lambda: prop_banquet()),
        ("velvet_bench", lambda: prop_throne_bench()),
        ("goblets", lambda: prop_goblets()),
        ("bench_stone", lambda: prop_bench_stone()),
        ("gate_frame", lambda: prop_gate_frame()),
        ("rubble", lambda: prop_broken_column()),
    ]


def main() -> None:
    write_kit(ART, KIT, build_tiles(), build_props(), light_colour=(236, 226, 255))


if __name__ == "__main__":
    main()
