#!/usr/bin/env python3
"""Level 10 — The Castellan's Throne. Kit art.

The top of the chapter, so the room is the most formal in it: violet-charcoal
marble, gold leaf, a crimson carpet down the axis, and cold moon-teal light falling
where the portal is. It has to be a different world from the reliquary's wine-and-
gilt marble that came two levels earlier, so the violet is cool and grey rather
than warm, the gold is thin leaf rather than mass, and the light is moonlight
instead of candlelight.

Two things carry the level's readability without touching its mechanics:

* **The throne and its dais** — a colossal seat on a three-tier platform at the
  head of the arena, wide rather than tall because the camera stops at the map edge
  and a throne taller than the frame is a wall.
* **The carpet and the cross** — a crimson runner up the processional axis, and a
  cross of plain paving inside the arena marking the crossing lanes of the fight.

Run: python3 tools/level10/art_castellan.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, T, _h01, block, courses, dither, finish, flag_quadrant, glow, hline, mix,
    new, px, rect, rock_tile, shade, shadow_tile, vline, wall_cap_tile,
    wall_cornice_tile, wall_field_tile, wall_plinth_tile, write_kit,
)

ART = os.path.join(ROOT, "assets", "environment", "chapter1", "castellan")
KIT = "castellan"

# --- palette ---------------------------------------------------------------
MARBLE_DARK = (48, 42, 64)
MARBLE_BASE = (84, 76, 104)
MARBLE_LIGHT = (120, 110, 140)
MARBLE_PALE = (158, 148, 178)
JOINT = (44, 38, 56)
ROCK_DARK = (66, 58, 76)
ROCK_BASE = (88, 78, 100)
ROCK_LIGHT = (112, 100, 126)

GOLD_DARK = (118, 86, 34)
GOLD = (176, 138, 62)
GOLD_LIGHT = (228, 196, 120)
GOLD_PALE = (250, 228, 168)
CARPET_DARK = (74, 18, 34)
CARPET = (114, 28, 46)
CARPET_LIGHT = (156, 48, 64)
TEAL = (144, 208, 214)
TEAL_LIGHT = (206, 240, 242)
CANDLE = (255, 212, 148)
IRON = (58, 54, 66)
IRON_DARK = (34, 32, 42)


def arc(img, cx, cy, r, a0, a1, colour, thickness=1.0) -> None:
    steps = max(8, int(abs(a1 - a0) * r))
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        for k in range(max(1, int(thickness))):
            px(img, int(cx + math.cos(a) * (r + k)), int(cy + math.sin(a) * (r + k)), colour)


# --- tiles -----------------------------------------------------------------
def rock(seed: int):
    return rock_tile(seed, ROCK_DARK, ROCK_BASE, ROCK_LIGHT)


def marble(seed: int, quad: int, *, tone: float = 1.0):
    """Cool violet marble, cut in large slabs with a soft joint."""
    img = flag_quadrant(seed, quad, MARBLE_BASE, mix(JOINT, MARBLE_BASE, 0.3), tone=tone)
    if quad in (0, 3):
        hline(img, 0, 1, T, shade(MARBLE_BASE, 1.12))
    if quad in (0, 1):
        vline(img, 1, 0, T, shade(MARBLE_BASE, 1.07))
    # a vein of gold-bearing quartz, rarely
    if _h01(seed, quad, 5) < 0.22:
        x = 3 + int(_h01(seed, quad, 1) * 9)
        for y in range(2, T - 2):
            px(img, x, y, shade(MARBLE_PALE, 0.96))
            if _h01(seed, quad, 2, y) > 0.7:
                x += 1 if _h01(seed, quad, 3, y) > 0.5 else -1
            x = max(2, min(T - 3, x))
    return img


def carpet(direction: str, seed: int, *, end: bool = False):
    """The crimson runner: a gold border, a woven field, and worn pile."""
    img = marble(seed, 0, tone=0.86)
    if direction == "v":
        rect(img, 2, 0, 12, T, CARPET)
        vline(img, 2, 0, T, GOLD_DARK)
        vline(img, 3, 0, T, GOLD)
        vline(img, 12, 0, T, GOLD)
        vline(img, 13, 0, T, GOLD_DARK)
    else:
        rect(img, 0, 2, T, 12, CARPET)
        hline(img, 0, 2, T, GOLD_DARK)
        hline(img, 0, 3, T, GOLD)
        hline(img, 0, 12, T, GOLD)
        hline(img, 0, 13, T, GOLD_DARK)
    # woven diagonals in the field
    for y in range(T):
        for x in range(T):
            inside = (2 <= x <= 13) if direction == "v" else (2 <= y <= 13)
            if not inside:
                continue
            if direction == "v" and not (3 <= x <= 12):
                continue
            if direction == "h" and not (3 <= y <= 12):
                continue
            fx, fy = (x, y) if direction == "v" else (y, x)
            if (fx + fy) % 6 == 0:
                px(img, x, y, CARPET_LIGHT)
            elif (fx + fy) % 7 == 0:
                px(img, x, y, CARPET_DARK)
    if end:
        for x in range(T):
            for y in range(T):
                if 2 <= x <= 13:
                    px(img, x, y, CARPET) if False else None
    return img


def aisle(seed: int, quad: int):
    """The processional paving: marble with a gold inlay down the middle."""
    img = marble(seed, quad, tone=1.02)
    if quad in (0, 1):
        hline(img, 0, 4, T, GOLD_DARK)
        hline(img, 0, 5, T, GOLD_LIGHT)
    return img


def aisle_broken(seed: int, quad: int):
    """The aisle has been fought on: cracked, sunken, missing a stone."""
    img = marble(seed, quad, tone=0.9)
    for i in range(3):
        x = 2 + int(_h01(seed, quad, i, 3) * 11)
        y = 2 + int(_h01(seed, quad, i, 5) * 11)
        for k in range(4):
            px(img, x + k, y + (k // 2), mix(MARBLE_BASE, JOINT, 0.55))
    rect(img, 5, 6, 5, 4, mix(JOINT, MARBLE_DARK, 0.4))
    hline(img, 5, 6, 5, shade(MARBLE_PALE, 0.94))
    return img


def lane(seed: int, quad: int):
    """The crossing lanes of the fight: plainer, paler, uncluttered paving."""
    img = marble(seed, quad, tone=1.08)
    for y in range(T):
        px(img, 0, y, mix(MARBLE_PALE, JOINT, 0.25))
    return img


def _wall_block(seed: int, tone: float):
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(MARBLE_LIGHT, tone))
    courses(img, 0, 0, T, T, shade(MARBLE_LIGHT, tone), row_h=8, seed=seed, mortar=JOINT)
    return img


def wall_gold():
    """A gold-leaf frieze: the throne room's only decoration."""
    img = _wall_block(31, 1.0)
    rect(img, 0, 6, T, 5, GOLD_DARK)
    hline(img, 0, 6, T, GOLD)
    hline(img, 0, 7, T, GOLD_LIGHT)
    hline(img, 0, 10, T, GOLD)
    for x in range(1, T, 5):
        px(img, x, 8, GOLD_PALE)
        px(img, x + 2, 9, GOLD_DARK)
    return img


