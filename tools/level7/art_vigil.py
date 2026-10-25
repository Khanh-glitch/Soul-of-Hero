#!/usr/bin/env python3
"""Level 7 — The Beacon Yard. Kit art.

A different place from the Relay House in every material: chalk-white weathered
limestone, blackened iron, and fire. Level 7 is a defensive muster-yard around a
Soul Beacon that has to survive three waves, so the kit is built for a yard under
siege: rampart stone that is pale and dry, iron bound around every joint, ember
light that stains the paving, and timber and stores stacked against the walls.

Nothing in this kit is a solid. The four lanes the enemies use must stay open, so
every piece of siege furniture is a sprite standing on a cell that was already
floor, and the composition keeps them at the wall feet.

Run: python3 tools/level7/art_vigil.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, T, _h01, block, courses, dither, finish, flag_quadrant, frame_box,
    glow, hline, mix, new, px, rect, rock_tile, shade, shadow_tile, vline,
    wall_cap_tile, wall_cornice_tile, wall_field_tile, wall_plinth_tile,
    write_kit,
)

ART = os.path.join(ROOT, "assets", "environment", "chapter1", "vigil")
KIT = "vigil"

# --- palette ---------------------------------------------------------------
# Chalk: a dry, warm-neutral stone, two steps lighter than the Relay House's cold
# grey. Iron is nearly black. The fire is the only saturated colour, so the eye
# goes to the flame before it goes anywhere else.
CHALK_DARK = (108, 102, 92)
CHALK_BASE = (156, 148, 134)
CHALK_LIGHT = (188, 180, 164)
CHALK_PALE = (214, 206, 188)
MORTAR = (86, 80, 72)
ROCK_DARK = (84, 78, 72)
ROCK_BASE = (108, 102, 94)
ROCK_LIGHT = (134, 128, 118)

IRON_DARK = (34, 32, 32)
IRON = (58, 56, 56)
IRON_LIGHT = (92, 90, 88)

EMBER_DEEP = (120, 40, 18)
EMBER = (214, 88, 32)
EMBER_LIGHT = (224, 132, 54)
EMBER_PALE = (236, 176, 100)
FLAME = (238, 204, 148)

TIMBER_DARK = (68, 50, 34)
TIMBER = (104, 78, 52)
TIMBER_LIGHT = (138, 106, 72)
LINEN = (198, 186, 158)
LINEN_DARK = (142, 132, 108)


def arc(img, cx, cy, r, a0, a1, colour, thickness=1.0) -> None:
    steps = max(8, int(abs(a1 - a0) * r))
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        for k in range(max(1, int(thickness))):
            px(img, int(cx + math.cos(a) * (r + k)), int(cy + math.sin(a) * (r + k)), colour)


def ray(img, x, y, angle, length, colour, thickness=1.0) -> None:
    a = math.radians(angle)
    for i in range(int(length)):
        for k in range(max(1, int(thickness))):
            px(img, int(x + math.cos(a) * i + k), int(y + math.sin(a) * i), colour)


# --- tiles -----------------------------------------------------------------
def chalk(seed: int):
    return rock_tile(seed, ROCK_DARK, ROCK_BASE, ROCK_LIGHT)


def flag(seed: int, quad: int, *, tone: float = 1.0, crack: bool = False,
         soot: bool = False):
    img = flag_quadrant(seed, quad, CHALK_BASE, MORTAR, tone=tone, crack=crack)
    if soot:
        # fire-stained paving: the yard's floor is grey at the middle and pale at
        # the edges, which is exactly where the Beacon stands
        dither(img, 0, 0, T, T, shade(CHALK_BASE, 0.72), 0.30, seed=seed + 7)
        dither(img, 0, 0, T, T, shade(CHALK_BASE, 0.58), 0.10, seed=seed + 11)
    return img


def worn(seed: int):
    img = flag(seed, 0, tone=0.90)
    for i in range(6):
        px(img, (seed * 13 + i * 7) % T, (seed * 5 + i * 11) % T, shade(CHALK_BASE, 1.16))
    hline(img, 1, T - 1, T - 2, shade(CHALK_BASE, 0.82))
    return img


def broken(seed: int):
    img = flag(seed, 1, tone=0.96, crack=True)
    rect(img, 8, 9, 7, 5, shade(CHALK_BASE, 0.66))
    hline(img, 8, 9, 7, shade(CHALK_BASE, 1.18))
    return img


def studded(direction: str, seed: int):
    """Iron-studded paving: the four lanes the waves come down."""
    img = flag(seed, 0, tone=0.94)
    if direction == "h":
        hline(img, 0, 3, T, IRON_DARK)
        hline(img, 0, 4, T, IRON)
        hline(img, 0, 11, T, IRON)
        hline(img, 0, 12, T, IRON_DARK)
        for x in (3, 12):
            rect(img, x, 2, 2, 2, IRON_LIGHT)
            rect(img, x, 12, 2, 2, IRON_LIGHT)
    else:
        vline(img, 3, 0, T, IRON_DARK)
        vline(img, 4, 0, T, IRON)
        vline(img, 11, 0, T, IRON)
        vline(img, 12, 0, T, IRON_DARK)
        for y in (3, 12):
            rect(img, 2, y, 2, 2, IRON_LIGHT)
            rect(img, 12, y, 2, 2, IRON_LIGHT)
    return img


def apron(seed: int):
    """The raised chalk apron around the Beacon: paler, drier, swept clean."""
    img = flag_quadrant(seed, 2, CHALK_LIGHT, shade(MORTAR, 1.10), tone=1.06)
    for y in range(T):
        for x in range(T):
            if ((x * 11 + y * 7 + seed) % 23) < 2:
                px(img, x, y, shade(CHALK_LIGHT, 1.10))
    hline(img, 0, T - 1, T, shade(MORTAR, 1.06))
    return img


def scorch(seed: int, *, heavy: bool = False):
    """Ash and ember burn on the paving, painted not decal-shaped."""
    img = flag(seed, 2, tone=0.92)
    dither(img, 0, 0, T, T, (36, 30, 28), 0.55 if heavy else 0.32, seed=seed + 3)
    dither(img, 0, 0, T, T, (18, 15, 14), 0.22 if heavy else 0.10, seed=seed + 5)
    for i in range(3 if heavy else 2):
        x = (_h01(seed, i, 3) * T) % T
        y = (_h01(seed, i, 7) * T) % T
        px(img, int(x), int(y), EMBER if _h01(seed, i, 9) > 0.5 else EMBER_DEEP)
    return img


def ash(seed: int):
    img = flag(seed, 3, tone=0.86)
    dither(img, 0, 0, T, T, (52, 46, 42), 0.40, seed=seed + 2)
    return img


def ward_ring_plate(seed: int = 0):
    """The inlaid ward line around the Beacon: an octagonal iron ring with
    radiating ward marks. Cut into 16 px tiles by ward_tiles()."""
    return seed


def ward_tiles(radius: int = 6):
    span = 2 * radius + 1
    size = span * T
    canvas = new(size, size)
    cx = cy = size / 2 - 0.5
    r_out = radius * T - 6
    # a plate of ash-darkened chalk, so the ring separates from the pale yard
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d > r_out + 2:
                n = ((x * 29 + y * 17) % 13) / 13.0
                px(canvas, x, y, shade(mix(CHALK_BASE, MORTAR, 0.35), 0.94 + n * 0.10))
                continue
            band = int((r_out - d) // 10)
            base = mix(CHALK_DARK, MORTAR, 0.35)
            tone = 1.05 if band % 2 == 0 else 0.86
            n = ((x * 13 + y * 7) % 11) / 11.0
            px(canvas, x, y, shade(base, tone * (0.96 + n * 0.08)))
    # the ring itself: iron, with a hot line down the middle of it
    arc(canvas, cx, cy, r_out - 12, 0, 360, IRON_DARK, 5)
    arc(canvas, cx, cy, r_out - 12, 0, 360, IRON, 3)
    arc(canvas, cx, cy, r_out - 12, 0, 360, EMBER_DEEP, 1)
    arc(canvas, cx, cy, r_out - 30, 0, 360, IRON, 2)
    # eight ward marks, one per compass point, like stubs of burnt rope
    for i in range(8):
        a = math.radians(i * 45)
        for r in range(10, int(r_out) - 34):
            if r % 7 > 3:
                continue
            px(canvas, int(cx + math.cos(a) * r), int(cy + math.sin(a) * r), IRON)
    # a hot core where the Beacon stands
    glow(canvas, cx, cy, 13, 13, EMBER, 90, steps=3)
    glow(canvas, cx, cy, 6, 6, EMBER_LIGHT, 110, steps=2)
    frames = {}
    for ty in range(span):
        for tx in range(span):
            frames["ward_%d_%d" % (tx - radius, ty - radius)] = \
                canvas.crop((tx * T, ty * T, tx * T + T, ty * T + T))
    return frames


def ward_offsets(radius: int = 6):
    return {(dx, dy): "ward_%d_%d" % (dx, dy)
            for dy in range(-radius, radius + 1)
            for dx in range(-radius, radius + 1)}


def _wall_field(seed: int, tone: float, *, dado=False, pier=False):
    return wall_field_tile(seed, shade(CHALK_LIGHT, tone), MORTAR, dado=dado, pier=pier)


def _wall_arrow_slit():
    """A narrow arrow slit: the yard is a defensive work and the walls say so."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(CHALK_LIGHT, 0.98))
    courses(img, 0, 0, T, T, shade(CHALK_LIGHT, 1.0), row_h=8, seed=61, mortar=MORTAR)
    rect(img, 6, 2, 4, T - 4, shade(CHALK_DARK, 0.55))
    rect(img, 7, 2, 2, T - 4, (26, 24, 24))
    vline(img, 5, 2, T - 4, CHALK_PALE)
    vline(img, 10, 2, T - 4, shade(CHALK_DARK, 0.9))
    return img


