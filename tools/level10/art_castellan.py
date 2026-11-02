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


def carpet_field(seed: int):
    """The runner's cloth, without a border.

    Three cells wide is a runner; one cell wide is three thin rugs side by side.
    The old tile drew a gold border on every cell, so the crimson way up the axis
    read as a hatch of parallel stripes at native scale - the exact "hairline motif"
    fault the audit names on this chapter. The border now belongs to the two edge
    tiles only, and the field carries a calm woven pile: two shading bands per
    course, a stitch every four pixels, and no diagonal hatching anywhere.
    """
    img = new(T, T)
    for y in range(T):
        for x in range(T):
            r = _h01(seed, x, y)
            colour = CARPET if r < 0.62 else (CARPET_DARK if r < 0.86 else CARPET_LIGHT)
            # pile: a vertical weave, one shade apart, never brighter than the field
            if x % 4 == 0:
                colour = mix(CARPET, CARPET_DARK, 0.35)
            elif x % 4 == 2:
                colour = mix(CARPET, CARPET_LIGHT, 0.22)
            px(img, x, y, colour)
    # a gold stitch across the field every two tiles, so the runner has length
    for x in range(0, T, 4):
        px(img, x, 3, mix(GOLD, CARPET, 0.45))
        px(img, x + 2, 12, mix(GOLD, CARPET, 0.55))
    return img


def carpet_edge(side: str, seed: int):
    """A runner's edge: cloth, a gold band, and the marble it is laid on."""
    img = carpet_field(seed)
    if side == "w":
        vline(img, 0, 0, T, GOLD_DARK)
        vline(img, 1, 0, T, GOLD)
        vline(img, 2, 0, T, GOLD_DARK)
        for y in range(1, T, 5):
            px(img, 1, y, GOLD_LIGHT)
    elif side == "e":
        vline(img, T - 1, 0, T, GOLD_DARK)
        vline(img, T - 2, 0, T, GOLD)
        vline(img, T - 3, 0, T, GOLD_DARK)
        for y in range(1, T, 5):
            px(img, T - 2, y, GOLD_LIGHT)
    elif side == "n":
        hline(img, 0, 0, T, GOLD_DARK)
        hline(img, 0, 1, T, GOLD)
        hline(img, 0, 2, T, GOLD_DARK)
        for x in range(1, T, 5):
            px(img, x, 1, GOLD_LIGHT)
    else:
        hline(img, 0, T - 1, T, GOLD_DARK)
        hline(img, 0, T - 2, T, GOLD)
        hline(img, 0, T - 3, T, GOLD_DARK)
        for x in range(1, T, 5):
            px(img, x, T - 2, GOLD_LIGHT)
    return img


def carpet_medallion(seed: int):
    """One gold lozenge on the runner, placed once every few tiles by the planner."""
    img = carpet_field(seed)
    for k in range(5):
        hline(img, 8 - k, 5 + k, 1 + 2 * k, GOLD_DARK if k % 2 else GOLD)
        hline(img, 8 - k, 9 - k, 1 + 2 * k, GOLD_DARK if k % 2 else GOLD)
    px(img, 7, 7, GOLD_LIGHT)
    px(img, 8, 7, GOLD_PALE if "GOLD_PALE" in globals() else GOLD_LIGHT)
    return img


def aisle(seed: int, quad: int):
    """The processional paving: marble with a gold inlay down the middle.

    The inlay is a centred band, not a hairline at the tile's top edge. Drawn as
    a two-pixel rule on the seam, an isolated aisle cell read as a gold scratch
    floating on the floor - one of the tics every room in this chapter was
    covered in. A four-pixel band with a dark bed and a lit arris reads as inlay
    whether it is one cell long or forty, and it runs continuously when cells are
    adjacent.
    """
    img = marble(seed, quad, tone=1.02)
    rect(img, 0, 6, T, 4, GOLD_DARK)
    hline(img, 0, 6, T, GOLD)
    hline(img, 0, 7, T, GOLD_LIGHT)
    hline(img, 0, 9, T, shade(GOLD_DARK, 0.78))
    for x in range(3, T, 6):
        px(img, x, 8, GOLD_PALE)
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
    """The crossing lanes: paler paving, banded down the middle, no hairlines.

    The old version drew a single pale pixel down the tile's left seam, which on
    its own read as a scratch and in a stack read as a grid drawn on the floor.
    A centred two-pixel band with a joint either side reads as dressed stone.
    """
    img = marble(seed, quad, tone=1.08)
    vline(img, 7, 0, T, mix(MARBLE_PALE, JOINT, 0.18))
    vline(img, 8, 0, T, mix(MARBLE_PALE, JOINT, 0.30))
    for y in range(4, T, 6):
        px(img, 7, y, MARBLE_PALE)
    return img