def wall_window():
    """A tall window with moonlight behind it: phase two is told in wall art."""
    img = _wall_block(37, 0.94)
    rect(img, 5, 0, 6, T, (24, 32, 44))
    rect(img, 6, 0, 4, T, mix((40, 62, 78), TEAL, 0.35))
    vline(img, 5, 0, T, GOLD_DARK)
    vline(img, 10, 0, T, GOLD_DARK)
    for y in (4, 11):
        hline(img, 5, y, 6, GOLD)
    return img


# --- props -----------------------------------------------------------------
def prop_throne(seed: int = 1):
    """The Castellan's seat: colossal by width, built out of four big shapes.

    A small, detailed throne reads as furniture. This one is a back, two fins, a
    seat and two arms, each of them at least two cells across, so it is legible
    from the far end of the arena at gameplay zoom.
    """
    w, h = 176, 120
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    # platform: two steps under the seat
    block(img, 2, base_y - 12, w - 4, 12, MARBLE_LIGHT, bevel=2)
    block(img, 14, base_y - 20, w - 28, 9, MARBLE_BASE, bevel=1)
    hline(img, 14, base_y - 21, w - 28, MARBLE_PALE)
    # the canopy fins: two swept horns rising from the back corners
    for side in (-1, 1):
        for i in range(22):
            x = cx + side * (52 + i * 2)
            if not (0 <= x < w):
                continue
            top = 26 + i
            for y in range(top, base_y - 20):
                px(img, x, y, MARBLE_BASE if i % 4 else MARBLE_DARK)
                px(img, x, y, MARBLE_BASE) if False else None
            hline(img, x, top, 2, GOLD)
        for i in range(5):
            px(img, cx + side * (52 + i * 2), 24 - i, GOLD_LIGHT)
    # the back: one slab, three carved panels, a gold rim
    back_x, back_w, back_top = cx - 52, 105, 20
    block(img, back_x, back_top, back_w, base_y - 26 - back_top, MARBLE_BASE, bevel=2)
    for panel in range(3):
        px0 = back_x + 8 + panel * 33
        rect(img, px0, back_top + 8, 26, base_y - 46 - back_top, shade(MARBLE_DARK, 1.12))
        vline(img, px0, back_top + 8, base_y - 46 - back_top, MARBLE_PALE)
        vline(img, px0 + 25, back_top + 8, base_y - 46 - back_top, JOINT)
        for i in range(20):
            px(img, px0 + 4 + i, back_top + 12 + i // 3, MARBLE_LIGHT)
        rect(img, px0 + 9, back_top + 12, 9, 9, GOLD_DARK)
        px(img, px0 + 13, back_top + 14, GOLD_LIGHT)
    hline(img, back_x, back_top, back_w, GOLD_LIGHT)
    hline(img, back_x, back_top + 1, back_w, GOLD)
    # the crest: a gold crown above the middle panel
    for i in range(13):
        half = int(13 - abs(6 - i) * 1.4)
        for x in range(cx - half, cx + half):
            px(img, x, 6 + i, GOLD_LIGHT if (x + i) % 4 else GOLD)
    for dx in (-9, 0, 9):
        rect(img, cx + dx - 1, 4, 3, 5, GOLD_PALE)
    # arms: two thick blocks with gold knobs
    for side in (-1, 1):
        x = cx + side * 56
        block(img, x - 8, base_y - 44, 17, 24, MARBLE_PALE, bevel=2)
        rect(img, x - 6, base_y - 42, 13, 4, GOLD)
        block(img, x - 6, base_y - 22, 13, 12, MARBLE_BASE, bevel=1)
    # seat and its crimson cushion
    block(img, cx - 40, base_y - 32, 81, 12, MARBLE_LIGHT, bevel=2)
    rect(img, cx - 36, base_y - 38, 73, 8, CARPET)
    hline(img, cx - 36, base_y - 38, 73, CARPET_LIGHT)
    for x in range(cx - 34, cx + 35, 4):
        px(img, x, base_y - 31, GOLD_DARK)
    glow(img, cx, base_y - 46, 34, 20, CANDLE, 40, steps=3)
    return finish(img)


def prop_column(seed: int = 2, *, broken: bool = False):
    """A heavy fluted column with a gold capital: the throne room's order."""
    w, h = 48, (150 if not broken else 74)
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    block(img, 2, base_y - 12, w - 4, 12, MARBLE_LIGHT, bevel=2)
    block(img, 6, base_y - 17, w - 12, 6, MARBLE_BASE)
    top = 26 if not broken else 30
    half = 13
    for y in range(top, base_y - 17):
        for x in range(cx - half, cx + half):
            t = (x - (cx - half)) / (half * 2.0)
            colour = (MARBLE_PALE if t < 0.12 else MARBLE_LIGHT if t < 0.42 else
                      MARBLE_BASE if t < 0.8 else shade(MARBLE_DARK, 1.1))
            for gx in (-6, 0, 6):
                if x == cx + gx:
                    colour = shade(colour, 0.9)
            px(img, x, y, colour)
    if broken:
        for i in range(26):
            px(img, cx - half + i, top + (i * 5 % 5), MARBLE_PALE)
            px(img, cx - half + i, top + 1 + (i * 5 % 5), shade(MARBLE_DARK, 0.9))
    else:
        # capital: gold abacus, echinus, and a ring of leaf
        block(img, 1, top - 9, w - 2, 7, GOLD_DARK, bevel=1)
        hline(img, 1, top - 9, w - 2, GOLD_LIGHT)
        block(img, 5, top - 3, w - 10, 4, GOLD)
        for i in range(6):
            px(img, cx - 10 + i * 4, top - 4, GOLD_LIGHT)
    return finish(img)


def prop_portal_arch(seed: int = 3):
    """The chapter's completion portal: a tall arch full of cold light."""
    w, h = 152, 142
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    half_open = 34
    spring = 62
    # piers
    for side in (-1, 1):
        inner = cx + side * half_open
        outer = inner + side * 26
        x0, x1 = sorted((inner, outer))
        for y in range(26, base_y):
            for x in range(x0, x1):
                t = (x - x0) / 26.0
                colour = MARBLE_PALE if t < 0.2 else MARBLE_LIGHT if t < 0.6 else MARBLE_BASE
                if (y - 26) % 20 in (0, 1):
                    colour = shade(colour, 0.72)
                px(img, x, y, colour)
    # the opening: a pointed well of teal light
    for y in range(12, base_y):
        if y < spring:
            half = int(half_open * math.sqrt(max(0.0, 1 - ((spring - y) / (spring - 12)) ** 2)))
        else:
            half = half_open
        for x in range(cx - half, cx + half):
            t = abs(x - cx) / max(1, half)
            px(img, x, y, mix(TEAL_LIGHT, (34, 52, 68), t * 0.85))
    # a gold rim round the opening
    for step in range(36):
        a = math.pi * (step / 35.0)
        bx = int(cx - math.cos(a) * (half_open + 4))
        by = int(spring - math.sin(a) * (half_open + 4) * 1.2)
        for k in range(3):
            px(img, bx, by + k, GOLD_LIGHT if k == 0 else GOLD)
    # steps at the threshold
    block(img, 4, base_y - 9, w - 8, 9, MARBLE_LIGHT, bevel=1)
    hline(img, 4, base_y - 10, w - 8, MARBLE_PALE)
    # finials
    for side in (-1, 1):
        x = cx + side * (half_open + 13)
        rect(img, x - 2, 18, 5, 8, GOLD)
        px(img, x, 16, GOLD_LIGHT)
    glow(img, cx, 74, 30, 34, TEAL, 60, steps=4)
    return finish(img)


def prop_portal_pillar(seed: int = 4):
    """The pillars either side of the portal: gold-banded, moon-lit."""
    w, h = 40, 138
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    block(img, 2, base_y - 14, w - 4, 14, MARBLE_LIGHT, bevel=2)
    half = 10
    for y in range(20, base_y - 14):
        for x in range(cx - half, cx + half):
            t = (x - (cx - half)) / (half * 2.0)
            colour = (MARBLE_PALE if t < 0.14 else MARBLE_LIGHT if t < 0.45 else
                      MARBLE_BASE if t < 0.82 else shade(MARBLE_DARK, 1.08))
            px(img, x, y, colour)
    for y in (36, 68, 100):
        hline(img, cx - half, y, half * 2, GOLD_DARK)
        hline(img, cx - half, y + 1, half * 2, GOLD)
    block(img, 2, 12, w - 4, 8, GOLD_DARK, bevel=1)
    hline(img, 2, 12, w - 4, GOLD_LIGHT)
    rect(img, cx - 3, 6, 7, 7, TEAL)
    px(img, cx, 5, TEAL_LIGHT)
    glow(img, cx, 8, 12, 12, TEAL, 70, steps=3)
    return finish(img)


def prop_banner(seed: int = 5, *, torn: bool = False):
    """A royal banner: crimson field, gold border, the Castellan's crest."""
    w, h = 46, 118
    img = new(w, h)
    cx = w // 2
    block(img, 0, 2, w, 5, GOLD_DARK)
    hline(img, 0, 2, w, GOLD_LIGHT)
    for y in range(9, 104):
        half = 18 if y < 96 else max(4, 18 - (y - 96) * 2)
        if torn and y > 74:
            half = max(3, 18 - int(_h01(seed, y, 3) * 12))
        for x in range(cx - half, cx + half):
            t = (x - (cx - half)) / max(1, half * 2)
            colour = (CARPET_LIGHT if t < 0.1 else CARPET if t < 0.62 else
                      shade(CARPET, 0.82))
            if (x + y * 2) % 45 == 0:
                colour = shade(colour, 1.18)
            px(img, x, y, colour)
    # gold border and crest
    rect(img, cx - 18, 9, 3, 92, GOLD_DARK)
    rect(img, cx + 15, 9, 3, 92, GOLD_DARK)
    for i in range(12):
        half = int(6 - abs(6 - i) * 0.35)
        for x in range(cx - half, cx + half):
            px(img, x, 30 + i, GOLD_LIGHT if (x + i) % 3 else GOLD)
    arc(img, cx, 58, 9, 0, 360, GOLD, 2)
    rect(img, cx - 1, 50, 3, 17, GOLD_LIGHT)
    return finish(img, shadow=False)


def prop_candelabrum(seed: int = 6):
    w, h = 34, 86
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    block(img, 6, base_y - 6, w - 12, 6, GOLD_DARK, bevel=1)
    vline(img, cx, 14, base_y - 20, GOLD)
    vline(img, cx + 1, 14, base_y - 20, GOLD_DARK)
    for y in (26, 44):
        hline(img, cx - 8, y, 17, GOLD_LIGHT)
        for dx in (-8, 8):
            vline(img, cx + dx, y - 8, 8, GOLD)
            rect(img, cx + dx - 1, y - 12, 3, 5, MARBLE_PALE)
            px(img, cx + dx, y - 14, CANDLE)
    rect(img, cx - 1, 5, 3, 7, MARBLE_PALE)
    px(img, cx, 3, CANDLE)
    glow(img, cx, 8, 11, 11, CANDLE, 80, steps=3)
    return finish(img)


def prop_statue(seed: int = 7):
    """A veiled marble figure: the Castellan's predecessors, in stone."""
    w, h = 46, 112
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    block(img, 4, base_y - 10, w - 8, 10, MARBLE_LIGHT, bevel=1)
    block(img, 8, base_y - 16, w - 16, 7, MARBLE_BASE)
    for i in range(70):
        y = base_y - 16 - i
        t = i / 70.0
        half = int(5 + t * 9)
        for x in range(cx - half, cx + half):
            u = (x - (cx - half)) / max(1, half * 2)
            colour = (MARBLE_PALE if u < 0.2 else MARBLE_LIGHT if u < 0.55 else
                      MARBLE_BASE)
            if (x + i) % 9 == 0:
                colour = shade(colour, 0.94)
            px(img, x, y, colour)
    for i in range(14):
        half = int(7 - i * 0.4)
        for x in range(cx - half, cx + half):
            px(img, x, base_y - 86 - i, mix(MARBLE_PALE, MARBLE_BASE, i / 14.0))
    rect(img, cx - 4, base_y - 80, 8, 4, shade(MARBLE_DARK, 0.7))
    arc(img, cx, base_y - 60, 12, 200, 340, GOLD_DARK, 1)
    return finish(img)


def prop_bench(seed: int = 8):
    w, h = 52, 28
    img = new(w, h)
    base_y = h - 3
    block(img, 2, base_y - 8, w - 4, 8, MARBLE_BASE, bevel=1)
    block(img, 1, base_y - 14, w - 2, 7, MARBLE_LIGHT)
    hline(img, 1, base_y - 14, w - 2, MARBLE_PALE)
    rect(img, 6, base_y - 6, 4, 5, MARBLE_DARK)
    rect(img, w - 10, base_y - 6, 4, 5, MARBLE_DARK)
    return finish(img)


def prop_rubble(seed: int = 9):
    w, h = 52, 30
    img = new(w, h)
    for (x, ww, hh) in ((2, 18, 13), (18, 15, 10), (32, 17, 12)):
        block(img, x, h - 3 - hh, ww, hh, MARBLE_BASE, bevel=1)
        for yy in range(h - 3 - hh + 2, h - 3, 4):
            hline(img, x + 1, yy, ww - 2, shade(MARBLE_BASE, 0.88))
        hline(img, x, h - 3 - hh, ww, MARBLE_PALE)
    for i in range(5):
        px(img, 22 + i * 3, 6 + i, GOLD_DARK)
    return finish(img)


def prop_censer(seed: int = 10):
    w, h = 28, 62
    img = new(w, h)
    cx = w // 2
    for i in range(16):
        px(img, cx + (i % 2), 2 + i, GOLD_DARK if i % 2 else GOLD)
    for y in range(20, 36):
        t = (y - 20) / 16.0
        half = int(9 - t * 4)
        for x in range(cx - half, cx + half):
            px(img, x, y, GOLD if x < cx else GOLD_DARK)
    hline(img, cx - 9, 20, 19, GOLD_LIGHT)
    for i in range(8):
        px(img, cx - 2 + i % 3, 36 + i, GOLD_DARK)
        px(img, cx - 3 + (i * 2) % 6, 38 + i, (120, 110, 130))
    glow(img, cx, 32, 11, 11, CANDLE, 45, steps=3)
    return finish(img, shadow=False)


def build_tiles() -> list:
    tiles = [("bedrock_a", lambda: rock(7)), ("bedrock_b", lambda: rock(13))]
    for quad, name in enumerate(("floor_a", "floor_b", "floor_c", "floor_d")):
        tiles.append((name, lambda q=quad: marble(21, q)))
    tiles.append(("floor_worn", lambda: marble(29, 0, tone=0.9)))
    tiles.append(("floor_broken", lambda: aisle_broken(31, 1)))
    tiles.append(("shadow_edge", lambda: shadow_tile(95)))
    tiles.append(("wall_plinth", lambda: wall_plinth_tile(shade(MARBLE_LIGHT, 0.94),
                                                          GOLD_DARK)))
    tiles.append(("wall_field_a", lambda: _wall_block(41, 1.02)))
    tiles.append(("wall_field_b", lambda: _wall_block(43, 0.94)))
    tiles.append(("wall_dado_a", lambda: wall_field_tile(47, shade(MARBLE_PALE, 0.94),
                                                         JOINT, dado=True)))
    tiles.append(("wall_pier", lambda: wall_field_tile(53, shade(MARBLE_LIGHT, 1.06),
                                                       JOINT, pier=True)))
    tiles.append(("wall_cornice", lambda: wall_cornice_tile(GOLD_DARK, MARBLE_LIGHT)))
    tiles.append(("wall_cap", lambda: wall_cap_tile(shade(MARBLE_PALE, 0.9), MARBLE_LIGHT)))
    tiles.append(("wall_gold", lambda: wall_gold()))
    tiles.append(("wall_window", lambda: wall_window()))
    for direction in ("h", "v"):
        tiles.append(("carpet_" + direction, lambda d=direction: carpet(d, 17)))
    for direction in ("h", "v"):
        tiles.append(("carpet_end_" + direction, lambda d=direction: carpet(d, 19, end=True)))
    for quad, name in enumerate(("aisle_a", "aisle_b", "aisle_c", "aisle_d")):
        tiles.append((name, lambda q=quad: aisle(23, q)))
    for quad, name in enumerate(("broken_a", "broken_b", "broken_c", "broken_d")):
        tiles.append((name, lambda q=quad: aisle_broken(37, q)))
    for quad, name in enumerate(("lane_a", "lane_b", "lane_c", "lane_d")):
        tiles.append((name, lambda q=quad: lane(43, q)))
    return tiles


def build_props() -> list:
    return [
        ("throne", lambda: prop_throne()),
        ("column", lambda: prop_column()),
        ("column_broken", lambda: prop_column(broken=True)),
        ("portal_arch", lambda: prop_portal_arch()),
        ("portal_pillar", lambda: prop_portal_pillar()),
        ("banner", lambda: prop_banner()),
        ("banner_torn", lambda: prop_banner(torn=True)),
        ("candelabrum", lambda: prop_candelabrum()),
        ("statue", lambda: prop_statue()),
        ("bench", lambda: prop_bench()),
        ("rubble", lambda: prop_rubble()),
        ("censer", lambda: prop_censer()),
    ]


def main() -> None:
    write_kit(ART, KIT, build_tiles(), build_props(), light_colour=(232, 244, 255))


if __name__ == "__main__":
    main()