def _wall_ember_band():
    """A wall course carrying an iron fire-basket bracket."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(CHALK_LIGHT, 1.02))
    courses(img, 0, 0, T, T, shade(CHALK_LIGHT, 1.02), row_h=8, seed=63, mortar=MORTAR)
    rect(img, 0, 9, T, 2, IRON_DARK)
    hline(img, 0, 9, T, IRON)
    hline(img, 0, 8, T, shade(CHALK_PALE, 1.02))
    for x in (2, 9):
        rect(img, x, 6, 2, 3, IRON_LIGHT)
        px(img, x, 6, EMBER_LIGHT)
    return img


def _wall_buttress():
    """A projecting buttress face, seen head-on: the yard's outer wall."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(CHALK_LIGHT, 0.92))
    block(img, 1, 0, T - 2, T, shade(CHALK_BASE, 1.04))
    hline(img, 1, 0, T - 2, CHALK_PALE)
    vline(img, 1, 0, T, shade(CHALK_PALE, 0.92))
    vline(img, T - 2, 0, T, shade(CHALK_DARK, 0.92))
    for y in (5, 11):
        hline(img, 2, y, T - 4, shade(CHALK_DARK, 0.86))
        hline(img, 2, y - 1, T - 4, CHALK_PALE)
    rect(img, 6, 6, 4, 2, IRON)
    return img


