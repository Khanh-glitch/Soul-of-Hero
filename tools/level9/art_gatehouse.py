#!/usr/bin/env python3
"""Level 9 — The Crimson Gate. Kit art.

A gatehouse, not a hall. Where the reliquary above was pale marble in thin slabs,
this is oxblood basalt in blocks you could not lift, banded with riveted iron and
hung with the trophies of everyone who tried to get through: shields, skulls,
broken blades and long blood-red banners.

Three things in this kit exist to make the level's objective readable without a
marker:

* **Three seal shrines** — a bronze bell, an iron brazier and a gate wheel. They
  are the same size, stand on the same kind of platform, and are nothing like each
  other, so the player can tell which of the three seals they are standing at
  from the silhouette alone.
* **The gate** — a monumental arch with a portcullis and two towers, built as
  separate props so it can be assembled at the top of the arena at full scale.
* **Iron and bone** — the gate's holdings: chains, braziers, war drums, skull
  piles. Nothing in this room is decoration; it is all loot.

Run: python3 tools/level9/art_gatehouse.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, T, _h01, block, courses, finish, flag_quadrant, glow, hline, mix, new,
    px, rect, rock_tile, shade, shadow_tile, vline, wall_cap_tile,
    wall_cornice_tile, wall_field_tile, wall_plinth_tile, write_kit,
)

ART = os.path.join(ROOT, "assets", "environment", "chapter1", "gatehouse")
KIT = "gatehouse"

# --- palette ---------------------------------------------------------------
# Values chosen against the engine's ambient multiply: the renderer tints every
# tile by the level's ambient, so an oxblood that looks right on its own reads as
# black on the level. These are the same hues, two stops lighter.
FLOOR_COOL = (58, 52, 66)     # paving is cool; the walls stay warm on purpose
STONE_DARK = (58, 42, 48)
STONE_BASE = (104, 66, 70)
STONE_LIGHT = (146, 96, 98)
STONE_PALE = (184, 132, 126)
JOINT = (44, 30, 34)
ROCK_DARK = (72, 56, 60)
ROCK_BASE = (100, 80, 84)
ROCK_LIGHT = (128, 104, 106)

IRON_DARK = (38, 36, 42)
IRON = (74, 72, 80)
IRON_LIGHT = (118, 116, 126)
BONE = (204, 196, 178)
BONE_DARK = (150, 142, 126)
BLOOD = (92, 18, 26)
BLOOD_LIGHT = (146, 30, 38)
GATE_LIGHT = (150, 190, 255)
GATE_PALE = (208, 226, 255)
BRONZE_DARK = (104, 70, 34)
BRONZE = (156, 112, 56)
BRONZE_LIGHT = (204, 160, 92)
EMBER = (255, 148, 62)
EMBER_LIGHT = (255, 206, 140)


def arc(img, cx, cy, r, a0, a1, colour, thickness=1.0) -> None:
    steps = max(8, int(abs(a1 - a0) * r))
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        for k in range(max(1, int(thickness))):
            px(img, int(cx + math.cos(a) * (r + k)), int(cy + math.sin(a) * (r + k)), colour)


# --- tiles -----------------------------------------------------------------
def rock(seed: int):
    return rock_tile(seed, ROCK_DARK, ROCK_BASE, ROCK_LIGHT)


def flag(seed: int, quad: int, *, tone: float = 1.0):
    """A single huge paving block: one joint in two, worn and chiselled.

    The paving is deliberately a stop darker and a stop cooler than the walls.
    In the first pass the floor, the walls, the iron and the blood were all the
    same oxblood, so the room had no value structure at all: seal rings, floor
    markings and props dissolved into the ground. Now the floor carries the
    coolest, darkest value in the level, the walls stay warm, and the red things
    - blood, iron, embers - are the only saturated red in the room.
    """
    base = mix(STONE_BASE, FLOOR_COOL, 0.42)
    img = flag_quadrant(seed, quad, base, mix(JOINT, base, 0.30), tone=tone)
    if quad in (0, 3):
        hline(img, 0, 1, T, shade(base, 1.16))
    if quad in (0, 1):
        vline(img, 1, 0, T, shade(base, 1.09))
    # a broad chisel mark that never repeats within a room
    if _h01(seed, quad, 2) < 0.5:
        offset = 4 + int(_h01(seed, quad, 3) * 7)
        for x in range(2, T - 2):
            px(img, x, offset + (x // 5) % 2, shade(base, 1.10))
    # a crack here and there
    if _h01(seed, quad, 7) > 0.86:
        x = 3 + int(_h01(seed, quad, 9) * 9)
        for y in range(2, T - 2):
            px(img, x, y, shade(base, 0.82))
            if _h01(seed, quad, 11, y) > 0.7:
                x += 1 if _h01(seed, quad, 13, y) > 0.5 else -1
            x = max(2, min(T - 3, x))
    return img


def iron_band(direction: str, seed: int):
    """A riveted iron band set into the floor: the gate's own threshold marks."""
    img = flag(seed, 0, tone=1.05)
    if direction == "v":
        rect(img, 5, 0, 6, T, IRON)
        vline(img, 5, 0, T, IRON_LIGHT)
        vline(img, 10, 0, T, IRON_DARK)
        for y in (3, 11):
            px(img, 7, y, IRON_LIGHT)
    else:
        rect(img, 0, 5, T, 6, IRON)
        hline(img, 0, 5, T, IRON_LIGHT)
        hline(img, 0, 10, T, IRON_DARK)
        for x in (3, 11):
            px(img, x, 7, IRON_LIGHT)
    return img


