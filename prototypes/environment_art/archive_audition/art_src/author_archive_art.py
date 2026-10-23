#!/usr/bin/env python3
"""Author the original pixel art for the Monastic Archive prototype.

Everything here is generated procedurally from primitives — no third-party
sprite is copied, sampled or traced. The palette is derived from the values
already used by Soul of Hero's shipped dungeon atlas so the room sits inside the
existing visual language (warm bone stone, dark mortar, timber, parchment, with
the game's teal as the single cool accent).

Outputs (all 16 px per tile unless stated):
    art/archive_tiles.png   floor + wall faces + decals, 8 columns
    art/wall_caps.png       wall top autotile, 16 variants indexed by
                            (N=1, E=2, S=4, W=8) neighbour bitmask
    art/props.png           multi-tile props, see art/props.json
    art/light_radial.png    soft radial light texture for PointLight2D
    art/props.json          frame manifest: name -> x, y, w, h (pixels)

Run:  python3 author_archive_art.py
"""

from __future__ import annotations

import json
import math
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, "..", "art"))
T = 16

# ---------------------------------------------------------------------------
# Palette (font: shipped dungeon atlas + a parchment/timber range)
# ---------------------------------------------------------------------------
FLOOR_D = (58, 51, 46)
FLOOR_M = (72, 62, 55)
FLOOR_L = (88, 76, 66)
FLOOR_HI = (104, 90, 78)
GROUT = (36, 30, 27)

CAP_D = (64, 56, 49)
CAP_M = (92, 80, 69)
CAP_L = (112, 97, 83)
CAP_HI = (134, 117, 100)

FACE_D = (74, 60, 51)
FACE_M = (104, 84, 70)
FACE_L = (134, 110, 92)
FACE_HI = (162, 136, 114)
MORTAR = (46, 37, 31)

WOOD_D = (72, 44, 27)
WOOD_M = (104, 64, 38)
WOOD_L = (134, 88, 52)
WOOD_HI = (166, 118, 74)

PARCH = (222, 205, 168)
PARCH_L = (243, 232, 204)
PARCH_D = (186, 166, 128)
INK = (44, 35, 30)
SEAL = (150, 52, 46)
SEAL_L = (190, 82, 68)
BIND_BLUE = (54, 78, 112)
BIND_GREEN = (58, 92, 72)
BIND_RED = (122, 52, 44)
THREAD = (198, 176, 132)

STONE_GREY = (92, 94, 96)
STONE_GREY_L = (124, 126, 128)
STONE_GREY_D = (62, 64, 66)

# Standing water in a lamp-lit undercroft: near-black with a faint cold cast.
# Saturated blue reads as spilled paint at gameplay zoom, so the whole ramp is
# pulled towards the stone instead of away from it.
WATER_D = (33, 41, 46)
WATER_M = (44, 55, 62)
WATER_L = (68, 83, 92)
TEAL = (78, 102, 104)
TEAL_D = (33, 45, 48)

MOSS = (62, 84, 58)
MOSS_L = (88, 116, 74)
SOOT = (30, 26, 24)

RNG = random.Random(20261023)


def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(img: Image.Image, x: int, y: int, colour) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), colour if len(colour) == 4 else colour + (255,))


def rect(img, x, y, w, h, colour) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            px(img, xx, yy, colour)


def frame_rect(img, x, y, w, h, colour) -> None:
    for xx in range(x, x + w):
        px(img, xx, y, colour)
        px(img, xx, y + h - 1, colour)
    for yy in range(y, y + h):
        px(img, x, yy, colour)
        px(img, x + w - 1, yy, colour)


def hline(img, x, y, w, colour):
    for xx in range(x, x + w):
        px(img, xx, y, colour)


def vline(img, x, y, h, colour):
    for yy in range(y, y + h):
        px(img, x, yy, colour)


def shade(colour, amount: float):
    """amount < 1 darkens, > 1 lightens (clamped)."""
    return tuple(max(0, min(255, int(c * amount))) for c in colour[:3])


# ---------------------------------------------------------------------------
# Floors: 16x16 flagstones, 8x8 slabs, worn / broken variants
# ---------------------------------------------------------------------------
def floor_flagstone(seed: int, tone: int = 0, cracks: int = 0) -> Image.Image:
    rng = random.Random(seed)
    img = new(T, T)
    base = (FLOOR_D, FLOOR_M, FLOOR_L)[tone % 3]
    rect(img, 0, 0, T, T, GROUT)
    # two staggered slabs per tile
    slabs = [
        (0, 0, 9, 8),
        (9, 0, 7, 8),
        (0, 8, 6, 8),
        (6, 8, 10, 8),
    ]
    for (x, y, w, h) in slabs:
        shade_tone = rng.choice([0.97, 1.0, 1.03, 1.06])
        body = shade(base, shade_tone)
        rect(img, x, y, w, h, body)
        # top-left bevel, bottom-right shadow — kept subtle so a field of tiles
        # reads as one worn floor rather than a grid of buttons
        hline(img, x, y, w, shade(body, 1.07))
        vline(img, x, y, h, shade(body, 1.04))
        hline(img, x, y + h - 1, w, shade(body, 0.9))
        vline(img, x + w - 1, y, h, shade(body, 0.86))
        # pitted surface
        for _ in range(rng.randint(1, 3)):
            px(img, x + rng.randint(1, max(1, w - 2)), y + rng.randint(1, max(1, h - 2)),
               shade(body, 0.9))
    for _ in range(cracks):
        x0 = rng.randint(3, 12)
        y0 = rng.randint(2, 6)
        x, y = x0, y0
        for _step in range(rng.randint(4, 8)):
            px(img, x, y, shade(base, 0.62))
            x += rng.choice([-1, 0, 0, 1])
            y += 1
            if y > 14:
                break
    return img


def floor_quarry(seed: int, tone: int = 0) -> Image.Image:
    """Diagonal quarry tiles — used in the scriptorium aisles."""
    rng = random.Random(seed)
    img = new(T, T)
    base = shade(FLOOR_M, 1.0 + tone * 0.05)
    rect(img, 0, 0, T, T, base)
    for i in range(0, T * 2, 8):
        for x in range(T):
            y = i - x
            if 0 <= y < T:
                px(img, x, y, shade(base, 0.74))
                px(img, x, y + 1, shade(base, 1.1))
    for _ in range(6):
        px(img, rng.randint(0, 15), rng.randint(0, 15), shade(base, rng.choice([0.9, 1.08])))
    return img


def floor_worn(seed: int) -> Image.Image:
    """Worn / damp floor: darker with grit, used along shelf ranges.

    Built by blending an opaque darken layer — drawing a translucent rectangle
    straight onto an RGBA tile would leave the tile semi-transparent and the
    background would show through it in game.
    """
    base = floor_flagstone(seed, tone=0, cracks=2)
    dark = Image.new("RGBA", (T, T), (44, 37, 33, 255))
    return Image.blend(base, dark, 0.42)


def floor_grate(seed: int) -> Image.Image:
    """Iron drain grate in the water aisle (thin bars, recessed)."""
    rng = random.Random(seed)
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(STONE_GREY_D, 0.9))
    rect(img, 1, 1, 14, 14, (26, 24, 24))
    for x in range(2, 14, 3):
        vline(img, x, 2, 12, shade(STONE_GREY, 1.1))
        vline(img, x + 1, 2, 12, shade(STONE_GREY_D, 0.8))
    hline(img, 1, 1, 14, shade(STONE_GREY_L, 0.9))
    hline(img, 0, 0, 16, (0, 0, 0, 0))
    for x in range(1, 15):
        if (x + seed) % 5 == 0:
            px(img, x, 6, (0, 0, 0, 0))
    px(img, 7, 7, shade(STONE_GREY_L, 1.1)) if rng else None
    return img