# --- props -----------------------------------------------------------------
def _feet(img, width, base_y):
    block(img, width // 2 - 12, base_y - 8, 24, 8, shade(CHALK_BASE, 0.94))


def prop_watch_pillar(seed: int = 1):
    """A watch pillar: chalk shaft, iron collar, fire bowl at the top.

    The Beacon itself is a live entity with its own sprite and health, so the
    architecture around it must frame it rather than stand on it. Four of these
    hold the ward ring's corners and give the arena a silhouette at gameplay zoom.
    """
    w, h = 40, 146
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    # stepped base
    for i, width in enumerate((34, 26)):
        block(img, cx - width // 2, base_y - 10 - i * 8, width, 10,
              shade(CHALK_BASE, 0.96 + i * 0.05))
        hline(img, cx - width // 2, base_y - 10 - i * 8, width, CHALK_PALE)
        hline(img, cx - width // 2, base_y - 2 - i * 8, width, IRON_DARK)
    # shaft, tapering slightly
    shaft_bottom = base_y - 26
    shaft_top = shaft_bottom - 74
    for y in range(shaft_top, shaft_bottom):
        t = (shaft_bottom - y) / 74.0
        half = int(12 - t * 2.5)
        rect(img, cx - half, y, half * 2, 1, CHALK_BASE)
        px(img, cx - half, y, CHALK_PALE)
        px(img, cx - half + 1, y, CHALK_LIGHT)
        px(img, cx + half - 1, y, shade(CHALK_DARK, 0.92))
        px(img, cx + half - 2, y, shade(CHALK_BASE, 0.88))
        # carved channel down the front face
        px(img, cx, y, shade(CHALK_DARK, 0.96) if y % 2 else CHALK_LIGHT)
    # iron collars
    for y in (shaft_bottom - 6, shaft_top + 34, shaft_top + 6):
        block(img, cx - 13, y, 26, 4, IRON)
        hline(img, cx - 13, y, 26, IRON_LIGHT)
        hline(img, cx - 13, y + 3, 26, IRON_DARK)
    # capital and fire bowl
    cap_y = shaft_top - 4
    block(img, cx - 15, cap_y, 30, 8, CHALK_PALE, right=shade(CHALK_DARK, 0.9))
    hline(img, cx - 15, cap_y - 1, 30, IRON_LIGHT)
    bowl_y = cap_y - 18
    for y in range(bowl_y, bowl_y + 14):
        t = (y - bowl_y) / 14.0
        half = int(9 + t * 8)
        for x in range(cx - half, cx + half):
            if abs(x - cx) > half - 3:
                px(img, x, y, IRON_LIGHT if x < cx else IRON)
            elif (x * 3 + y) % 7 == 0:
                px(img, x, y, IRON_DARK)
            else:
                px(img, x, y, EMBER_DEEP)
    for i in range(24):
        t = i / 24
        half = max(1, int(11 * (1 - t) ** 0.85))
        offset = int(math.sin(i / 3.4) * 2)
        for x in range(cx - half + offset, cx + half + offset):
            d = abs(x - cx - offset) / max(1, half)
            px(img, x, bowl_y - i, FLAME if d < 0.3 else (EMBER_PALE if d < 0.6 else EMBER_LIGHT))
    glow(img, cx, bowl_y - 12, 26, 20, EMBER_LIGHT, 120, steps=4)
    glow(img, cx, bowl_y - 6, 12, 9, FLAME, 90, steps=3)
    return finish(img)


def prop_brazier(seed: int = 2):
    """A watch brazier: iron basket on three legs, the yard's unit of light."""
    w, h = 34, 52
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    for side in (-1, 1):
        for i in range(18):
            px(img, cx + side * (2 + i // 2), base_y - i, IRON)
            px(img, cx + side * (3 + i // 2), base_y - i, IRON_LIGHT)
    for y in range(18, 30):
        half = int(9 + (y - 18) * 0.55)
        for x in range(cx - half, cx + half):
            if abs(x - cx) > half - 2:
                px(img, x, y, IRON_LIGHT)
            elif (x + y) % 5 == 0:
                px(img, x, y, IRON_DARK)
            else:
                px(img, x, y, EMBER_DEEP if y > 22 else EMBER)
    hline(img, cx - 15, 18, 30, IRON_LIGHT)
    for i in range(14):
        t = i / 14
        half = int(max(1, 10 * (1 - t)))
        offset = int(math.sin(i / 2.6) * 2)
        for x in range(cx - half + offset, cx + half + offset):
            px(img, x, 16 - i, FLAME if abs(x - cx - offset) < 3 else EMBER_LIGHT)
    glow(img, cx, 10, 20, 16, EMBER_LIGHT, 120, steps=4)
    return finish(img)


def prop_banner(seed: int = 3, *, torn: bool = False):
    """A muster banner: saffron field, iron rod, the chapter's two-ring mark."""
    w, h = 34, 94
    img = new(w, h)
    cx = w // 2
    block(img, 1, 6, w - 2, 3, IRON)
    hline(img, 1, 6, w - 2, IRON_LIGHT)
    for y in range(9, 86):
        t = (y - 9) / 77
        half = int(13 - t * 1.5)
        for x in range(cx - half, cx + half):
            if torn and y > 56 and (x + y) % 11 < 2:
                continue
            colour = LINEN if (x * 7 + y * 3) % 29 else LINEN_DARK
            if x in (cx - half, cx + half - 1):
                colour = shade(LINEN, 0.80)
            px(img, x, y, colour)
    # ember-dyed chevron band and the two-ring mark
    for y in range(20, 25):
        for x in range(cx - 12, cx + 12):
            if (x + y) % 3:
                px(img, x, y, EMBER_DEEP)
    arc(img, cx, 44, 7, 0, 360, IRON_DARK, 2)
    arc(img, cx, 52, 7, 0, 360, IRON_DARK, 2)
    arc(img, cx, 44, 7, 200, 340, EMBER, 1)
    arc(img, cx, 52, 7, 20, 160, EMBER, 1)
    if torn:
        for x in range(cx - 12, cx + 13):
            px(img, x, 84 + (x % 5), shade(LINEN, 0.7))
    return finish(img)


def prop_spears(seed: int = 4):
    """A spear rack: the yard is armed."""
    w, h = 44, 56
    img = new(w, h)
    base_y = h - 4
    block(img, 2, base_y - 8, w - 4, 8, shade(CHALK_BASE, 0.92))
    hline(img, 2, base_y - 8, w - 4, CHALK_PALE)
    for i, x in enumerate((8, 14, 22, 30, 36)):
        top = 6 + (i % 3) * 3
        vline(img, x, top, base_y - 8 - top, TIMBER)
        vline(img, x + 1, top, base_y - 8 - top, shade(TIMBER, 0.8))
        # leaf-shaped head
        for k in range(6):
            half = max(1, 3 - k // 2)
            for dx in range(-half, half + 1):
                px(img, x + dx, top - 6 + k, IRON_LIGHT if dx else CHALK_PALE)
    rect(img, 4, base_y - 20, w - 8, 3, IRON)
    hline(img, 4, base_y - 20, w - 8, IRON_LIGHT)
    return finish(img)


def prop_arrows(seed: int = 5):
    """A sheaf of spent arrows stuck in the ground, the yard's litter."""
    w, h = 30, 30
    img = new(w, h)
    for i in range(7):
        x = 5 + i * 3 + (i % 2)
        top = 4 + (i % 4) * 3
        vline(img, x, top, h - 6 - top, TIMBER)
        for k in range(4):
            px(img, x - 1 + k // 2, top - k, IRON_LIGHT)
            px(img, x + 1 - k // 2, top - k, IRON)
        px(img, x, h - 8, LINEN_DARK)
    return finish(img, shadow=True)


def prop_crates(seed: int = 6):
    """Supply crates stacked against a wall."""
    w, h = 46, 40
    img = new(w, h)
    block(img, 2, h - 22, 24, 20, TIMBER)
    for y in range(h - 22, h - 3, 5):
        hline(img, 2, y, 24, shade(TIMBER, 0.74))
    vline(img, 13, h - 22, 20, TIMBER_LIGHT)
    block(img, 26, h - 18, 18, 16, shade(TIMBER, 0.92))
    for y in range(h - 18, h - 3, 5):
        hline(img, 26, y, 18, shade(TIMBER, 0.68))
    block(img, 8, h - 34, 20, 13, shade(TIMBER, 1.06))
    hline(img, 8, h - 34, 20, TIMBER_LIGHT)
    vline(img, 17, h - 34, 13, shade(TIMBER, 0.8))
    for (x, y) in ((6, h - 8), (24, h - 6), (36, h - 5)):
        px(img, x, y, IRON_LIGHT)
    return finish(img)


def prop_shield_rack(seed: int = 7):
    """Three round shields leaning on a rail, painted one by one."""
    w, h = 48, 36
    img = new(w, h)
    base_y = h - 4
    vline(img, 5, 10, base_y - 10, TIMBER)
    vline(img, 42, 10, base_y - 10, TIMBER)
    hline(img, 5, 14, 38, TIMBER_LIGHT)
    for k, cx in enumerate((14, 24, 34)):
        cy = base_y - 15
        radius = 10
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 > radius * radius:
                    continue
                d = math.hypot(x - cx, y - cy) / radius
                if d > 0.86:
                    px(img, x, y, IRON_LIGHT if x < cx else IRON)
                elif d > 0.72:
                    px(img, x, y, TIMBER if k % 2 else shade(TIMBER, 0.86))
                elif d > 0.18:
                    px(img, x, y, CHALK_LIGHT if k % 2 else shade(CHALK_BASE, 1.05))
                else:
                    px(img, x, y, IRON)
        px(img, cx, cy, EMBER)
    return finish(img)


def prop_barrel(seed: int = 8):
    w, h = 24, 30
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    for y in range(6, base_y):
        t = (y - 6) / (base_y - 6)
        half = int(8 + math.sin(t * 3.1) * 2)
        for x in range(cx - half, cx + half):
            px(img, x, y, TIMBER if x < cx + 3 else shade(TIMBER, 0.82))
    for y in (9, 20):
        hline(img, cx - 9, y, 18, IRON)
        hline(img, cx - 9, y + 1, 18, shade(IRON_LIGHT, 0.8))
    rect(img, cx - 6, 4, 12, 3, shade(TIMBER, 1.1))
    return finish(img)


def prop_rubble(seed: int = 9):
    w, h = 42, 26
    img = new(w, h)
    for (x, y, ww, hh) in ((3, 18, 13, 8), (15, 20, 10, 6), (23, 16, 13, 10), (9, 12, 9, 7)):
        block(img, x, y, ww, hh, CHALK_BASE, right=shade(CHALK_DARK, 0.9))
    px(img, 19, 10, IRON)
    px(img, 30, 13, EMBER_DEEP)
    return finish(img)


def prop_bench(seed: int = 10):
    w, h = 44, 22
    img = new(w, h)
    block(img, 2, 6, 40, 7, CHALK_LIGHT)
    hline(img, 2, 5, 40, CHALK_PALE)
    rect(img, 5, 13, 6, 7, shade(CHALK_BASE, 0.88))
    rect(img, 33, 13, 6, 7, shade(CHALK_BASE, 0.88))
    rect(img, 8, 9, 28, 1, IRON_DARK)
    return finish(img)


def prop_well(seed: int = 11):
    """A capped cistern: the one bit of the yard that is not about fighting."""
    w, h = 48, 44
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    for y in range(base_y - 22, base_y):
        half = int(21 - (y - (base_y - 22)) * 0.12)
        rect(img, cx - half, y, half * 2, 1, CHALK_BASE)
        px(img, cx - half, y, CHALK_PALE)
        px(img, cx + half - 1, y, shade(CHALK_DARK, 0.9))
    rect(img, cx - 19, base_y - 25, 38, 5, CHALK_LIGHT)
    hline(img, cx - 19, base_y - 25, 38, CHALK_PALE)
    rect(img, cx - 14, base_y - 24, 28, 3, (28, 32, 34))
    hline(img, cx - 14, base_y - 24, 28, IRON_DARK)
    for x in (cx - 8, cx + 7):
        vline(img, x, base_y - 38, 14, TIMBER)
    hline(img, cx - 10, base_y - 38, 21, TIMBER_LIGHT)
    return finish(img)


def prop_iron_ring(seed: int = 12):
    """A wall ring for tethering horses and, tonight, for tying off a line."""
    w, h = 22, 26
    img = new(w, h)
    block(img, 3, 2, 16, 6, CHALK_LIGHT)
    hline(img, 3, 2, 16, CHALK_PALE)
    arc(img, 11, 16, 7, 0, 360, IRON, 3)
    arc(img, 11, 16, 7, 200, 340, IRON_LIGHT, 1)
    vline(img, 11, 8, 4, IRON_DARK)
    return finish(img, shadow=False)


def prop_torch_bracket(seed: int = 13):
    w, h = 20, 40
    img = new(w, h)
    vline(img, 10, 6, 22, IRON)
    vline(img, 11, 6, 22, IRON_LIGHT)
    for i in range(6):
        px(img, 6 + i, 26 - i // 2, IRON)
        px(img, 15 - i, 26 - i // 2, IRON)
    rect(img, 6, 26, 8, 4, IRON_DARK)
    for i in range(10):
        t = i / 10
        half = max(1, int(4 * (1 - t)))
        for x in range(10 - half, 10 + half):
            px(img, x, 26 - i, FLAME if half < 3 else EMBER_LIGHT)
    glow(img, 10, 22, 12, 10, EMBER_LIGHT, 110, steps=3)
    return finish(img, shadow=False)


def prop_sandbags(seed: int = 14):
    w, h = 44, 24
    img = new(w, h)
    for row in range(3):
        y = h - 6 - row * 6
        for i in range(4 - row % 2):
            x = 3 + i * 10 + (row % 2) * 5
            block(img, x, y - 5, 9, 6, mix(LINEN, CHALK_BASE, 0.4))
            px(img, x + 4, y - 1, shade(LINEN, 0.8))
    return finish(img)


def prop_fire_wood(seed: int = 15):
    w, h = 40, 26
    img = new(w, h)
    for i, (x, y) in enumerate(((2, 14), (4, 8), (20, 16))):
        ww = 18 if i < 2 else 16
        hh = 6
        block(img, x, y, ww, hh, TIMBER)
        hline(img, x, y, ww, TIMBER_LIGHT)
        for k in range(x + 2, x + ww - 2, 4):
            px(img, k, y + 3, shade(TIMBER, 0.72))
    px(img, 14, 12, EMBER_DEEP)
    return finish(img)


# --- build -----------------------------------------------------------------
def build_tiles() -> list:
    tiles = [("bedrock_a", lambda: chalk(5)), ("bedrock_b", lambda: chalk(17))]
    for quad, name in enumerate(("floor_a", "floor_b", "floor_c", "floor_d")):
        tiles.append((name, lambda q=quad: flag(23, q)))
    tiles.append(("floor_worn", lambda: worn(31)))
    tiles.append(("floor_broken", lambda: broken(37)))
    tiles.append(("shadow_edge", lambda: shadow_tile(92)))
    tiles.append(("wall_plinth", lambda: wall_plinth_tile(shade(CHALK_LIGHT, 0.92), IRON)))
    tiles.append(("wall_field_a", lambda: _wall_field(41, 0.94)))
    tiles.append(("wall_field_b", lambda: _wall_field(43, 1.02)))
    tiles.append(("wall_dado_a", lambda: _wall_field(47, 1.08, dado=True)))
    tiles.append(("wall_pier", lambda: _wall_field(53, 1.04, pier=True)))
    tiles.append(("wall_cornice", lambda: wall_cornice_tile(IRON, shade(CHALK_LIGHT, 0.98))))
    tiles.append(("wall_cap", lambda: wall_cap_tile(shade(CHALK_PALE, 0.88), CHALK_LIGHT)))
    tiles.append(("wall_slit", lambda: _wall_arrow_slit()))
    tiles.append(("wall_ember", lambda: _wall_ember_band()))
    tiles.append(("wall_buttress", lambda: _wall_buttress()))
    for direction in ("h", "v"):
        tiles.append(("lane_" + direction, lambda d=direction: studded(d, 12)))
    tiles.append(("scorch_a", lambda: scorch(29)))
    tiles.append(("scorch_b", lambda: scorch(43, heavy=True)))
    tiles.append(("ash_a", lambda: ash(53)))
    tiles.append(("apron", lambda: apron(19)))
    for name, image in ward_tiles(6).items():
        tiles.append((name, lambda i=image: i.copy()))
    return tiles


def build_props() -> list:
    return [
        ("watch_pillar", lambda: prop_watch_pillar()),
        ("brazier", lambda: prop_brazier()),
        ("banner", lambda: prop_banner()),
        ("banner_torn", lambda: prop_banner(torn=True)),
        ("spears", lambda: prop_spears()),
        ("arrows", lambda: prop_arrows()),
        ("crates", lambda: prop_crates()),
        ("shields", lambda: prop_shield_rack()),
        ("barrel", lambda: prop_barrel()),
        ("rubble", lambda: prop_rubble()),
        ("bench", lambda: prop_bench()),
        ("well", lambda: prop_well()),
        ("iron_ring", lambda: prop_iron_ring()),
        ("torch_bracket", lambda: prop_torch_bracket()),
        ("sandbags", lambda: prop_sandbags()),
        ("fire_wood", lambda: prop_fire_wood()),
    ]


def main() -> None:
    write_kit(ART, KIT, build_tiles(), build_props(), light_colour=(255, 214, 156), gamma=0.90)


if __name__ == "__main__":
    main()