def step(seed: int, quad: int, *, riser: bool = False):
    """A stair tread: a lit nosing at the top, a shadowed riser at the foot.

    The steps to the throne were drawn as scattered aisle and lane tiles, so the
    staircase read as gold scratches on the paving and the dais appeared to float
    over noise. A tread has to be a *band*: one continuous highlight where the
    nosing catches the light and one continuous shadow where the riser drops.
    Then four rows of them read as four steps, at any width.
    """
    img = marble(seed, quad, tone=1.10)
    hline(img, 0, 0, T, shade(MARBLE_PALE, 1.06))
    hline(img, 0, 1, T, shade(MARBLE_PALE, 1.02))
    hline(img, 0, 2, T, mix(MARBLE_LIGHT, JOINT, 0.35))
    if riser:
        rect(img, 0, T - 5, T, 5, mix(JOINT, MARBLE_DARK, 0.55))
        hline(img, 0, T - 5, T, shade(JOINT, 0.82))
        hline(img, 0, T - 1, T, shade(JOINT, 1.35))
    else:
        hline(img, 0, T - 1, T, mix(MARBLE_LIGHT, JOINT, 0.30))
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
    """The Castellan's seat: a monumental chair on a stepped dais, flanked by wings.

    Read at gameplay scale on the mosaic, the previous throne was a white box with a
    red door in it: the dais, the wings and the back all sat within one value band, so
    the hall's largest object had no silhouette and the seat - the one thing a throne
    is - was the same brightness as the stone around it. It also stood alone on an
    empty platform, which is the "hollow flanks" finding in the audit.

    This version is built the way a monument is read at 640 x 360:

    * a **dais** three steps deep, darker than the seat, wide enough to stand in;
    * a **back** whose outer frame is dark marble and whose field is crimson, so the
      chair reads as a seat against a wall rather than as a lit block;
    * **arms** that project forward past the cushion, with gold finials, because a
      silhouette needs a break in it;
    * two **wing walls** stepping down and outward from the back, each with a sunk
      panel and a gold fillet, filling the platform's flanks;
    * a **crown** resting on the lintel, and a **footstool** at the seat's foot.
    """
    # Height is set by the crown: the crest sits 36 px above the back's lintel, and
    # the first version drew it off the top of the canvas, so the hall's largest
    # object was also clipped.
    w, h = 208, 180
    img = new(w, h)
    cx = w // 2
    base_y = h - 4

    # --- dais: three steps, each darker than the one above it ----------------
    dais_dark = shade(MARBLE_DARK, 1.06)
    for inset, top, width, tone in ((0, base_y - 10, 200, 0.92),
                                    (10, base_y - 19, 180, 1.0),
                                    (22, base_y - 27, 156, 1.10)):
        x0 = (w - width) // 2
        block(img, x0, top, width, base_y - top, shade(dais_dark, tone), bevel=2)
        hline(img, x0, top, width, shade(MARBLE_LIGHT, 0.94))
        hline(img, x0, base_y - 1, width, JOINT)
        for x in range(x0 + 20, x0 + width - 14, 30):
            vline(img, x, top + 2, base_y - top - 4, shade(MARBLE_DARK, 0.9))
            px(img, x, top + 2, shade(MARBLE_LIGHT, 0.98))

    seat_y = base_y - 27
    # --- wing walls: three stepped masses each, swept outward and down ------
    for side in (-1, 1):
        for reach, drop, thick in ((104, 14, 34), (92, 40, 30), (80, 64, 26)):
            x_edge = cx + side * reach
            x_in = x_edge - side * thick
            x0, x1 = sorted((x_in, x_edge))
            top = seat_y - drop
            block(img, x0, top, x1 - x0, seat_y - 4 - top, shade(MARBLE_DARK, 1.14), bevel=2)
            hline(img, x0, top, x1 - x0, MARBLE_PALE)
            vline(img, x_edge - side, top + 2, seat_y - 8 - top, GOLD_DARK)
            vline(img, x_edge - side * 2, top + 2, seat_y - 8 - top, GOLD)
            panel_w = (x1 - x0) - 8
            panel_h = seat_y - 16 - top
            if panel_w > 6 and panel_h > 8:
                # A sunk panel has to be a real value step or it is invisible at native
                # scale: the first version differed from its surround by one shade and
                # the wings read as plain dark steps. This is three stops down, with a
                # bright inner moulding round it.
                rect(img, x0 + 4, top + 6, panel_w, panel_h, shade(MARBLE_DARK, 0.62))
                rect(img, x0 + 5, top + 7, panel_w - 2, panel_h - 2, shade(MARBLE_DARK, 0.72))
                hline(img, x0 + 4, top + 6, panel_w, MARBLE_LIGHT)
                vline(img, x0 + 4, top + 6, panel_h, MARBLE_LIGHT)
                hline(img, x0 + 4, top + 6 + panel_h - 1, panel_w, JOINT)
                vline(img, x0 + 4 + panel_w - 1, top + 6, panel_h, JOINT)
                # a gold stud at the head of the panel, and a carved lozenge in it
                px(img, cx + side * (reach - thick // 2), top + 9, GOLD)
                mid_y = top + 6 + panel_h // 2
                for k in range(4):
                    hline(img, cx + side * (reach - thick // 2) - 3 + k, mid_y + k, 7 - 2 * k, GOLD_DARK)
                    hline(img, cx + side * (reach - thick // 2) - 3 + k, mid_y - k, 7 - 2 * k, GOLD_DARK)

    # --- canopy spires above the back --------------------------------------
    # A throne is read by its canopy before its cushion. Three spires over a moulded
    # cornice give the seat a crown of silhouette against the dark wall behind it.
    for dx, height in ((-58, 40), (0, 62), (58, 40)):
        base = seat_y - 112
        for i in range(height):
            half = max(1, int((1.0 - i / float(height)) * 9) + 1)
            for x in range(cx + dx - half, cx + dx + half):
                colour = GOLD if (x - (cx + dx) + half) % 6 < 3 else GOLD_DARK
                if i > height - 6:
                    colour = GOLD_LIGHT
                px(img, x, base - i, colour)
        px(img, cx + dx, base - height - 1, GOLD_PALE)
        px(img, cx + dx, base - height - 2, GOLD_LIGHT)
        # a finial ball on each spire
        for k in range(3):
            px(img, cx + dx - 1 + k, base - height + 1, GOLD_LIGHT)
    block(img, cx - 74, seat_y - 122, 149, 12, MARBLE_PALE, bevel=2)
    hline(img, cx - 74, seat_y - 122, 149, GOLD_LIGHT)
    hline(img, cx - 74, seat_y - 121, 149, GOLD)
    hline(img, cx - 74, seat_y - 111, 149, JOINT)
    for x in range(cx - 68, cx + 68, 11):
        rect(img, x, seat_y - 119, 4, 6, shade(MARBLE_LIGHT, 0.9))

    # --- the back: a dark frame with a crimson inset, not a crimson door ----
    outer = 62
    back_top = seat_y - 108
    back_bottom = seat_y - 8
    block(img, cx - outer, back_top, outer * 2, back_bottom - back_top,
          shade(MARBLE_DARK, 1.2), bevel=2)
    hline(img, cx - outer, back_top, outer * 2, MARBLE_PALE)
    field_x, field_w = cx - 33, 67
    field_top = back_top + 14
    field_h = back_bottom - back_top - 34
    # the inset is recessed: a lit lip on the top and left, shadow on the bottom
    rect(img, field_x - 2, field_top - 2, field_w + 4, field_h + 4, GOLD_DARK)
    rect(img, field_x, field_top, field_w, field_h, CARPET_DARK)
    rect(img, field_x + 2, field_top + 2, field_w - 4, field_h - 4, CARPET)
    hline(img, field_x, field_top, field_w, GOLD)
    vline(img, field_x, field_top, field_h, GOLD)
    hline(img, field_x, field_top + field_h - 1, field_w, shade(CARPET_DARK, 0.8))
    # tooled chevrons and a central spine, readable at 3x
    for step in range(0, 24, 4):
        px(img, cx - 22 + step, field_top + 18 + step, GOLD)
        px(img, cx + 22 - step, field_top + 18 + step, GOLD)
    for step in range(0, 24, 4):
        px(img, cx - 22 + step, field_top + field_h - 22 - step, GOLD)
        px(img, cx + 22 - step, field_top + field_h - 22 - step, GOLD)
    vline(img, cx, field_top + 4, field_h - 8, GOLD_DARK)
    vline(img, cx + 1, field_top + 4, field_h - 8, GOLD)
    # pilasters flanking the inset
    for side in (-1, 1):
        x0 = cx + side * 48 - (14 if side > 0 else 0)
        block(img, x0, back_top + 8, 14, back_bottom - back_top - 12, MARBLE_LIGHT, bevel=1)
        block(img, x0 - 2, back_top + 8, 18, 9, MARBLE_PALE, bevel=1)
        hline(img, x0 - 2, back_top + 8, 18, GOLD)
        hline(img, x0 - 2, back_bottom - 5, 18, GOLD_DARK)

    # --- the seat: a cushion proud of the frame, arms, legs, footstool ------
    block(img, cx - 50, seat_y - 12, 101, 12, shade(MARBLE_LIGHT, 0.94), bevel=2)
    hline(img, cx - 50, seat_y - 12, 101, MARBLE_PALE)
    block(img, cx - 44, seat_y - 20, 89, 10, MARBLE_PALE, bevel=2)
    rect(img, cx - 40, seat_y - 19, 81, 8, CARPET_LIGHT)
    hline(img, cx - 40, seat_y - 19, 81, GOLD_LIGHT)
    hline(img, cx - 40, seat_y - 12, 81, GOLD_DARK)
    # seat legs down to the dais - a seat that floats is a shelf
    for side in (-1, 1):
        lx = cx + side * 44
        block(img, lx - 5, seat_y - 2, 11, 10, shade(MARBLE_DARK, 1.24), bevel=1)
        hline(img, lx - 5, seat_y - 2, 11, MARBLE_LIGHT)
    # arms: a horizontal rail on two posts, gold on top
    for side in (-1, 1):
        ax = cx + side * 56
        block(img, ax - 3, seat_y - 30, 7, 22, MARBLE_LIGHT, bevel=1)
        block(img, ax - 7, seat_y - 34, 15, 6, MARBLE_PALE, bevel=1)
        hline(img, ax - 7, seat_y - 34, 15, GOLD_LIGHT)
        px(img, ax, seat_y - 37, GOLD)
    # footstool on the first tread
    block(img, cx - 27, base_y - 16, 55, 6, MARBLE_LIGHT, bevel=1)
    hline(img, cx - 27, base_y - 16, 55, MARBLE_PALE)
    for x in range(cx - 23, cx + 23, 9):
        px(img, x, base_y - 14, GOLD_DARK)
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
    # The runner is three cells wide and two deep in the crossing: a border per cell
    # turns it into a hatch of stripes, so the tiles carry one edge each and the
    # planner decides where the edges are.
    tiles.append(("carpet_v", lambda: carpet_field(17)))
    tiles.append(("carpet_h", lambda: carpet_field(19)))
    for side in ("w", "e", "n", "s"):
        tiles.append(("carpet_edge_" + side, lambda s=side: carpet_edge(s, 23)))
    tiles.append(("carpet_medallion", lambda: carpet_medallion(29)))
    for direction in ("h", "v"):
        tiles.append(("carpet_end_" + direction, lambda d=direction: carpet_edge("n" if d == "v" else "w", 19)))
    for quad, name in enumerate(("aisle_a", "aisle_b", "aisle_c", "aisle_d")):
        tiles.append((name, lambda q=quad: aisle(23, q)))
    for quad, name in enumerate(("broken_a", "broken_b", "broken_c", "broken_d")):
        tiles.append((name, lambda q=quad: aisle_broken(37, q)))
    for quad, name in enumerate(("lane_a", "lane_b", "lane_c", "lane_d")):
        tiles.append((name, lambda q=quad: lane(43, q)))
    for quad, name in enumerate(("step_a", "step_b", "step_c", "step_d")):
        tiles.append((name, lambda q=quad: step(51, q)))
    for quad, name in enumerate(("riser_a", "riser_b", "riser_c", "riser_d")):
        tiles.append((name, lambda q=quad: step(53, q, riser=True)))
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
    write_kit(ART, KIT, build_tiles(), build_props(), light_colour=(232, 244, 255), gamma=0.72)


if __name__ == "__main__":
    main()