# ---------------------------------------------------------------------------
# Wall tops (cap) — 16 neighbour variants
# ---------------------------------------------------------------------------
def wall_cap(mask: int) -> Image.Image:
    """mask bits: 1=N, 2=E, 4=S, 8=W  (1 = neighbour wall exists)."""
    n, e, s, w = mask & 1, mask & 2, mask & 4, mask & 8
    img = new(T, T)
    rect(img, 0, 0, T, T, CAP_M)
    # stone joints: an 8px grid, offset per row, only where the run continues
    for jx in (0, 8):
        for jy in range(0, T, 8):
            ox = 4 if (jy // 8) % 2 else 0
            x = (jx + ox) % T
            vline(img, x, jy, 8, shade(CAP_M, 0.84))
            hline(img, 0, jy, T, shade(CAP_M, 0.88))
    # subtle mottling
    rng = random.Random(mask * 977)
    for _ in range(5):
        px(img, rng.randint(1, 14), rng.randint(1, 14), shade(CAP_M, rng.choice([0.92, 1.06])))

    # lit bevel on any exposed edge (outer edges of the masonry mass)
    if not n:
        hline(img, 0, 0, T, CAP_HI)
        hline(img, 0, 1, T, CAP_L)
    if not w:
        vline(img, 0, 0, T, shade(CAP_L, 1.05))
        vline(img, 1, 0, T, CAP_M)
    if not e:
        vline(img, 15, 0, T, shade(CAP_D, 0.9))
        vline(img, 14, 0, T, CAP_D)
    if not s:
        # the face takes over; keep a hard termination line at the cap's lip
        hline(img, 0, 15, T, shade(CAP_D, 0.86))
        hline(img, 0, 14, T, shade(CAP_D, 1.02))
    # inner corner shadow where the mass steps in
    if n and w and not (mask & 0):
        pass
    return img


# ---------------------------------------------------------------------------
# Wall faces — the vertical masonry seen below a wall top
# ---------------------------------------------------------------------------
def brick_face(
    seed: int,
    *,
    courses: int = 4,
    mortar: bool = True,
    lit: bool = True,
    base=FACE_M,
) -> Image.Image:
    """16x16 of coursed ashlar, 4 courses of ~4 px."""
    rng = random.Random(seed)
    img = new(T, T)
    rect(img, 0, 0, T, T, MORTAR if mortar else base)
    ch = T // courses
    for row in range(courses):
        y = row * ch
        offset = (row % 2) * 4 + rng.choice([0, 1])
        x = -offset
        while x < T:
            bw = rng.choice([7, 8, 9, 10])
            body = shade(base, rng.choice([0.92, 1.0, 1.06, 1.12]))
            bx = max(0, x)
            bw_vis = min(T - bx, x + bw - bx)
            if bw_vis > 0:
                rect(img, bx, y, bw_vis, ch - 1, body)
                hline(img, bx, y, bw_vis, shade(body, 1.16) if lit else shade(body, 0.94))
                if bx > 0:
                    vline(img, bx, y, ch - 1, shade(body, 0.84))
            x += bw
    # soft damp at the base
    for x in range(T):
        px(img, x, T - 1, shade(base, 0.72))
        px(img, x, T - 2, shade(base, 0.84))
    return img


def face_end(seed: int, *, side: int) -> Image.Image:
    """Terminating pier of a wall face: a projecting quoin at one end."""
    img = brick_face(seed, courses=4)
    edge = 0 if side < 0 else T - 4
    rect(img, edge, 0, 4, T, shade(FACE_L, 1.06))
    vline(img, edge, 0, T, shade(FACE_HI, 1.05))
    vline(img, edge + 3 if side < 0 else edge + 3, 0, T, shade(FACE_D, 0.86))
    for y in range(0, T, 5):
        px(img, edge, y, shade(FACE_HI, 1.12))
        px(img, edge + 1, y, shade(FACE_L, 0.96))
    # shadow the room-facing side of the pier
    if side < 0:
        for y in range(T):
            px(img, 4, y, shade(FACE_D, 0.8))
    else:
        for y in range(T):
            px(img, T - 5, y, shade(FACE_D, 0.8))
    return img


def face_niche(seed: int, *, filled: str = "scrolls") -> Image.Image:
    """A recessed shelf niche carved into the wall face: the archive's grammar."""
    img = brick_face(seed, courses=2, base=shade(FACE_M, 0.98))
    # recess
    rect(img, 2, 3, 12, 11, shade(FACE_D, 0.72))
    frame_rect(img, 1, 2, 14, 13, shade(FACE_HI, 0.92))
    frame_rect(img, 2, 3, 12, 11, shade(FACE_L, 1.02))
    # back panel
    rect(img, 3, 4, 10, 9, shade(FACE_D, 0.78))
    # shelf
    hline(img, 3, 9, 10, shade(WOOD_M, 0.9))
    hline(img, 3, 10, 10, shade(WOOD_D, 0.8))
    if filled == "scrolls":
        rng = random.Random(seed + 5)
        for i in range(4):
            x = 4 + i * 2 + rng.randint(0, 1)
            vline(img, x, 5, 5, PARCH_D if i % 2 else PARCH)
            vline(img, x + 1, 5, 5, shade(PARCH_D, 0.9))
            px(img, x, 4, THREAD)
        for i in range(3):
            px(img, 4 + i * 3, 11, BIND_RED if i == 1 else BIND_GREEN)
            hline(img, 4 + i * 3, 11, 2, BIND_RED if i == 1 else BIND_GREEN)
            px(img, 5 + i * 3, 12, PARCH_D)
    elif filled == "codices":
        for i in range(3):
            x = 4 + i * 3
            rect(img, x, 6, 2, 4, [BIND_RED, BIND_BLUE, BIND_GREEN][i])
            px(img, x, 6, THREAD)
            px(img, x + 1, 10, shade(PARCH_D, 0.9))
    elif filled == "empty":
        # dust line where volumes used to sit
        hline(img, 4, 9, 8, shade(FACE_D, 0.66))
    elif filled == "broken":
        # collapsed lintel, rubble inside the recess
        for (x, y) in [(4, 11), (5, 12), (6, 11), (7, 12), (8, 11), (6, 12), (9, 12)]:
            px(img, x, y, shade(STONE_GREY_D, 1.05))
        hline(img, 3, 4, 10, (0, 0, 0, 0))
        for x in range(3, 13, 2):
            px(img, x, 4, shade(FACE_HI, 0.9))
    return img


def face_dado(seed: int) -> Image.Image:
    """Lower wall course with a carved band — used under the catalogue press."""
    img = brick_face(seed, courses=3)
    hline(img, 0, 11, T, shade(FACE_HI, 0.86))
    hline(img, 0, 12, T, shade(FACE_L, 0.9))
    for x in range(2, T, 4):
        px(img, x, 13, shade(FACE_D, 0.8))
    hline(img, 0, 14, T, shade(FACE_D, 0.82))
    for x in range(T):
        px(img, x, 15, shade(FACE_D, 0.66))
    return img


def face_broken(seed: int) -> Image.Image:
    """Breached wall face: exposed rubble core over a dark void."""
    rng = random.Random(seed)
    img = brick_face(seed, courses=2)
    # breach
    for x in range(1, 15):
        depth = 6 + int(3 * math.sin(x * 0.9 + seed))
        for y in range(depth, T):
            px(img, x, y, (0, 0, 0, 0))
    for x in range(1, 15):
        depth = 6 + int(3 * math.sin(x * 0.9 + seed))
        px(img, x, depth - 1, shade(FACE_HI, 0.9))
        px(img, x, depth, shade(FACE_D, 0.9))
        if rng.random() < 0.35:
            px(img, x, depth + 1, shade(STONE_GREY_D, 0.9))
    return img


# ---------------------------------------------------------------------------
# Water: 9-slice pool + a still variant
# ---------------------------------------------------------------------------
def water_tile(kind: str) -> Image.Image:
    """Standing water with a ragged coastline.

    Coast tiles leave the stone outside the waterline fully transparent so the
    flagstones show through: a straight tile-aligned rectangle reads as spilled
    paint rather than a pool. The waterline wobbles per column with a fixed
    table, so the pool edge steps irregularly instead of marching in a grid.
    """
    img = new(T, T)
    if kind == "deep":
        rect(img, 0, 0, T, T, WATER_D)
        _water_sheen(img, 0, 0, T, T)
        return img

    wobble = [0, 1, 2, 1, 0, 1, 3, 2, 0, 1, 1, 2, 0, 2, 1, 0]

    def inside(x: int, y: int) -> bool:
        if "n" in kind and y < 2 + wobble[x % 16]:
            return False
        if "s" in kind and y > T - 1 - (2 + wobble[(x + 5) % 16]):
            return False
        if "w" in kind and x < 2 + wobble[(y + 3) % 16]:
            return False
        if "e" in kind and x > T - 1 - (2 + wobble[(y + 7) % 16]):
            return False
        return True

    for y in range(T):
        for x in range(T):
            if inside(x, y):
                px(img, x, y, WATER_D)
    _water_sheen(img, 0, 0, T, T)

    # shoreline: a wet dark lip on the water side, a cold glint on the north
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            if not (inside(x - 1, y) and inside(x + 1, y)
                    and inside(x, y - 1) and inside(x, y + 1)):
                px(img, x, y, TEAL_D)
    if "n" in kind:
        for x in range(T):
            yy = 2 + wobble[x % 16]
            if inside(x, yy + 1):
                px(img, x, yy + 1, WATER_L)
    return img


def _water_sheen(img: Image.Image, x0: int, y0: int, w: int, h: int) -> None:
    """Sparse broken highlights: a ripple grid reads as woven fabric."""
    for y in range(y0 + 2, y0 + h, 6):
        for x in range(x0, x0 + w):
            if (x * 5 + y * 7) % 13 < 2:
                current = img.getpixel((x, y))
                if current[3] > 0:
                    px(img, x, y, WATER_M)


def damp_decal(seed: int) -> Image.Image:
    """Damp patch: a faint cool darkening plus a couple of wet highlights.

    Kept deliberately low-contrast — a full-tile dark blob reads as a hole in the
    floor at gameplay zoom, which is exactly the kind of misread to avoid.
    """
    img = new(T, T)
    rng = random.Random(seed)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(16):
        x, y = rng.randint(1, 14), rng.randint(1, 14)
        r = rng.choice([1, 2])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(28, 40, 46, 14))
    for _ in range(3):
        px(img, rng.randint(1, 14), rng.randint(1, 14), (96, 136, 124, 40))
    return img