def blood_floor(seed: int, quad: int):
    """Paving over which something died, and nobody washed it.

    Three mid-red blobs on red paving read as pink petals - *lighter* than the
    ground, so they read as objects rather than stains. Blood is darker than the
    stone it lands on: this is a near-black pool with one wet highlight on the
    rim, so a room of it sinks in value while the seals stay up.
    """
    img = flag(seed, quad, tone=0.94)
    base = mix(STONE_BASE, FLOOR_COOL, 0.42)
    stain = mix(base, BLOOD, 0.72)
    for i in range(3):
        cx = 3 + int(_h01(seed, quad, i, 7) * 10)
        cy = 3 + int(_h01(seed, quad, i, 11) * 10)
        r = 2 + int(_h01(seed, quad, i, 13) * 2)
        for y in range(max(0, cy - r), min(T, cy + r + 1)):
            for x in range(max(0, cx - r), min(T, cx + r + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    px(img, x, y, stain)
        px(img, cx - r, cy, mix(stain, BLOOD_LIGHT, 0.45))
        px(img, cx, cy - r, mix(stain, BLOOD_LIGHT, 0.30))
        for k in range(2 + int(_h01(seed, quad, i, 17) * 3)):
            px(img, cx + r + k, cy + 1 + k, stain)
    return img


def _wall_block(seed: int, height: int, tone: float):
    """A wall of stones so large that a single tile only ever holds two of them."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(STONE_BASE, tone))
    courses(img, 0, 0, T, T, shade(STONE_BASE, tone), row_h=height, seed=seed, mortar=JOINT)
    return img


def wall_plate():
    """A riveted iron plate bolted over the stone: the gate has been repaired."""
    img = _wall_block(37, 16, 0.98)
    rect(img, 1, 1, T - 2, T - 2, IRON)
    hline(img, 1, 1, T - 2, IRON_LIGHT)
    hline(img, 1, T - 2, T - 2, IRON_DARK)
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        px(img, x, y, IRON_LIGHT)
        px(img, x + 1, y, IRON_DARK)
    return img


def wall_banner():
    """A torn crimson banner fixed to the wall."""
    img = _wall_block(41, 16, 0.96)
    rect(img, 4, 0, 8, T - 3, BLOOD)
    vline(img, 4, 0, T - 3, BLOOD_LIGHT)
    vline(img, 11, 0, T - 3, shade(BLOOD, 0.8))
    hline(img, 4, T - 4, 8, BONE_DARK)
    for i in range(3):
        px(img, 6 + i, 6 + i, BONE_DARK)
    return img


def ring_tiles(radius: int, opening: str | None = None, tag: str = "ring"):
    """The gate's seal ring: iron arcs cut into the floor round a station.

    One shared emblem for all three stations on purpose - they are three locks on
    the same gate - but the arms they sit in are not the same shape. The west and
    east stations stand within two cells of their arm's end wall, so a full
    circle was painted there as a broken crescent: the arc simply stopped where
    the wall began and the seal read as a smear instead of a mechanism.

    An `opening` builds the ring as a horseshoe cut at the wall, with a bronze
    collar and a bolt on each cut end, so the mechanism plainly runs into the
    plinth. That is an authored stop, not a missing tile - and it makes the two
    end stations read differently from the two that carry a whole ring.
    """
    span = 2 * radius + 1
    size = span * T
    canvas = new(size, size)
    for ty in range(span):
        for tx in range(span):
            canvas.paste(flag(43, (tx % 2) + (ty % 2) * 2), (tx * T, ty * T))
    cx = cy = (size - 1) / 2.0
    r_out = radius * T - 3
    # The cuts are wide on purpose. At the west and east stations the wall stands
    # only two cells from the seal, so a cut at 52 degrees would put both ends in
    # cells that belong to the wall - and a floor frame cannot be painted there.
    # At 80 degrees the ends fall inside the last paintable column, which is the
    # only place a socket on the end of a horseshoe can visibly exist.
    gap = {"E": (-80.0, 80.0), "W": (100.0, 260.0),
           "N": (-170.0, -10.0), "S": (10.0, 170.0)}.get(opening or "")

    def in_gap(angle_deg: float) -> bool:
        if gap is None:
            return False
        a = ((angle_deg + 180.0) % 360.0) - 180.0
        return gap[0] <= a <= gap[1]

    # A dark inlaid pad under the whole mechanism. The ring is nearly black iron
    # and brass: on oxblood paving, at a third of its value under this level's
    # ambient, a ring drawn straight onto the floor was invisible. The pad gives
    # the metal something to sit on, and reads as a channel cut into the paving.
    pad = mix(STONE_DARK, JOINT, 0.62)
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d > r_out + 3:
                continue
            if in_gap(math.degrees(math.atan2(y - cy, x - cx))):
                continue
            px(canvas, x, y, pad)

    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d > r_out:
                continue
            if in_gap(math.degrees(math.atan2(y - cy, x - cx))):
                continue
            # a recessed channel under the iron: the ring sits *in* the paving
            px(canvas, x, y, mix(STONE_DARK, JOINT, 0.55))
            if d > r_out - 4:
                px(canvas, x, y, BRONZE_LIGHT if int(d) % 3 == 0 else IRON_LIGHT)
            elif d > r_out - 7:
                px(canvas, x, y, IRON if int(d) % 2 else IRON_DARK)
            elif d > r_out - 9:
                px(canvas, x, y, mix(IRON_LIGHT, BONE, 0.35))
            elif d > r_out - 11:
                px(canvas, x, y, IRON_DARK if int(d) % 3 else IRON)
            elif d < 8:
                px(canvas, x, y, mix(STONE_DARK, JOINT, 0.35))
    # three iron spokes: one per seal on the gate
    for i in range(3):
        a_deg = -90 + i * 120
        if in_gap(a_deg):
            continue
        a = math.radians(a_deg)
        for r in range(7, int(r_out) - 8):
            px(canvas, int(cx + math.cos(a) * r), int(cy + math.sin(a) * r), BLOOD_LIGHT)
            px(canvas, int(cx + math.cos(a) * r) + 1, int(cy + math.sin(a) * r), BLOOD)
    # a bronze boss on the centre cell: the place a seal is broken, marked
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d < 2:
                px(canvas, x, y, BRONZE_LIGHT)
            elif d < 3:
                px(canvas, x, y, BRONZE)
            elif d < 5:
                px(canvas, x, y, IRON_DARK)
    # Terminal socket: where a horseshoe is cut at the wall, the mechanism does
    # not just stop - it enters a bronze socket set into the paving. Drawn on the
    # *painted* side of the cut, because the cells beyond it are wall and can
    # never carry a floor frame; a collar drawn in the gap was never visible.
    if gap is not None:
        for angle_deg in gap:
            a = math.radians(angle_deg)
            bx = int(cx + math.cos(a) * (r_out - 3))
            by = int(cy + math.sin(a) * (r_out - 3))
            for oy in range(-3, 4):
                for ox in range(-3, 4):
                    if abs(ox) + abs(oy) > 4:
                        continue
                    px(canvas, bx + ox, by + oy,
                       BRONZE_LIGHT if abs(ox) + abs(oy) < 3 else BRONZE_DARK)
            px(canvas, bx, by, IRON_DARK)
            px(canvas, bx, by + 1, BRONZE)
    frames = {}
    for ty in range(span):
        for tx in range(span):
            frames["%s_%d_%d" % (tag, tx - radius, ty - radius)] = \
                canvas.crop((tx * T, ty * T, tx * T + T, ty * T + T))
    return frames


def prop_gate_tower(seed: int = 1, *, mirror: bool = False):
    """One tower of the gate: a massive square shaft, corbelled crown, banner."""
    w, h = 80, 152
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    top = 26
    # plinth, wider than the shaft
    block(img, 2, base_y - 14, w - 4, 14, STONE_LIGHT, bevel=2)
    block(img, 8, base_y - 20, w - 16, 7, STONE_BASE)
    # shaft: 44 wide, three lit bands, coursed every 20px
    half = 22
    for y in range(top, base_y - 20):
        for x in range(cx - half, cx + half):
            t = (x - (cx - half)) / (half * 2.0)
            colour = (STONE_PALE if t < 0.12 else STONE_LIGHT if t < 0.42 else
                      STONE_BASE if t < 0.80 else shade(STONE_DARK, 1.12))
            if (y - top) % 20 in (0, 1):
                colour = shade(colour, 0.66)
            px(img, x, y, colour)
    # a course of iron plate and two arrow slits
    rect(img, cx - half + 2, top + 46, half * 2 - 4, 12, IRON)
    hline(img, cx - half + 2, top + 46, half * 2 - 4, IRON_LIGHT)
    hline(img, cx - half + 2, top + 57, half * 2 - 4, IRON_DARK)
    for x in range(cx - half + 5, cx + half - 4, 8):
        px(img, x, top + 49, IRON_LIGHT)
    for yy in (top + 18, top + 78):
        rect(img, cx - 3, yy, 6, 14, (10, 8, 12))
        px(img, cx - 3, yy, IRON)
        px(img, cx + 2, yy, IRON_DARK)
    # corbelled crown and battlements
    for i in range(5):
        rect(img, cx - half - i, top + i, (half + i) * 2, 1, STONE_LIGHT if i % 2 else STONE_BASE)
    for x in range(cx - half - 4, cx + half + 4, 11):
        block(img, x, top - 12, 8, 12, STONE_LIGHT, bevel=1)
    # the tower's banner, hanging from the crown
    bx = cx + 4
    rect(img, bx, top + 4, 12, 40, BLOOD)
    vline(img, bx, top + 4, 40, BLOOD_LIGHT)
    vline(img, bx + 11, top + 4, 40, shade(BLOOD, 0.78))
    hline(img, bx - 1, top + 44, 14, BONE_DARK)
    for i in range(3):
        px(img, bx + 5, top + 12 + i * 6, BONE_DARK)
    if mirror:
        img = img.transpose(0)
    return finish(img)


def prop_gate_arch(seed: int = 2):
    """The gate itself: a monumental pointed arch with a portcullis inside it."""
    w, h = 176, 156
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    spring = 62          # where the arch starts to curve
    half_open = 44
    # piers: 30 wide, coursed, with buttress steps
    for side in (-1, 1):
        inner = cx + side * half_open
        outer = inner + side * 30
        x0, x1 = sorted((inner, outer))
        for y in range(30, base_y):
            for x in range(x0, x1):
                t = (x - x0) / 30.0
                colour = STONE_PALE if t < 0.2 else STONE_LIGHT if t < 0.6 else STONE_BASE
                if (y - 30) % 24 in (0, 1):
                    colour = shade(colour, 0.7)
                px(img, x, y, colour)
        for y in range(30, base_y, 24):
            rect(img, x0, y, 30, 2, JOINT)
    # the opening: a pointed vault, lit from beyond the gate
    for y in range(14, base_y):
        if y < spring:
            half = int(half_open * math.sqrt(max(0.0, 1 - ((spring - y) / (spring - 14)) ** 2)))
        else:
            half = half_open
        for x in range(cx - half, cx + half):
            t = abs(x - cx) / max(1, half)
            px(img, x, y, mix((10, 12, 20), (56, 74, 104), (1 - t) * 0.9))
    # portcullis bars inside the lit opening, dark against the light
    for x in range(cx - half_open + 6, cx + half_open - 4, 10):
        y_start = max(20, spring - int(math.sqrt(max(0.0, (half_open - 6) ** 2 - (x - cx) ** 2))))
        for y in range(y_start, base_y - 2):
            px(img, x, y, (16, 15, 20))
            px(img, x + 1, y, (34, 32, 40))
    for y in range(spring, base_y - 2, 14):
        hline(img, cx - half_open + 4, y, half_open * 2 - 8, (16, 15, 20))
        hline(img, cx - half_open + 4, y + 1, half_open * 2 - 8, (34, 32, 40))
    # voussoirs round the pointed arch
    for step in range(40):
        a = math.pi * (step / 39.0)
        r = half_open + 10
        bx = int(cx - math.cos(a) * r)
        by = int(spring - math.sin(a) * r * 1.25)
        for k in range(6):
            px(img, bx, by + k, STONE_PALE if k == 0 else STONE_LIGHT if k < 3 else STONE_BASE)
    # keystone with the gate's seal socket
    block(img, cx - 8, 8, 17, 14, STONE_PALE, bevel=2)
    rect(img, cx - 3, 12, 7, 5, BLOOD_LIGHT)
    px(img, cx, 14, BONE)
    # hanging chains either side of the arch head
    for dx in (-30, 26):
        for i in range(20):
            px(img, cx + dx + (i % 2), 20 + i * 2, IRON if i % 2 else IRON_LIGHT)
    # threshold
    block(img, 0, base_y - 10, w, 10, STONE_LIGHT, bevel=1)
    hline(img, 0, base_y - 11, w, STONE_PALE)
    glow(img, cx, 78, 34, 40, GATE_LIGHT, 55, steps=4)
    return finish(img)


def prop_portcullis(seed: int = 3):
    """A second portcullis, half raised: the gate has more than one door."""
    w, h = 90, 96
    img = new(w, h)
    for x in range(6, w - 6, 12):
        vline(img, x, 6, h - 8, IRON)
        vline(img, x + 1, 6, h - 8, IRON_DARK)
        for y in range(10, h - 8, 14):
            px(img, x, y, IRON_LIGHT)
    for y in range(8, h - 8, 12):
        hline(img, 6, y, w - 12, IRON_DARK)
        hline(img, 6, y + 1, w - 12, IRON)
    # spikes
    for x in range(9, w - 8, 12):
        for i in range(4):
            px(img, x - i, h - 6 + i, IRON_LIGHT)
            px(img, x + i, h - 6 + i, IRON_LIGHT)
    hline(img, 4, 4, w - 8, IRON_LIGHT)
    return finish(img, shadow=False)


# --- props: the three seal shrines -----------------------------------------
def _station_base(img, w, base_y, width):
    block(img, (w - width) // 2, base_y - 8, width, 8, STONE_LIGHT, bevel=2)
    hline(img, (w - width) // 2, base_y - 9, width, STONE_PALE)


def prop_seal_bell(seed: int = 4):
    """West seal — a bronze bell hanging from an iron gallows. The one that rings.

    One vertical post and one arm, so the silhouette is a bell in the air rather
    than a bell standing on a box: nothing but the chain touches it.
    """
    w, h = 72, 118
    img = new(w, h)
    base_y = h - 3
    _station_base(img, w, base_y, 54)
    # the gallows: a post on the right, an arm across the top, a brace
    post_x = w - 12
    vline(img, post_x, 18, base_y - 21, IRON)
    vline(img, post_x + 1, 18, base_y - 21, IRON_DARK)
    vline(img, post_x + 2, 18, base_y - 21, IRON_LIGHT)
    for x in range(14, post_x + 2):
        px(img, x, 18, IRON_LIGHT)
        px(img, x, 19, IRON)
        px(img, x, 20, IRON_DARK)
    for i in range(12):
        px(img, post_x - i, 21 + i, IRON if i % 2 else IRON_DARK)
    block(img, post_x - 3, base_y - 24, 8, 8, IRON, bevel=1)
    # chain
    cx = 30
    for i in range(14):
        px(img, cx + (i % 2), 21 + i, IRON_LIGHT if i % 2 else IRON)
    # the bell, hanging off the chain
    top = 36
    rim = 96
    span = float(rim - top)
    def half_at(t):
        if t < 0.14:
            return 4 + int(t / 0.14 * 4)
        if t < 0.40:
            return 8 + int((t - 0.14) / 0.26 * 5)
        if t < 0.70:
            return 13 + int((t - 0.40) / 0.30 * 2)
        return 15 + int((t - 0.70) / 0.30 * 5)
    for y in range(top, rim):
        t = (y - top) / span
        half = half_at(t)
        for x in range(cx - half, cx + half):
            u = (x - (cx - half)) / max(1, half * 2)
            colour = (BRONZE_LIGHT if u < 0.16 else BRONZE if u < 0.52 else
                      BRONZE_DARK if u < 0.9 else shade(BRONZE_DARK, 0.78))
            px(img, x, y, colour)
    for t in (0.18, 0.54, 0.86):
        yy = int(top + span * t)
        half = half_at(t)
        hline(img, cx - half, yy, half * 2, BRONZE_LIGHT)
        hline(img, cx - half, yy + 1, half * 2, BRONZE_DARK)
    # the throat, and the clapper hanging in it
    for i in range(7):
        half = int(20 - i * 2.4)
        for x in range(cx - half, cx + half):
            px(img, x, rim + i, (28, 17, 11) if i < 5 else BRONZE_DARK)
    hline(img, cx - 20, rim - 1, 41, BRONZE_LIGHT)
    vline(img, cx, rim + 1, 7, BRONZE)
    px(img, cx, rim + 8, BRONZE_LIGHT)
    rect(img, cx - 4, top - 6, 9, 7, BRONZE_DARK)
    px(img, cx, top - 7, BRONZE)
    glow(img, cx, rim - 24, 15, 16, EMBER, 40, steps=3)
    return finish(img)


def prop_seal_brazier(seed: int = 5):
    """East seal - an iron cauldron standing in its shrine niche. The one that burns.

    The first version was a 70 x 108 funnel hanging from a shelf: wider than its
    own niche, it hung out over the seal cell beside it and its centre was the
    darkest value in the room, so the objective read as a hole behind a hood. A
    cauldron that does not fit its own shrine is not a monument, it is an
    occlusion.

    This one is built to the niche rather than the niche to it: a stone plinth on
    the shrine floor, three bronze-shod legs, a cauldron with a rolled rim, coals
    in its throat and three flames. At 48px it clears the seal cell completely,
    and every value is bronze (light) or iron (mid), so it can never read as a
    hole. It still lights the ring: that is the point of it.
    """
    w, h = 48, 78
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    # plinth on the niche floor: dark iron-shod stone, never pale stone, which
    # under this level's ambient reads as a bench
    block(img, 3, base_y - 7, w - 6, 7, shade(STONE_DARK, 1.05), bevel=2)
    hline(img, 3, base_y - 8, w - 6, mix(STONE_LIGHT, IRON, 0.5))
    hline(img, 3, base_y - 1, w - 6, IRON_DARK)
    # three splayed legs, bronze-shod
    for dx in (-12, 0, 12):
        for i in range(15):
            lean = (i // 5) * (1 if dx > 0 else (-1 if dx < 0 else 0))
            px(img, cx + dx + lean, base_y - 8 - i, IRON)
            px(img, cx + dx + lean + 1, base_y - 8 - i, IRON_DARK)
            if i < 4:
                px(img, cx + dx + lean, base_y - 8 - i, BRONZE)
    # the bowl: a cauldron with a belly, not a bag. The belly bulges below the
    # rim and the foot tapers back in, which is what makes it read as a vessel
    # rather than as something hanging.
    rim_y = base_y - 48
    depth = 24
    for i in range(depth):
        t = i / float(depth - 1)
        half = int(17 + math.sin(t * math.pi) * 4 - t ** 2.2 * 7)
        for x in range(cx - half, cx + half):
            u = (x - (cx - half)) / max(1, half * 2)
            colour = (BRONZE_LIGHT if u < 0.10 else BRONZE if u < 0.40 else
                      BRONZE_DARK if u < 0.78 else IRON_DARK)
            if t > 0.72:
                colour = shade(colour, 0.80)
            if i > 12 and u > 0.15:
                colour = mix(colour, EMBER, 0.26)
            px(img, x, rim_y + i, colour)
        # three raised bands round the belly
        if i in (7, 13, 19):
            hline(img, cx - half, rim_y + i, half * 2, IRON_DARK)
            hline(img, cx - half, rim_y + i + 1, half * 2, mix(BRONZE_LIGHT, EMBER, 0.25))
    # two ring handles, hung clear of the rim so the mouth stays unbroken
    for side in (-1, 1):
        hx = cx + side * 23
        for k in range(7):
            px(img, hx + side * (k // 3), rim_y + 1 + k, IRON_LIGHT if k < 4 else IRON_DARK)
            px(img, hx + side * (k // 3) + side, rim_y + 2 + k, IRON)
    # a thick iron rim with a lit inner lip, and the coals in its throat
    rect(img, cx - 21, rim_y - 5, 43, 7, IRON)
    hline(img, cx - 21, rim_y - 6, 43, IRON_LIGHT)
    hline(img, cx - 21, rim_y - 5, 43, mix(IRON_LIGHT, EMBER, 0.35))
    hline(img, cx - 21, rim_y + 1, 43, IRON_DARK)
    for x in range(cx - 21, cx + 22, 5):
        px(img, x, rim_y - 4, IRON_DARK)
    for x in range(cx - 17, cx + 18):
        px(img, x, rim_y - 3, (92, 28, 10))
        px(img, x, rim_y - 2, EMBER if x % 3 else EMBER_LIGHT)
    # three tongues and sparks
    for tongue, dx in enumerate((-8, 0, 8)):
        for i in range(8 - tongue % 2):
            half = max(1, 3 - i // 3)
            for x in range(cx + dx - half, cx + dx + half):
                px(img, x, rim_y - 7 - i, EMBER if i < 4 else EMBER_LIGHT)
    for i in range(5):
        px(img, cx - 8 + i * 4, rim_y - 17 - (i % 3), EMBER_LIGHT)
    # two short chains off the rim, into the shrine's ironwork
    for dx in (-21, 20):
        for i in range(7):
            px(img, cx + dx + (i % 2), rim_y + 3 + i * 2, IRON_LIGHT if i % 2 else IRON)
    glow(img, cx, rim_y - 6, 18, 16, EMBER, 90, steps=4)
    return finish(img)


def prop_seal_wheel(seed: int = 6):
    """North seal — the great iron wheel that raises the gate. The one that opens."""
    w, h = 84, 106
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    _station_base(img, w, base_y, 52)
    # stone frame holding the axle
    for x in (12, w - 20):
        block(img, x, base_y - 58, 8, 50, STONE_BASE, bevel=1)
    block(img, 8, base_y - 64, w - 16, 7, STONE_LIGHT, bevel=1)
    # winch drum with chain wound on it
    block(img, cx - 22, base_y - 26, 45, 18, IRON, bevel=2)
    for x in range(cx - 20, cx + 21, 5):
        vline(img, x, base_y - 24, 14, IRON_DARK)
    for i in range(5):
        rect(img, cx - 20 + i * 10, base_y - 32, 6, 6, IRON_LIGHT)
    # the wheel: two rims, eight spokes, four grips
    wy = base_y - 52
    r = 24
    arc(img, cx, wy, r, 0, 360, IRON_LIGHT, 2)
    arc(img, cx, wy, r - 2, 0, 360, IRON, 2)
    arc(img, cx, wy, r - 9, 0, 360, IRON_DARK, 1)
    for i in range(8):
        a = math.radians(i * 45)
        for step in range(3, r - 1):
            px(img, int(cx + math.cos(a) * step), int(wy + math.sin(a) * step), IRON_LIGHT)
            px(img, int(cx + math.cos(a) * step), int(wy + math.sin(a) * step) + 1, IRON)
    for i in range(4):
        a = math.radians(45 + i * 90)
        gx, gy = int(cx + math.cos(a) * r), int(wy + math.sin(a) * r)
        block(img, gx - 2, gy - 2, 5, 5, BONE_DARK, bevel=1)
    rect(img, cx - 5, wy - 5, 11, 11, IRON_DARK)
    rect(img, cx - 2, wy - 2, 5, 5, IRON_LIGHT)
    # the chain running off the drum toward the gate
    for i in range(9):
        px(img, cx + 22 + i * 2, base_y - 22 - (i % 4), IRON_LIGHT if i % 2 else IRON)
    return finish(img)


def prop_banner(seed: int = 7, *, torn: bool = False):
    """The long crimson banners that hang in the nave."""
    w, h = 38, 116
    img = new(w, h)
    cx = w // 2
    block(img, 0, 2, w, 4, IRON)
    hline(img, 0, 2, w, IRON_LIGHT)
    for y in range(8, 104):
        half = 15 if y < 96 else 15 - (y - 96)
        if torn and y > 70:
            half = 15 - int(_h01(seed, y, 3) * 9)
        for x in range(cx - half, cx + half):
            t = (x - (cx - half)) / max(1, half * 2)
            colour = (BLOOD_LIGHT if t < 0.14 else
                      BLOOD if t < 0.6 else
                      shade(BLOOD, 0.78) if t < 0.9 else BLOOD_LIGHT)
            if (x + y * 2) % 41 == 0:
                colour = shade(colour, 1.16)
            px(img, x, y, colour)
    # the gate's sigil: a skull over crossed blades
    for i in range(9):
        half = int(4 - abs(4 - i) * 0.45)
        for x in range(cx - half, cx + half):
            px(img, x, 34 + i, BONE if (x + i) % 4 else BONE_DARK)
    for dx in (-9, 9):
        for i in range(11):
            px(img, cx + dx - i // 2, 48 + i, BONE_DARK)
    for x in range(cx - 14, cx + 15, 3):
        px(img, x, 100, BONE_DARK)
    return finish(img, shadow=False)


def prop_chain_column(seed: int = 8):
    """A column of the nave, wrapped in chain: nobody has taken it down."""
    w, h = 44, 132
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    # base and capital give the column its proportions
    block(img, 2, base_y - 12, w - 4, 12, STONE_LIGHT, bevel=2)
    block(img, 7, base_y - 18, w - 14, 7, STONE_BASE)
    block(img, 3, 16, w - 6, 8, STONE_PALE, bevel=2)
    hline(img, 3, 15, w - 6, STONE_LIGHT)
    block(img, 8, 24, w - 16, 5, STONE_BASE)
    # shaft: 16 wide, lit left, two flutes
    for y in range(29, base_y - 18):
        for x in range(cx - 8, cx + 8):
            t = (x - (cx - 8)) / 16.0
            colour = STONE_PALE if t < 0.14 else STONE_LIGHT if t < 0.45 else \
                STONE_BASE if t < 0.82 else shade(STONE_DARK, 1.15)
            for gx in (-4, 4):
                if x == cx + gx:
                    colour = shade(colour, 0.88)
            px(img, x, y, colour)
    # chain coils: three bands, with a hanging tail
    for band, start in enumerate((40, 72, 104)):
        for i in range(16):
            a = math.radians(i * 22.5)
            yy = start + int(2 * math.sin(a))
            px(img, int(cx + math.cos(a) * 11), yy, IRON_LIGHT)
            px(img, int(cx + math.cos(a) * 11), yy + 1, IRON)
            px(img, int(cx + math.cos(a) * 11), yy + 2, IRON_DARK)
    # The tail hangs free of the column, so it has to be an object: two pixels of
    # iron with a lit edge, not a dotted line. At 1:1 a one-pixel tail reads as a
    # scratch on the sprite.
    for i in range(10):
        y = 110 + i * 2
        hline(img, cx + 10, y, 3, IRON if i % 2 else IRON_LIGHT)
        px(img, cx + 10, y, IRON_LIGHT)
        px(img, cx + 12, y, IRON_DARK)
    return finish(img)


def prop_trophy_shields(seed: int = 9):
    """Three round shields of the gate's last defenders, nailed to the wall."""
    w, h = 58, 50
    img = new(w, h)
    for i, (x, y) in enumerate(((3, 10), (21, 4), (39, 11))):
        r = 10 if i != 1 else 11
        cx, cy = x + r, y + r
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                d = math.hypot(xx - cx, yy - cy)
                if d > r:
                    continue
                if d > r - 2:
                    px(img, xx, yy, IRON_DARK)
                elif d > r - 4:
                    px(img, xx, yy, BLOOD_LIGHT if (xx + yy) % 3 else BLOOD)
                else:
                    px(img, xx, yy, STONE_LIGHT if xx < cx else STONE_BASE)
        # boss and the stave
        px(img, cx, cy, BONE_DARK)
        rect(img, cx - 1, cy - 1, 3, 3, BONE)
        hline(img, cx - r + 2, cy + r - 1, r * 2 - 3, IRON)
    return finish(img, shadow=False)


def stone_tone():
    return mix(STONE_BASE, IRON, 0.25)


def prop_skulls(seed: int = 10):
    """A pile of the gate's unsuccessful visitors."""
    w, h = 48, 30
    img = new(w, h)
    for i, (x, y, r) in enumerate(((6, 16, 6), (18, 14, 7), (30, 17, 6), (12, 8, 5), (24, 7, 6))):
        for yy in range(y - r, y + r + 1):
            for xx in range(x - r, x + r + 1):
                if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                    px(img, xx, yy, BONE if (xx + yy) % 5 else BONE_DARK)
        rect(img, x - 2, y - 2, 2, 2, (18, 16, 18))
        rect(img, x + 1, y - 2, 2, 2, (18, 16, 18))
        hline(img, x - 2, y + 2, 5, BONE_DARK)
    return finish(img)


def prop_broken_blades(seed: int = 11):
    """Swords left where they fell, blade-down in the paving."""
    w, h = 44, 34
    img = new(w, h)
    for i, x in enumerate((8, 18, 28, 36)):
        lean = (i % 2) * 2
        for y in range(4 + lean, h - 4):
            px(img, x + (y // 6) % 2, y, IRON_LIGHT)
            px(img, x + 1 + (y // 6) % 2, y, IRON)
        hline(img, x - 3, 5 + lean, 7, BONE_DARK)
        px(img, x, 4 + lean, BONE_DARK)
    return finish(img)


def prop_war_drum(seed: int = 12):
    """A skin drum on a stand: the muster beat before the gate opened."""
    w, h = 46, 44
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    # tripod
    for dx in (-11, 0, 11):
        for i in range(13):
            px(img, cx + dx + (i // 6) * (1 if dx > 0 else (-1 if dx < 0 else 0)),
               base_y - 3 - i, STONE_DARK if i % 3 else STONE_BASE)
    # the drum: a barrel of hide with iron hoops and a laced seam
    top = 8
    height = 18
    for i in range(height):
        t = i / float(height)
        half = int(17 - abs(t - 0.5) * 6)
        for x in range(cx - half, cx + half):
            u = (x - (cx - half)) / max(1, half * 2)
            colour = (BONE if u < 0.2 else mix(BONE, BONE_DARK, 0.45) if u < 0.7
                      else BONE_DARK)
            if (x + i * 3) % 7 == 0:
                colour = shade(colour, 0.9)
            px(img, x, top + i, colour)
    # hoops and lacing
    for yy in (top, top + height - 1):
        half = int(17 - abs((yy - top) / float(height) - 0.5) * 6)
        hline(img, cx - half, yy, half * 2, IRON_DARK)
        hline(img, cx - half, yy + 1, half * 2, IRON)
    for i in range(6):
        x = cx - 13 + i * 5
        vline(img, x, top + 2, height - 4, IRON_DARK)
        px(img, x, top + 2, IRON_LIGHT)
    hline(img, cx - 17, top - 2, 35, BONE_DARK)
    return finish(img)


def prop_brazier(seed: int = 13):
    """A standing fire basket: light where the gate has none."""
    w, h = 34, 74
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    block(img, 4, base_y - 6, w - 8, 6, IRON, bevel=1)
    for dx in (-7, 0, 7):
        vline(img, cx + dx, base_y - 34, 28, IRON if dx else IRON_DARK)
    for i in range(14):
        t = i / 14.0
        half = int(15 - t * 5)
        for x in range(cx - half, cx + half):
            px(img, x, base_y - 46 + i, IRON if x < cx + 4 else IRON_DARK)
    hline(img, cx - 15, base_y - 46, 31, IRON_LIGHT)
    for i in range(9):
        px(img, cx - 6 + i * 2, base_y - 50 - (i % 4), EMBER if i % 3 else EMBER_LIGHT)
        px(img, cx - 4 + i, base_y - 52 - (i % 3), EMBER_LIGHT)
    glow(img, cx, base_y - 52, 15, 14, EMBER, 100, steps=4)
    return finish(img)


def prop_altar(seed: int = 14):
    """The altar in the middle of the arena, where the Crimson Reaper waits."""
    w, h = 76, 52
    img = new(w, h)
    base_y = h - 3
    # two stacked plinths, then a big slab
    block(img, 2, base_y - 12, w - 4, 12, STONE_LIGHT, bevel=2)
    block(img, 8, base_y - 24, w - 16, 13, STONE_BASE, bevel=1)
    for x in range(12, w - 12, 8):
        vline(img, x, base_y - 22, 10, shade(STONE_BASE, 0.84))
    # the slab: overhangs, lit top, blood in the runnel
    block(img, 0, base_y - 34, w, 11, STONE_PALE, bevel=2)
    hline(img, 0, base_y - 34, w, STONE_LIGHT)
    rect(img, 5, base_y - 32, w - 10, 3, mix(STONE_BASE, BLOOD, 0.55))
    for x in range(8, w - 8, 9):
        px(img, x, base_y - 31, BLOOD_LIGHT)
    # the sigil carved on the front face
    arc(img, w // 2, base_y - 17, 8, 0, 360, IRON_DARK, 2)
    for i in range(3):
        a = math.radians(-90 + i * 120)
        for r in range(2, 8):
            px(img, int(w // 2 + math.cos(a) * r), int(base_y - 17 + math.sin(a) * r), BONE_DARK)
    return finish(img)


def prop_rubble(seed: int = 15):
    w, h = 50, 28
    img = new(w, h)
    for (x, ww, hh) in ((2, 18, 12), (17, 14, 9), (30, 16, 11)):
        block(img, x, h - 3 - hh, ww, hh, STONE_BASE, bevel=1)
        for yy in range(h - 3 - hh + 2, h - 3, 4):
            hline(img, x + 1, yy, ww - 2, shade(STONE_BASE, 0.88))
        hline(img, x, h - 3 - hh, ww, STONE_PALE)
    return finish(img)


def prop_bench(seed: int = 16):
    w, h = 48, 26
    img = new(w, h)
    base_y = h - 3
    block(img, 2, base_y - 8, w - 4, 8, STONE_BASE, bevel=1)
    block(img, 1, base_y - 13, w - 2, 6, STONE_LIGHT)
    hline(img, 1, base_y - 13, w - 2, STONE_PALE)
    rect(img, 6, base_y - 6, 4, 5, STONE_DARK)
    rect(img, w - 10, base_y - 6, 4, 5, STONE_DARK)
    return finish(img)


def build_tiles() -> list:
    tiles = [("bedrock_a", lambda: rock(5)), ("bedrock_b", lambda: rock(11))]
    for quad, name in enumerate(("floor_a", "floor_b", "floor_c", "floor_d")):
        tiles.append((name, lambda q=quad: flag(19, q)))
    tiles.append(("floor_worn", lambda: flag(23, 0, tone=0.90)))
    tiles.append(("floor_broken", lambda: flag(29, 1, tone=0.94)))
    tiles.append(("blood_a", lambda: blood_floor(31, 0)))
    tiles.append(("blood_b", lambda: blood_floor(37, 2)))
    tiles.append(("shadow_edge", lambda: shadow_tile(97)))
    tiles.append(("wall_plinth", lambda: wall_plinth_tile(shade(STONE_BASE, 0.96), IRON_DARK)))
    tiles.append(("wall_field_a", lambda: _wall_block(41, 16, 1.02)))
    tiles.append(("wall_field_b", lambda: _wall_block(43, 16, 0.94)))
    tiles.append(("wall_dado_a", lambda: wall_field_tile(47, shade(STONE_LIGHT, 0.96), JOINT,
                                                         dado=True)))
    tiles.append(("wall_pier", lambda: wall_field_tile(53, shade(STONE_LIGHT, 1.06), JOINT,
                                                       pier=True)))
    tiles.append(("wall_cornice", lambda: wall_cornice_tile(shade(IRON, 0.9), STONE_LIGHT)))
    tiles.append(("wall_cap", lambda: wall_cap_tile(shade(STONE_PALE, 0.88), STONE_LIGHT)))
    tiles.append(("wall_plate", lambda: wall_plate()))
    tiles.append(("wall_banner", lambda: wall_banner()))
    for direction in ("h", "v"):
        tiles.append(("iron_" + direction, lambda d=direction: iron_band(d, 61)))
    for tag, opening in (("ring", None), ("ringE", "E"), ("ringW", "W")):
        for name, image in ring_tiles(2, opening, tag).items():
            tiles.append((name, lambda i=image: i.copy()))
    return tiles


def build_props() -> list:
    return [
        ("gate_tower", lambda: prop_gate_tower()),
        ("gate_tower_l", lambda: prop_gate_tower(mirror=True)),
        ("gate_arch", lambda: prop_gate_arch()),
        ("portcullis", lambda: prop_portcullis()),
        ("seal_bell", lambda: prop_seal_bell()),
        ("seal_brazier", lambda: prop_seal_brazier()),
        ("seal_wheel", lambda: prop_seal_wheel()),
        ("banner", lambda: prop_banner()),
        ("banner_torn", lambda: prop_banner(torn=True)),
        ("chain_column", lambda: prop_chain_column()),
        ("trophy_shields", lambda: prop_trophy_shields()),
        ("skulls", lambda: prop_skulls()),
        ("broken_blades", lambda: prop_broken_blades()),
        ("war_drum", lambda: prop_war_drum()),
        ("brazier", lambda: prop_brazier()),
        ("altar", lambda: prop_altar()),
        ("rubble", lambda: prop_rubble()),
        ("bench", lambda: prop_bench()),
    ]


def main() -> None:
    write_kit(ART, KIT, build_tiles(), build_props(), light_colour=(210, 228, 255))


if __name__ == "__main__":
    main()