def moss_decal(seed: int) -> Image.Image:
    img = new(T, T)
    rng = random.Random(seed)
    for _ in range(12):
        x, y = rng.randint(1, 14), rng.randint(1, 14)
        px(img, x, y, (MOSS[0], MOSS[1], MOSS[2], 150) if rng.random() < 0.6
           else (MOSS_L[0], MOSS_L[1], MOSS_L[2], 130))
    return img


# ---------------------------------------------------------------------------
# Props
# ---------------------------------------------------------------------------
def prop_shelf(seed: int, *, state: str = "full", bays: int = 3) -> Image.Image:
    """Free-standing shelf range seen from the front: w=bays*16, h=32."""
    w = bays * T
    h = 32
    rng = random.Random(seed)
    img = new(w, h)
    # carcass
    rect(img, 0, 0, w, h, shade(WOOD_D, 0.9))
    rect(img, 1, 1, w - 2, h - 2, shade(WOOD_D, 0.78))
    # top board (lit) and plinth
    rect(img, 0, 0, w, 3, WOOD_M)
    hline(img, 0, 0, w, WOOD_HI)
    hline(img, 0, 2, w, shade(WOOD_D, 1.0))
    # shelves
    for sy in (13, 24):
        hline(img, 1, sy, w - 2, WOOD_L)
        hline(img, 1, sy + 1, w - 2, shade(WOOD_D, 0.9))
    for bay in range(bays):
        bx = bay * T
        # vertical divider
        vline(img, bx + T - 1, 3, h - 4, shade(WOOD_M, 0.92))
        vline(img, bx, 3, h - 4, shade(WOOD_D, 0.7))
        for row, (top, bottom) in enumerate([(3, 13), (14, 24), (25, 31)]):
            filled = rng.random()
            if state == "collapsed" and bay >= 1:
                continue
            if state == "partial" and bay == bays - 1:
                continue
            if filled < 0.16:
                continue
            x = bx + 2
            while x < bx + T - 3:
                kind = rng.random()
                if kind < 0.45:  # standing codices
                    bw = rng.choice([2, 2, 3])
                    bh = rng.randint(5, max(5, bottom - top - 1))
                    col = rng.choice([BIND_RED, BIND_BLUE, BIND_GREEN, shade(PARCH_D, 0.9)])
                    rect(img, x, bottom - bh, bw, bh, col)
                    px(img, x, bottom - bh, THREAD)
                    if bw > 2:
                        px(img, x + 1, bottom - bh + 2, shade(col, 1.25))
                    x += bw + 1
                elif kind < 0.72:  # horizontal stack
                    for i in range(rng.randint(1, 3)):
                        yy = bottom - 2 - i * 2
                        if yy <= top:
                            break
                        hline(img, x, yy, 4, rng.choice([PARCH, BIND_BLUE, BIND_RED]))
                        px(img, x + 3, yy, shade(PARCH_D, 0.9))
                    x += 6
                elif kind < 0.9:  # rolled scrolls, upright
                    for i in range(2):
                        vline(img, x + i * 2, bottom - 6, 6, PARCH_D)
                        px(img, x + i * 2, bottom - 7, THREAD)
                    x += 5
                else:  # gap with a fallen volume
                    hline(img, x, bottom - 1, 3, shade(PARCH_D, 0.85))
                    x += 4
    if state == "collapsed":
        # the right-hand bays have pancaked: broken boards and voids
        for x in range(T + 2, w - 1):
            for y in range(6, h - 2):
                if rng.random() < 0.72:
                    px(img, x, y, (0, 0, 0, 0))
        for _ in range(26):
            x = rng.randint(T + 1, w - 2)
            y = rng.randint(8, h - 2)
            px(img, x, y, rng.choice([WOOD_D, WOOD_M, shade(WOOD_L, 0.9)]))
        # jagged broken edge on the left bay
        for y in range(4, h - 2):
            px(img, T + 1, y, (0, 0, 0, 0))
            px(img, T + 2, y, shade(WOOD_D, 0.8) if rng.random() < 0.5 else (0, 0, 0, 0))
    return img


def prop_desk(seed: int, *, state: str = "open") -> Image.Image:
    """Sloped reading desk (2x2 tiles) with an open manuscript."""
    rng = random.Random(seed)
    img = new(32, 30)
    # legs
    for x in (3, 26):
        vline(img, x, 16, 12, shade(WOOD_D, 0.9))
        vline(img, x + 1, 16, 12, WOOD_M)
    # lower shelf bar
    rect(img, 5, 22, 22, 3, shade(WOOD_D, 1.0))
    hline(img, 5, 22, 22, WOOD_L)
    if state == "overturned":
        return prop_desk_overturned(seed)
    # sloped top: two horizontal bands, darker towards the front
    rect(img, 0, 8, 32, 10, WOOD_M)
    hline(img, 0, 8, 32, WOOD_HI)
    hline(img, 0, 9, 32, WOOD_L)
    rect(img, 0, 15, 32, 3, WOOD_D)
    hline(img, 0, 17, 32, shade(WOOD_D, 0.8))
    # open manuscript on the slope
    rect(img, 8, 9, 16, 8, PARCH_D)
    hline(img, 8, 9, 16, PARCH_L)
    rect(img, 15, 9, 2, 8, shade(PARCH_D, 0.86))  # gutter
    for side_x in (9, 17):
        for line in range(5):
            y = 11 + line
            wln = rng.randint(3, 6)
            hline(img, side_x, y, wln, INK)
    # ink pot + quill
    rect(img, 25, 11, 3, 3, (30, 30, 34))
    px(img, 25, 11, (60, 60, 66))
    vline(img, 26, 6, 5, PARCH_L)
    px(img, 26, 5, THREAD)
    # candle stub on the corner
    rect(img, 3, 11, 2, 4, PARCH_L)
    px(img, 3, 10, (255, 214, 140))
    return img


def prop_desk_overturned(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = new(32, 30)
    # the desk lying on its back: we see the underside and two legs pointing at us
    rect(img, 2, 10, 28, 12, shade(WOOD_D, 1.06))
    hline(img, 2, 10, 28, WOOD_M)
    hline(img, 2, 21, 28, shade(WOOD_D, 0.8))
    for x in (5, 24):
        rect(img, x, 6, 3, 6, shade(WOOD_M, 0.9))
        px(img, x, 5, WOOD_L)
    # scattered pages
    for (x, y) in [(6, 24), (12, 25), (20, 24), (17, 27)]:
        hline(img, x, y, 5, PARCH)
        px(img, x + 4, y, PARCH_D)
    return img


def prop_lectern(seed: int) -> Image.Image:
    """Chained book on a lectern (1x2 tiles)."""
    img = new(16, 30)
    rect(img, 6, 14, 4, 14, shade(WOOD_D, 0.95))
    rect(img, 4, 27, 8, 3, shade(WOOD_D, 0.85))
    px(img, 5, 28, WOOD_M)
    # slanted top
    rect(img, 1, 6, 14, 9, WOOD_M)
    hline(img, 1, 6, 14, WOOD_HI)
    hline(img, 1, 13, 14, shade(WOOD_D, 0.85))
    # book
    rect(img, 3, 3, 10, 7, BIND_RED)
    rect(img, 4, 4, 8, 5, PARCH)
    hline(img, 8, 4, 1, shade(PARCH_D, 0.8))
    for y in (5, 6, 7):
        hline(img, 5, y, 2, INK)
        hline(img, 9, y, 2, INK)
    px(img, 3, 9, THREAD)
    # chain
    for i in range(4):
        px(img, 12 - i, 10 + (i % 2), shade(STONE_GREY_L, 0.8))
    return img


def prop_rubble(seed: int, *, size: tuple[int, int] = (48, 34)) -> Image.Image:
    """Ceiling-collapse pile: broken ashlar, dust, one timber beam."""
    w, h = size
    rng = random.Random(seed)
    img = new(w, h)
    # base mound
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([2, h * 0.45, w - 2, h - 1], fill=(44, 38, 33, 255))
    # chunks
    for _ in range(int(w * h / 26)):
        cx = rng.randint(3, w - 4)
        cy = rng.randint(int(h * 0.4), h - 3)
        bw = rng.randint(3, 6)
        bh = rng.randint(2, 5)
        col = rng.choice([FACE_M, FACE_L, shade(FACE_D, 1.05), STONE_GREY])
        rect(img, cx, cy, bw, bh, col)
        hline(img, cx, cy, bw, shade(col, 1.2))
        hline(img, cx, cy + bh - 1, bw, shade(col, 0.75))
    # a snapped beam lying across the pile
    for i in range(int(w * 0.55)):
        px(img, 6 + i, int(h * 0.62) + int(math.sin(i / 7) * 2), WOOD_D)
        px(img, 6 + i, int(h * 0.62) + int(math.sin(i / 7) * 2) + 1, shade(WOOD_D, 0.8))
    # fine dust
    for _ in range(int(w * 1.2)):
        px(img, rng.randint(1, w - 1), rng.randint(int(h * 0.4), h - 1), shade(FACE_D, 1.2))
    return img


def prop_rubble_chunk(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = new(14, 10)
    for _ in range(5):
        x = rng.randint(0, 8)
        y = rng.randint(2, 6)
        w = rng.randint(3, 5)
        h = rng.randint(2, 3)
        col = rng.choice([FACE_M, FACE_L, STONE_GREY_D])
        rect(img, x, y, w, h, col)
        hline(img, x, y, w, shade(col, 1.2))
    return img


def floor_shadow(img: Image.Image, cx: int, y: int, rx: int, ry: int,
                 alpha: int = 64) -> Image.Image:
    """Composite a soft contact shadow so flat floor litter is not floating.

    Drawn on its own layer and alpha-composited: painting translucent pixels
    straight onto the sprite would leave it see-through (see the water bug).
    """
    layer = new(img.width, img.height)
    draw = ImageDraw.Draw(layer, "RGBA")
    draw.ellipse((cx - rx, y - ry, cx + rx, y + ry), fill=(4, 3, 6, alpha))
    return Image.alpha_composite(img, layer)


def prop_scrolls(seed: int) -> Image.Image:
    """A loose bundle of scrolls on the floor."""
    rng = random.Random(seed)
    img = floor_shadow(new(18, 12), 9, 8, 8, 3)
    for i in range(rng.randint(2, 4)):
        x = rng.randint(0, 8)
        y = rng.randint(2, 7)
        w = rng.randint(7, 10)
        for xx in range(w):
            px(img, x + xx, y, PARCH)
            px(img, x + xx, y + 1, PARCH_D)
        px(img, x + w - 1, y, SEAL_L)
        px(img, x, y + 1, THREAD)
    return img


def prop_scroll_roll(seed: int) -> Image.Image:
    img = floor_shadow(new(14, 8), 7, 6, 6, 2)
    for x in range(10):
        vline(img, 2 + x, 2, 4, PARCH if x % 3 else PARCH_D)
    px(img, 1, 3, SEAL)
    px(img, 12, 3, THREAD)
    return img


def prop_book_stack(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = floor_shadow(new(14, 12), 7, 10, 6, 2)
    y = 9
    for i in range(rng.randint(2, 3)):
        w = rng.randint(7, 10)
        x = rng.randint(1, 4)
        h = 2
        col = rng.choice([BIND_RED, BIND_BLUE, BIND_GREEN, shade(PARCH_D, 0.95)])
        rect(img, x, y, w, h, col)
        hline(img, x, y, w, shade(col, 1.2))
        px(img, x, y, THREAD)
        y -= 3
    return img


def prop_stool(seed: int, tipped: bool = False) -> Image.Image:
    img = new(12, 12)
    if tipped:
        rect(img, 1, 5, 10, 4, WOOD_M)
        hline(img, 1, 5, 10, WOOD_HI)
        vline(img, 2, 9, 2, WOOD_D)
        vline(img, 9, 9, 2, WOOD_D)
        return img
    rect(img, 1, 4, 10, 4, WOOD_M)
    hline(img, 1, 4, 10, WOOD_HI)
    hline(img, 1, 7, 10, shade(WOOD_D, 0.85))
    for x in (2, 9):
        vline(img, x, 8, 3, shade(WOOD_D, 0.9))
    return img


def prop_bench(seed: int) -> Image.Image:
    """A board bench seen from above: seat, apron, four legs, shadow gap."""
    img = new(34, 18)
    # seat
    rect(img, 0, 2, 34, 7, shade(WOOD_M, 0.92))
    hline(img, 0, 2, 34, shade(WOOD_L, 1.04))
    hline(img, 0, 8, 34, shade(WOOD_D, 0.78))
    # plank joints
    for x in (11, 22):
        vline(img, x, 3, 5, shade(WOOD_D, 0.9))
    # legs (two, visible below the seat's front edge)
    for x in (3, 27):
        rect(img, x, 9, 4, 7, shade(WOOD_D, 0.92))
        vline(img, x, 9, 7, shade(WOOD_M, 0.9))
        hline(img, x, 15, 4, shade(WOOD_D, 0.6))
    # stretcher
    hline(img, 6, 12, 21, shade(WOOD_D, 0.85))
    return img


def prop_reading_table(seed: int) -> Image.Image:
    """The long communal reading table (3x2 tiles) with manuscripts, candles."""
    rng = random.Random(seed)
    img = new(48, 32)
    # top surface
    rect(img, 0, 4, 48, 16, WOOD_M)
    hline(img, 0, 4, 48, WOOD_HI)
    hline(img, 0, 5, 48, WOOD_L)
    hline(img, 0, 19, 48, shade(WOOD_D, 0.82))
    # plank joints
    for x in (15, 31):
        vline(img, x, 5, 14, shade(WOOD_D, 0.92))
    # trestle legs
    for x in (4, 40):
        rect(img, x, 20, 4, 10, shade(WOOD_D, 0.95))
        hline(img, x, 20, 4, WOOD_M)
    # open manuscripts along the table
    for bx, by in ((6, 8), (20, 7), (33, 9)):
        rect(img, bx, by, 9, 6, PARCH)
        hline(img, bx, by, 9, PARCH_L)
        vline(img, bx + 4, by, 6, shade(PARCH_D, 0.9))
        for line in range(3):
            hline(img, bx + 1, by + 2 + line, 3, INK)
            hline(img, bx + 6, by + 2 + line, 2, INK)
    # candle + wax
    rect(img, 17, 10, 2, 4, PARCH_L)
    px(img, 17, 9, (255, 220, 150))
    px(img, 18, 9, (255, 190, 110))
    # book stack and scrolls
    rect(img, 28, 12, 4, 5, BIND_BLUE)
    px(img, 28, 12, THREAD)
    for x in range(3):
        hline(img, 36, 14 + x, 7, PARCH_D if x % 2 else PARCH)
    return img


def prop_door_frame(seed: int) -> Image.Image:
    """Two-tile wooden door still hanging in its stone jamb (32x40)."""
    rng = random.Random(seed)
    img = new(32, 40)
    # stone surround
    rect(img, 0, 2, 4, 38, FACE_L)
    rect(img, 28, 2, 4, 38, FACE_L)
    rect(img, 0, 0, 32, 3, FACE_HI)
    for y in range(3, 38, 6):
        hline(img, 0, y, 4, shade(FACE_M, 0.9))
        hline(img, 28, y + 2, 4, shade(FACE_M, 0.9))
    # opening (dark)
    rect(img, 4, 3, 24, 37, (16, 14, 14))
    # one leaf, ajar
    rect(img, 5, 4, 11, 35, WOOD_M)
    for x in range(5, 16, 4):
        vline(img, x, 4, 35, shade(WOOD_D, 0.9))
    for y in (9, 20, 31):
        hline(img, 5, y, 11, shade(STONE_GREY_L, 0.62))
        px(img, 6, y, shade(STONE_GREY_L, 0.8))
    px(img, 15, 21, shade(STONE_GREY_L, 0.9))
    # broken hinge strap
    hline(img, 16, 12, 5, (0, 0, 0, 0))
    px(img, 16, 13, shade(STONE_GREY_L, 0.6))
    return img


def prop_door_leaf(seed: int) -> Image.Image:
    """The other leaf, torn off and lying flat on the floor."""
    img = new(30, 14)
    rect(img, 1, 2, 28, 10, WOOD_M)
    hline(img, 1, 2, 28, WOOD_HI)
    hline(img, 1, 11, 28, shade(WOOD_D, 0.8))
    for x in range(4, 29, 5):
        vline(img, x, 3, 8, shade(WOOD_D, 0.92))
    for y in (4, 8):
        hline(img, 2, y, 26, shade(STONE_GREY_L, 0.58))
    return img


def prop_candle_stand(seed: int) -> Image.Image:
    img = new(12, 26)
    rect(img, 5, 8, 2, 14, shade(STONE_GREY_D, 1.1))
    rect(img, 3, 21, 6, 3, shade(STONE_GREY_D, 1.2))
    hline(img, 3, 21, 6, STONE_GREY_L)
    # trefoil holder
    hline(img, 2, 8, 8, shade(STONE_GREY_L, 0.9))
    for x in (2, 5, 8):
        rect(img, x, 3, 2, 5, PARCH_L)
        px(img, x, 2, (255, 226, 160))
        px(img, x + 1, 2, (255, 190, 120))
    return img


def prop_wall_lamp(seed: int) -> Image.Image:
    """Iron bracket + oil lamp mounted on a wall face."""
    img = new(14, 20)
    vline(img, 1, 10, 8, shade(STONE_GREY_D, 1.2))
    hline(img, 1, 10, 8, shade(STONE_GREY_D, 1.3))
    vline(img, 8, 10, 4, shade(STONE_GREY_D, 1.2))
    rect(img, 6, 13, 6, 4, shade(STONE_GREY_D, 0.9))
    rect(img, 7, 12, 4, 2, (255, 210, 140))
    px(img, 8, 11, (255, 236, 190))
    return img


def prop_drying_rack(seed: int) -> Image.Image:
    """A frame with hung parchment leaves drying over a low brazier — a
    scriptorium object, not furniture filler."""
    rng = random.Random(seed)
    img = new(38, 34)
    # uprights + crossbar
    for x in (2, 34):
        vline(img, x, 8, 24, shade(WOOD_D, 0.95))
        vline(img, x + 1, 8, 24, WOOD_M)
        rect(img, x - 1, 30, 4, 3, shade(WOOD_D, 0.85))
    hline(img, 2, 8, 34, WOOD_L)
    hline(img, 2, 9, 34, shade(WOOD_D, 0.9))
    # hanging leaves
    for i in range(5):
        x = 5 + i * 6
        h = rng.randint(9, 14)
        rect(img, x, 10, 4, h, PARCH_D)
        hline(img, x, 10, 4, PARCH)
        for line in range(2, h - 1, 3):
            hline(img, x + 1, 10 + line, 2, shade(INK, 1.3))
        px(img, x + 1, 10, THREAD)
    # low brazier with embers beneath
    rect(img, 14, 27, 10, 4, shade(STONE_GREY_D, 1.1))
    hline(img, 14, 27, 10, STONE_GREY_L)
    for x in range(15, 23):
        if x % 2:
            px(img, x, 26, SEAL_L)
    return img


def prop_ink_horn(seed: int) -> Image.Image:
    img = new(8, 8)
    rect(img, 2, 3, 4, 4, (34, 32, 36))
    px(img, 2, 3, (70, 68, 74))
    px(img, 4, 1, PARCH_L)
    return img


def prop_paternoster(seed: int) -> Image.Image:
    """Hanging iron chain with a reading lamp, from the vault."""
    img = new(10, 30)
    for y in range(0, 20, 2):
        px(img, 4, y, shade(STONE_GREY_L, 0.62))
        px(img, 5, y + 1, shade(STONE_GREY_D, 1.2))
    rect(img, 2, 20, 6, 5, shade(STONE_GREY_D, 0.9))
    hline(img, 2, 20, 6, STONE_GREY_L)
    rect(img, 3, 21, 4, 3, (255, 206, 138))
    px(img, 4, 22, (255, 240, 200))
    return img


def prop_stone_bench(seed: int) -> Image.Image:
    """Carved stone bench along a wall (2x1 tiles)."""
    img = new(32, 14)
    rect(img, 0, 2, 32, 7, FACE_L)
    hline(img, 0, 2, 32, FACE_HI)
    hline(img, 0, 8, 32, shade(FACE_D, 0.9))
    for x in (2, 28):
        rect(img, x, 9, 3, 4, shade(FACE_M, 0.9))
    for x in range(4, 30, 9):
        vline(img, x, 3, 5, shade(FACE_M, 0.92))
    return img


# ---------------------------------------------------------------------------
# Light texture
# ---------------------------------------------------------------------------
def radial_light(size: int = 128) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px_data = img.load()
    c = (size - 1) / 2.0
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / c
            a = max(0.0, 1.0 - d)
            a = a * a * a
            px_data[x, y] = (255, 236, 200, int(255 * a))
    return img



# ---------------------------------------------------------------------------
# Stairs: a north-south flight seen from above (4 treads)
# ---------------------------------------------------------------------------
def stair_tread(index: int, total: int = 4) -> Image.Image:
    """Each tread is a 16x16 cell: lit nosing at the top, shadow at the bottom."""
    img = new(T, T)
    base = shade(FACE_L, 1.0 - index * 0.06)
    rect(img, 0, 0, T, T, base)
    # worn nosing
    hline(img, 0, 0, T, shade(base, 1.18))
    hline(img, 0, 1, T, shade(base, 1.1))
    hline(img, 0, 13, T, shade(base, 0.76))
    hline(img, 0, 14, T, shade(base, 0.62))
    hline(img, 0, 15, T, shade(base, 0.52))
    # side walls of the flight (a dark jamb either side)
    vline(img, 0, 0, T, shade(FACE_D, 0.8))
    vline(img, 15, 0, T, shade(FACE_D, 0.72))
    # centre wear from centuries of feet
    if index >= 1:
        for x in range(5, 11):
            px(img, x, 6 + (x % 2), shade(base, 1.08))
    # grit
    rng = random.Random(900 + index)
    for _ in range(3):
        px(img, rng.randint(2, 13), rng.randint(2, 12), shade(base, 0.88))
    return img


def floor_wear_path(seed: int) -> Image.Image:
    """Faint polished track where the monks walked — detail layer."""
    img = new(T, T)
    rng = random.Random(seed)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(10):
        x, y = rng.randint(1, 14), rng.randint(1, 14)
        d.rectangle([x, y, x + rng.randint(2, 5), y], fill=(150, 136, 116, 26))
    return img


def decal_wall_shadow(seed: int) -> Image.Image:
    """Soft contact shadow cast by the wall face onto the floor below it."""
    img = new(T, T)
    for y in range(T):
        a = int(86 * (1.0 - y / T) ** 1.8)
        for x in range(T):
            img.putpixel((x, y), (10, 8, 8, a))
    return img


def decal_ceiling_drip(seed: int) -> Image.Image:
    """Water sheeting from a crack above: vertical streaks on the floor."""
    img = new(T, T)
    rng = random.Random(seed)
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(T):
        if (x + seed) % 3 == 0:
            h = rng.randint(6, 15)
            d.rectangle([x, 0, x, h], fill=(70, 96, 104, 40))
    for _ in range(4):
        px(img, rng.randint(1, 14), rng.randint(2, 14), (120, 180, 178, 90))
    return img


def decal_chain(seed: int) -> Image.Image:
    """An iron chain lying slack on the floor (from the chained book)."""
    img = new(T, T)
    pts = [(1, 9), (3, 8), (5, 9), (7, 10), (9, 9), (11, 8), (13, 9), (15, 10)]
    for i, (x, y) in enumerate(pts):
        px(img, x, y, shade(STONE_GREY_L, 0.62))
        px(img, x, y + 1, shade(STONE_GREY_D, 1.05))
        if i % 2 == 0:
            px(img, x + 1, y + 1, shade(STONE_GREY_L, 0.5))
    return img


# ---------------------------------------------------------------------------
# The armarium: the room's destination. A tall double-door storage cabinet
# built into the north wall, both leaves thrown open, scroll racks inside.
# ---------------------------------------------------------------------------
def prop_armarium(seed: int, *, open_doors: bool = True, w: int = 96, h: int = 64) -> Image.Image:
    """The room's destination: a wall-set double-door cupboard of records.

    When open, the two leaves are drawn on the OUTSIDE of the carcass so the
    interior shelving is fully readable — this is what a player actually sees
    when a cabinet stands open against a wall.
    """
    rng = random.Random(seed)
    pad = 20 if open_doors else 0
    img = new(w + pad * 2, h)
    ox = pad  # carcass origin

    # ---- open leaves, stood against the wall either side -----------------
    if open_doors:
        for side in (0, 1):
            lx = 0 if side == 0 else w + pad
            leaf_w, leaf_h = pad - 2, h - 8
            rect(img, lx, 6, leaf_w, leaf_h, shade(WOOD_M, 0.92))
            hline(img, lx, 6, leaf_w, shade(WOOD_L, 1.05))
            hline(img, lx, 6 + leaf_h - 1, leaf_w, shade(WOOD_D, 0.7))
            for y in range(10, 6 + leaf_h - 3, 9):
                hline(img, lx + 1, y, leaf_w - 2, shade(WOOD_D, 0.88))
            # inner face darker, catches no light
            vline(img, lx + (leaf_w - 1 if side == 0 else 0), 6, leaf_h,
                  shade(WOOD_D, 0.6))
            # strap hinges on the outer stile
            for y in (12, h - 16):
                hline(img, lx + 1, y, leaf_w - 2, shade(STONE_GREY_L, 0.58))
                px(img, lx + 2, y + 1, shade(STONE_GREY_D, 1.15))
            # ring pull near the inner edge
            px(img, lx + (leaf_w - 3 if side == 0 else 2), h // 2,
               shade(STONE_GREY_L, 0.75))

    # ---- carcass ---------------------------------------------------------
    rect(img, ox, 4, w, h - 4, shade(WOOD_D, 0.9))
    rect(img, ox + 1, 5, w - 2, h - 6, shade(WOOD_D, 0.66))
    # cornice
    rect(img, ox - 2, 0, w + 4, 8, WOOD_M)
    hline(img, ox - 2, 0, w + 4, WOOD_HI)
    hline(img, ox - 2, 1, w + 4, shade(WOOD_L, 1.06))
    hline(img, ox - 2, 7, w + 4, shade(WOOD_D, 0.7))
    for x in range(ox + 3, ox + w - 3, 11):
        px(img, x, 4, shade(WOOD_L, 0.88))
    # plinth
    rect(img, ox, h - 6, w, 6, shade(WOOD_D, 0.92))
    hline(img, ox, h - 6, w, shade(WOOD_M, 0.94))
    hline(img, ox, h - 1, w, shade(WOOD_D, 0.55))

    # ---- interior shelving ----------------------------------------------
    ix0, ix1 = ox + 5, ox + w - 5
    iy0, iy1 = 10, h - 8
    rect(img, ix0, iy0, ix1 - ix0, iy1 - iy0, (24, 17, 14))
    rows, cols = 3, 3
    cw = (ix1 - ix0) // cols
    rh = (iy1 - iy0) // rows
    for c in range(cols):
        for r in range(rows):
            x0 = ix0 + c * cw + 2
            y0 = iy0 + r * rh + 2
            slot_w = cw - 4
            slot_h = rh - 6
            if slot_h < 2:
                continue
            rect(img, x0, y0, slot_w, slot_h, (18, 13, 12))
            # shelf board under the slot
            hline(img, x0 - 1, y0 + slot_h, slot_w + 2, shade(WOOD_M, 1.0))
            hline(img, x0 - 1, y0 + slot_h + 1, slot_w + 2, shade(WOOD_D, 0.72))
            kind = (c * 7 + r * 3 + seed) % 10
            if kind <= 4:          # upright rolls, the archive's staple
                xx = x0 + 1
                while xx < x0 + slot_w - 2:
                    vline(img, xx, y0 + 2, slot_h - 3, PARCH_D)
                    vline(img, xx + 1, y0 + 2, slot_h - 3, shade(PARCH, 0.98))
                    px(img, xx, y0 + 1, THREAD)
                    px(img, xx + 1, y0 + 1, SEAL_L if (xx % 3 == 0) else THREAD)
                    xx += 4
            elif kind <= 6:        # horizontal codices
                yy = y0 + slot_h - 2
                while yy > y0 + 1:
                    hline(img, x0 + 1, yy, slot_w - 2,
                          rng.choice([BIND_RED, BIND_BLUE, BIND_GREEN, PARCH_D]))
                    px(img, x0 + 1, yy, THREAD)
                    yy -= 3
            elif kind == 7:        # a bundle tied in cloth
                rect(img, x0 + 1, y0 + slot_h - 5, slot_w - 2, 4, shade(PARCH_D, 0.92))
                hline(img, x0 + 1, y0 + slot_h - 5, slot_w - 2, PARCH)
                vline(img, x0 + slot_w // 2, y0 + slot_h - 5, 4, THREAD)
            elif kind == 8:        # empty, dust-marked
                hline(img, x0 + 1, y0 + slot_h - 1, slot_w - 2, shade(WOOD_M, 0.6))
            else:                  # plundered: one leaf left on the shelf
                hline(img, x0 + 2, y0 + slot_h - 2, slot_w - 4, PARCH_D)
                px(img, x0 + 2, y0 + slot_h - 3, THREAD)
            # slot inner shadow (top and left)
            hline(img, x0, y0, slot_w, shade(WOOD_D, 0.42))
            vline(img, x0, y0, slot_h, shade(WOOD_D, 0.5))

    # ---- centre mullion and lock plate ----------------------------------
    mid = ox + w // 2
    rect(img, mid - 2, iy0, 4, iy1 - iy0, shade(WOOD_M, 0.9))
    hline(img, mid - 2, iy0, 4, shade(WOOD_L, 0.9))
    for y in range(iy0 + 5, iy1 - 2, 8):
        px(img, mid - 1, y, shade(WOOD_HI, 0.85))

    if not open_doors:
        # closed leaves over the interior
        rect(img, ix0, iy0, ix1 - ix0, iy1 - iy0, shade(WOOD_M, 0.94))
        for side in (0, 1):
            x0 = ix0 + side * (ix1 - ix0) // 2
            wl = (ix1 - ix0) // 2
            hline(img, x0, iy0, wl, shade(WOOD_L, 0.95))
            for x in range(x0 + 3, x0 + wl - 1, 5):
                vline(img, x, iy0 + 2, iy1 - iy0 - 4, shade(WOOD_D, 0.86))
            for y in (iy0 + 7, iy0 + 22, iy1 - 9):
                hline(img, x0 + 1, y, wl - 2, shade(STONE_GREY_L, 0.55))
                px(img, x0 + 2, y + 1, shade(STONE_GREY_D, 1.1))
        vline(img, mid, iy0, iy1 - iy0, shade(WOOD_D, 0.7))

    # ---- one faded painted band along the plinth (worn) -----------------
    for x in range(ox + 2, ox + w - 2):
        if (x * 7 + seed) % 13 > 4:
            px(img, x, h - 8, shade(SEAL_L, 0.8))
    return img



def prop_press_closed(seed: int, *, angled: bool = False) -> Image.Image:
    """A closed two-door wall press (48x32): the archive's ordinary storage."""
    img = new(48, 32)
    # carcass + cornice + plinth
    rect(img, 0, 2, 48, 30, shade(WOOD_D, 0.9))
    rect(img, 1, 3, 46, 28, shade(WOOD_D, 0.72))
    rect(img, -0, 0, 48, 4, WOOD_M)
    hline(img, 0, 0, 48, WOOD_HI)
    hline(img, 0, 3, 48, shade(WOOD_D, 0.75))
    rect(img, 0, 28, 48, 4, shade(WOOD_D, 0.85))
    hline(img, 0, 28, 48, shade(WOOD_M, 0.9))
    for side in (0, 1):
        x0 = 3 + side * 21
        wl = 20
        hline(img, x0, 5, wl, shade(WOOD_L, 0.92))
        for x in range(x0 + 3, x0 + wl - 1, 5):
            vline(img, x, 6, 21, shade(WOOD_D, 0.86))
        for y in (9, 17, 24):
            hline(img, x0 + 1, y, wl - 2, shade(STONE_GREY_L, 0.52))
            px(img, x0 + 2, y + 1, shade(STONE_GREY_D, 1.1))
        px(img, x0 + (wl - 2 if side == 0 else 1), 15, shade(STONE_GREY_L, 0.7))
    vline(img, 24, 4, 24, shade(WOOD_D, 0.6))
    # a painted band, mostly worn off
    for x in range(2, 46):
        if (x * 5 + seed) % 9 > 5:
            px(img, x, 27, shade(SEAL_L, 0.75))
    if angled:
        # the right leaf is hanging open, its lower hinge torn out
        for y in range(6, 30):
            for x in range(26, 46):
                if (x - 26) > (30 - y) * 0.55:
                    px(img, x, y, (0, 0, 0, 0))
        for y in range(6, 30):
            px(img, 26 + int((30 - y) * 0.55), y, shade(WOOD_M, 0.9))
    return img


def prop_door_portal(seed: int) -> Image.Image:
    """A 3-tile-wide doorway torn into the south wall (48 x 40).

    Read bottom-up: a worn threshold at the floor line, the oak leaf hanging off
    one hinge inside the opening, then the arch and the wall face the doorway is
    cut through. Sits on the wall band so the room gains a second architectural
    "station" without any seam.
    """
    w, h = 48, 40
    img = new(w, h)
    rng = random.Random(seed)

    # ---- wall face the door is cut through (top half) --------------------
    rect(img, 0, 0, w, h, FACE_M)
    for y in range(0, h):
        for x in range(w):
            v = 0.94 + 0.06 * ((x * 7 + y * 3 + x * y) % 3)
            px(img, x, y, shade(FACE_M, v))
    # coursed ashlar
    for row, y in enumerate(range(0, h, 5)):
        hline(img, 0, y, w, shade(FACE_D, 0.92))
        off = 0 if row % 2 else 6
        for x in range(off, w, 12):
            vline(img, x, y, 5, shade(FACE_D, 0.94))
    # ---- arch: voussoirs around the opening ------------------------------
    cx = w / 2 - 0.5
    for x in range(w):
        for y in range(0, 18):
            dx = (x - cx) / 20.0
            dy = (y - 20.0) / 20.0
            if 0.86 <= math.hypot(dx, dy) <= 1.16 and y <= 20:
                px(img, x, y, shade(FACE_L, 1.06 if ((x + y) // 3) % 2 == 0 else 0.9))
    for a in range(8, 176, 16):
        rad = math.radians(a)
        for r in (17, 18, 19, 20):
            x = int(cx + math.cos(rad) * r)
            y = int(18 - math.sin(rad) * r * 0.9)
            px(img, x, y, shade(FACE_D, 0.82))
    # jamb blocks
    rect(img, 6, 14, 6, 26, FACE_L)
    rect(img, w - 12, 14, 6, 26, FACE_L)
    vline(img, 6, 14, 26, FACE_HI)
    vline(img, w - 12, 14, 26, FACE_HI)
    for y in range(16, 40, 6):
        px(img, 6, y, shade(FACE_M, 0.84))
        px(img, w - 12, y, shade(FACE_M, 0.84))

    # ---- the opening: a dark passage with the floor running into it ------
    # Depth cues instead of a flat black hole: the passage darkens towards the
    # jambs, the floor recedes in two treads, and a little of the hall's warm
    # light spills over the threshold.
    for y in range(16, 36):
        t = (y - 16) / 20.0
        base = (14 - int(t * 5), 13 - int(t * 5), 14 - int(t * 5))
        hline(img, 12, y, w - 24, base)
    for y in range(16, 36):
        for x in range(12, w - 12):
            edge = min(x - 12, (w - 12) - 1 - x)
            if edge < 3:
                px(img, x, y, (9, 8, 9))
    # two treads running back into the passage
    for y, tone in ((30, (44, 38, 34)), (31, (30, 26, 24)),
                    (34, (38, 33, 30)), (35, (27, 24, 22))):
        hline(img, 13, y, w - 26, tone)
    for x in range(14, w - 14, 7):
        vline(img, x, 32, 3, (22, 20, 18))
    # the hall's lamplight spilling over the threshold stones
    for y in range(33, 36):
        for x in range(13, w - 13):
            if (x + y) % 5 < 2:
                px(img, x, y, (56, 44, 32))
    # a cold sliver of light from deeper in the undercroft
    vline(img, 12 + 11, 20, 10, (34, 35, 37))
    vline(img, 12 + 12, 21, 8, (26, 27, 29))

    # ---- the leaf: hanging inward from the west jamb ---------------------
    leaf_x0, leaf_x1 = 12, 27
    for y in range(14, 37):
        for x in range(leaf_x0, leaf_x1):
            px(img, x, y, shade(WOOD_M, 0.92 - (x - leaf_x0) * 0.012))
    for x in range(leaf_x0 + 2, leaf_x1, 4):
        vline(img, x, 15, 21, shade(WOOD_D, 0.86))
    for y in (18, 27, 35):
        hline(img, leaf_x0 + 1, y, leaf_x1 - leaf_x0 - 2, shade(STONE_GREY_L, 0.52))
        px(img, leaf_x0 + 2, y + 1, shade(STONE_GREY_D, 1.1))
    vline(img, leaf_x1 - 1, 14, 23, shade(WOOD_D, 0.55))
    # torn lower hinge: the free edge sags
    for x in range(leaf_x0, leaf_x1):
        px(img, x, 36, shade(WOOD_D, 0.6))
    px(img, leaf_x1 - 3, 25, shade(STONE_GREY_L, 0.78))
    px(img, leaf_x1 - 3, 26, shade(STONE_GREY_L, 0.78))

    # ---- threshold: worn stone, damp, soot -------------------------------
    rect(img, 8, 37, w - 16, 3, shade(FACE_L, 1.04))
    hline(img, 8, 37, w - 16, FACE_HI)
    hline(img, 8, 39, w - 16, shade(FACE_D, 0.7))
    for _ in range(26):
        x = rng.randint(9, w - 10)
        y = rng.randint(34, 39)
        px(img, x, y, shade(FACE_D, rng.choice([0.7, 0.78, 0.86])))
    # damp creeping over the step, in the same muted water ramp as the pool
    for x in range(21, 29):
        px(img, x, 38, WATER_D)
        if x % 3:
            px(img, x, 37, WATER_M)
    return img



def prop_column(seed: int) -> Image.Image:
    """A round-ish masonry pier (30 x 52): base, drummed shaft, capital.

    Reads as a vertical cylinder rather than a box: the shaft is narrower than
    both the plinth and the capital, and its left third is lit while the right
    third falls into shadow.
    """
    rng = random.Random(seed)
    w, h = 30, 52
    img = new(w, h)
    # ---- plinth (bottom) -------------------------------------------------
    rect(img, 2, 42, 26, 10, shade(FACE_D, 1.0))
    rect(img, 3, 43, 24, 8, shade(FACE_M, 0.98))
    hline(img, 2, 42, 26, shade(FACE_L, 1.0))
    hline(img, 3, 50, 24, shade(FACE_D, 0.62))
    # ---- shaft -----------------------------------------------------------
    y0, y1 = 14, 42
    x0, x1 = 7, 23
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = (x - x0) / max(1, (x1 - x0 - 1))
            lit = 1.16 - 0.42 * t           # lit left edge, dark right edge
            px(img, x, y, shade(FACE_M, lit))
    for x in range(x0, x0 + 3):
        vline(img, x, y0, y1 - y0, shade(FACE_M, 1.24))
    for x in range(x1 - 4, x1):
        vline(img, x, y0, y1 - y0, shade(FACE_M, 0.66))
    # drum joints
    for y in (21, 28, 35):
        for x in range(x0, x1):
            px(img, x, y, shade(FACE_M, 0.82 if (x - x0) > 6 else 1.1))
        px(img, x0, y, shade(FACE_D, 0.9))
    # ---- capital ---------------------------------------------------------
    rect(img, 4, 8, 22, 7, shade(FACE_L, 0.94))
    hline(img, 4, 8, 22, shade(FACE_HI, 1.02))
    hline(img, 4, 14, 22, shade(FACE_D, 0.74))
    for x in range(6, 24, 4):
        vline(img, x, 9, 5, shade(FACE_M, 0.92))
    rect(img, 2, 4, 26, 5, shade(FACE_M, 1.06))
    hline(img, 2, 4, 26, FACE_HI)
    hline(img, 2, 8, 26, shade(FACE_D, 0.72))
    # weathering
    for _ in range(8):
        px(img, rng.randint(x0, x1 - 1), rng.randint(y0, y1 - 1),
           (MOSS[0], MOSS[1], MOSS[2], 130))
    return img


def prop_long_table(seed: int, bays: int = 3) -> Image.Image:
    """The refectory table: one long board on trestles (96 x 34)."""
    rng = random.Random(seed)
    w = 32 * bays
    img = new(w, 34)
    # Board read as a top surface plus a front edge: a single slab of wood this
    # tall reads as a wall of timber rather than a table you can work at.
    for y in range(6, 18):
        for x in range(w):
            v = 0.94 + 0.05 * ((x * 3 + y * 5) % 3)
            px(img, x, y, shade(WOOD_M, v))
    hline(img, 0, 6, w, WOOD_L)
    # lengthwise plank seams and cross joints at each bay
    for y in (10, 14):
        hline(img, 0, y, w, shade(WOOD_D, 0.94))
    for x in range(16, w, 16):
        vline(img, x, 7, 11, shade(WOOD_D, 0.9))
    # front edge, five pixels: thickness, a highlight, a shadow beneath
    rect(img, 0, 18, w, 5, shade(WOOD_D, 0.94))
    hline(img, 0, 18, w, shade(WOOD_M, 1.02))
    hline(img, 0, 20, w, shade(WOOD_D, 0.8))
    hline(img, 0, 22, w, shade(WOOD_D, 0.6))
    # trestles
    for x in range(6, w, 32):
        rect(img, x, 23, 4, 10, shade(WOOD_D, 0.95))
        rect(img, x + 1, 24, 2, 8, WOOD_M)
        hline(img, x - 3, 30, 10, shade(WOOD_D, 0.9))
    # objects along the board: manuscripts, candle, ink, stack
    for i in range(0, bays):
        bx = i * 32
        kind = (i * 5 + seed) % 4
        if kind == 0:
            rect(img, bx + 4, 9, 10, 8, PARCH)
            hline(img, bx + 4, 9, 10, PARCH_L)
            vline(img, bx + 9, 9, 8, shade(PARCH_D, 0.9))
            for line in range(4):
                hline(img, bx + 5, 11 + line, 3, INK)
                hline(img, bx + 11, 11 + line, 2, INK)
        elif kind == 1:
            for k in range(3):
                vline(img, bx + 6 + k * 2, 11, 10, PARCH_D)
                px(img, bx + 6 + k * 2, 10, THREAD)
            rect(img, bx + 16, 10, 3, 3, (32, 30, 34))
            vline(img, bx + 17, 6, 4, PARCH_L)
        elif kind == 2:
            rect(img, bx + 5, 13, 8, 7, BIND_BLUE)
            px(img, bx + 5, 13, THREAD)
            hline(img, bx + 5, 16, 8, shade(BIND_BLUE, 1.4))
            rect(img, bx + 17, 11, 2, 4, PARCH_L)
            px(img, bx + 17, 10, (255, 214, 150))
        else:
            # an abandoned place: a stool tipped back, page on the table
            hline(img, bx + 4, 12, 9, PARCH)
            hline(img, bx + 4, 13, 9, PARCH_D)
    return img


def prop_stool_pair(seed: int) -> Image.Image:
    img = new(30, 14)
    for ox in (0, 17):
        rect(img, ox + 2, 4, 10, 4, WOOD_M)
        hline(img, ox + 2, 4, 10, WOOD_HI)
        hline(img, ox + 2, 7, 10, shade(WOOD_D, 0.85))
        vline(img, ox + 3, 8, 4, shade(WOOD_D, 0.9))
        vline(img, ox + 10, 8, 4, shade(WOOD_D, 0.9))
    return img


def prop_beam(seed: int) -> Image.Image:
    """A snapped roof beam, fallen across the floor."""
    img = new(46, 14)
    for i in range(40):
        y = 5 + int(math.sin(i / 9.0) * 2)
        px(img, 3 + i, y, WOOD_M)
        px(img, 3 + i, y + 1, WOOD_D)
        px(img, 3 + i, y - 1, WOOD_L)
        if i % 7 == 0:
            px(img, 3 + i, y + 2, shade(WOOD_D, 0.7))
    # broken end splinters
    for i in range(5):
        px(img, 43 + (i % 2), 4 + i, shade(WOOD_L, 0.9))
    return img


def prop_toolbar_props():
    return None


# ---------------------------------------------------------------------------
# Build atlases
# ---------------------------------------------------------------------------
def build_tiles() -> dict:
    tiles = {}
    # --- floors -----------------------------------------------------------
    for i in range(4):
        tiles[f"floor_flag_{i}"] = floor_flagstone(100 + i, tone=i % 3, cracks=(1 if i == 2 else 0))
    tiles["floor_flag_worn"] = floor_worn(7)
    for i in range(2):
        tiles[f"floor_quarry_{i}"] = floor_quarry(200 + i, tone=i)
    tiles["floor_grate"] = floor_grate(11)
    # --- wall faces -------------------------------------------------------
    tiles["face_a"] = brick_face(300)
    tiles["face_b"] = brick_face(301, base=shade(FACE_M, 1.06))
    tiles["face_dado"] = face_dado(302)
    tiles["face_broken_a"] = face_broken(303)
    tiles["face_broken_b"] = face_broken(304)
    tiles["face_niche_scrolls"] = face_niche(310, filled="scrolls")
    tiles["face_niche_codices"] = face_niche(311, filled="codices")
    tiles["face_niche_empty"] = face_niche(312, filled="empty")
    tiles["face_niche_broken"] = face_niche(313, filled="broken")
    # --- water ------------------------------------------------------------
    for kind in ("deep", "n", "s", "e", "w", "ne", "nw", "se", "sw", "ns", "ew"):
        tiles[f"water_{kind}"] = water_tile(kind)
    tiles["damp"] = damp_decal(400)
    tiles["moss"] = moss_decal(401)
    tiles["wear"] = floor_wear_path(402)
    tiles["wall_shadow"] = decal_wall_shadow(403)
    tiles["drip"] = decal_ceiling_drip(404)
    tiles["chain"] = decal_chain(405)
    for i in range(4):
        tiles[f"stair_{i}"] = stair_tread(i, 4)
    tiles["face_left_end"] = face_end(410, side=-1)
    tiles["face_right_end"] = face_end(411, side=1)

    cols = 8
    rows = (len(tiles) + cols - 1) // cols
    sheet = new(cols * T, rows * T)
    rect(sheet, 0, 0, sheet.width, sheet.height, (0, 0, 0, 0))
    index = {}
    for i, (name, img) in enumerate(tiles.items()):
        x = (i % cols) * T
        y = (i // cols) * T
        sheet.alpha_composite(img, (x, y))
        index[name] = [x, y, T, T]
    sheet.save(os.path.join(ART, "archive_tiles.png"))
    with open(os.path.join(ART, "tiles.json"), "w", encoding="utf-8") as fh:
        json.dump({"tile": T, "columns": cols, "frames": index}, fh, indent=2)

    # wall caps: 4x4 atlas
    caps = new(4 * T, 4 * T)
    for mask in range(16):
        x = (mask % 4) * T
        y = (mask // 4) * T
        caps.alpha_composite(wall_cap(mask), (x, y))
    caps.save(os.path.join(ART, "wall_caps.png"))
    return index


def build_props() -> dict:
    props = {}
    props["shelf_full"] = prop_shelf(1, state="full", bays=3)
    props["shelf_partial"] = prop_shelf(2, state="partial", bays=3)
    props["shelf_collapsed"] = prop_shelf(3, state="collapsed", bays=3)
    props["desk"] = prop_desk(4, state="open")
    props["desk_overturned"] = prop_desk(5, state="overturned")
    props["lectern"] = prop_lectern(6)
    props["reading_table"] = prop_reading_table(7)
    props["bench"] = prop_bench(8)
    props["stone_bench"] = prop_stone_bench(9)
    props["stool"] = prop_stool(10)
    props["stool_tipped"] = prop_stool(11, tipped=True)
    props["rubble_large"] = prop_rubble(12, size=(48, 34))
    props["rubble_mid"] = prop_rubble(13, size=(32, 24))
    props["rubble_chunk_a"] = prop_rubble_chunk(14)
    props["rubble_chunk_b"] = prop_rubble_chunk(15)
    props["scrolls_a"] = prop_scrolls(16)
    props["scrolls_b"] = prop_scrolls(17)
    props["scroll_roll"] = prop_scroll_roll(18)
    props["book_stack"] = prop_book_stack(19)
    props["door_frame"] = prop_door_frame(20)
    props["door_leaf"] = prop_door_leaf(21)
    props["candle_stand"] = prop_candle_stand(22)
    props["wall_lamp"] = prop_wall_lamp(23)
    props["drying_rack"] = prop_drying_rack(24)
    props["ink_horn"] = prop_ink_horn(25)
    props["paternoster"] = prop_paternoster(26)
    props["armarium_open"] = prop_armarium(27, open_doors=True)
    props["armarium_closed"] = prop_armarium(28, open_doors=False)
    props["beam"] = prop_beam(29)
    props["shelf_closed"] = prop_press_closed(30)
    props["door_portal"] = prop_door_portal(31)
    props["column"] = prop_column(32)
    props["long_table"] = prop_long_table(33)
    props["stool_pair"] = prop_stool_pair(34)

    # pack with 2 px padding
    pad = 2
    max_w = 128
    x = y = pad
    row_h = 0
    placement = {}
    for name, img in props.items():
        if x + img.width + pad > max_w:
            x = pad
            y += row_h + pad
            row_h = 0
        placement[name] = (x, y, img.width, img.height)
        x += img.width + pad
        row_h = max(row_h, img.height)
    sheet = new(max_w, y + row_h + pad)
    for name, img in props.items():
        px_, py_, _, _ = placement[name]
        sheet.alpha_composite(img, (px_, py_))
    sheet.save(os.path.join(ART, "props.png"))
    with open(os.path.join(ART, "props.json"), "w", encoding="utf-8") as fh:
        json.dump(
            {
                "frames": {
                    k: {"x": v[0], "y": v[1], "w": v[2], "h": v[3]}
                    for k, v in placement.items()
                }
            },
            fh,
            indent=2,
        )
    return placement


def main() -> None:
    os.makedirs(ART, exist_ok=True)
    tiles = build_tiles()
    props = build_props()
    radial_light(128).save(os.path.join(ART, "light_radial.png"))
    print(f"tiles: {len(tiles)}  props: {len(props)}  -> {ART}")


if __name__ == "__main__":
    main()
