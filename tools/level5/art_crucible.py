#!/usr/bin/env python3
"""Author the original pixel art for the Blood Crucible (Chapter 1, Level 5).

Nothing here samples or traces a third-party sprite: every pixel is drawn from
primitives. The palette is built to sit inside Soul of Hero's existing dungeon
language — the crypt's warm brown stone is the ancestor — but pushed towards the
material identity of a sacrificial complex: cold basalt, oxblood, brass, iron,
bone and firelight.

Design rules that the gold references (Gate 2 Archive, Monastic Archive) obey and
that this kit follows:

  * Every element is authored at a readable size. The smallest architectural
    feature is 2 x 2 px; there is no single-pixel noise pretending to be detail.
  * Light comes from the upper left. Every block gets a lit top edge, a lit left
    edge, a dark right edge and a darker base, so a field of stone reads as
    volume rather than as a texture.
  * Materials are separated by value, not by hue alone: basalt (dark, cold),
    oxblood (saturated, warm), brass (bright, small), bone (light, sparse).
  * Architecture is stratified. A wall is plinth -> field -> dado -> cornice ->
    cap, five different courses, not one tile repeated.

Outputs
    art/crucible_tiles.png    16 px floor / wall-stack tiles, grid manifest
    art/crucible_props.png    multi-tile props, manifest in art/crucible_props.json
    art/light_radial.png      soft radial light for PointLight2D
    art/sheet_preview.png     every frame at 3x with labels (inspection only)

Run:  python3 tools/level5/art_crucible.py
"""

from __future__ import annotations

import json
import math
import os
import random

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "environment", "chapter1", "crucible"))
T = 16

# ---------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------
BASALT_D = (24, 21, 23)
BASALT_M = (38, 33, 36)
BASALT_L = (54, 46, 49)
BASALT_HI = (74, 64, 67)
GROUT = (17, 15, 17)

WARM_D = (58, 43, 36)      # the crypt's own brown, kept for continuity
WARM_M = (82, 61, 51)
WARM_L = (108, 81, 66)
WARM_HI = (134, 102, 82)

OX_D = (48, 13, 15)
OX_M = (78, 20, 22)
OX_L = (112, 31, 31)
OX_HI = (146, 47, 43)

BRASS_D = (86, 62, 26)
BRASS_M = (132, 98, 40)
BRASS_L = (176, 136, 66)
BRASS_HI = (214, 176, 100)

BONE = (198, 186, 164)
BONE_M = (166, 154, 133)
BONE_D = (128, 117, 99)

IRON_D = (28, 27, 31)
IRON_M = (48, 47, 53)
IRON_L = (74, 73, 81)
IRON_HI = (104, 103, 112)

FIRE = (255, 208, 122)
FIRE_M = (243, 150, 58)
FIRE_D = (186, 78, 30)
EMBER = (128, 44, 20)

SMOKE = (46, 40, 44)

RNG = random.Random(0xB10D)


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------
def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(img, x, y, colour) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), colour if len(colour) == 4 else colour + (255,))


def rect(img, x, y, w, h, colour) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            px(img, xx, yy, colour)


def frame(img, x, y, w, h, colour) -> None:
    hline(img, x, y, w, colour)
    hline(img, x, y + h - 1, w, colour)
    vline(img, x, y, h, colour)
    vline(img, x + w - 1, y, h, colour)


def hline(img, x, y, w, colour) -> None:
    for xx in range(x, x + w):
        px(img, xx, y, colour)


def vline(img, x, y, h, colour) -> None:
    for yy in range(y, y + h):
        px(img, x, yy, colour)


def shade(colour, amount: float):
    return tuple(max(0, min(255, int(c * amount))) for c in colour[:3])


def mix(a, b, t: float):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def block(img, x, y, w, h, base, *, bevel: int = 1, top=None, left=None,
          right=None, bottom=None, alpha: int = 255) -> None:
    """A bevelled stone block: the workhorse of every wall in this kit."""
    body = base if len(base) == 4 else base + (alpha,)
    rect(img, x, y, w, h, body)
    if bevel <= 0:
        return
    hi = (top or shade(base, 1.28)) + (alpha,)
    lo = (bottom or shade(base, 0.66)) + (alpha,)
    mid_hi = (left or shade(base, 1.12)) + (alpha,)
    mid_lo = (right or shade(base, 0.80)) + (alpha,)
    hline(img, x, y, w, hi)
    hline(img, x, y + 1, w, mid_hi)
    vline(img, x, y, h, mid_hi)
    vline(img, x + w - 1, y, h, mid_lo)
    hline(img, x, y + h - 1, w, lo)
    hline(img, x, y + h - 2, w, (shade(base, 0.86) + (alpha,)))


def course_band(img, x, y, w, h, base, *, rows: int = 2, seed: int = 1,
                alpha: int = 255) -> None:
    """Coursed ashlar: staggered stones with mortar joints, 4 px courses."""
    rng = random.Random(seed)
    rect(img, x, y, w, h, GROUT + (alpha,))
    ch = max(3, h // rows)
    for row in range(rows + 1):
        yy = y + row * ch
        if yy >= y + h:
            break
        offset = (row % 2) * 5 + rng.choice([0, 1])
        cx = x - offset
        while cx < x + w:
            bw = rng.choice([7, 8, 9, 11])
            x0 = max(x, cx)
            x1 = min(x + w, cx + bw)
            if x1 - x0 > 1:
                tone = rng.choice([0.94, 1.0, 1.0, 1.07, 1.12])
                body = shade(base, tone)
                rect(img, x0, yy, x1 - x0, min(ch - 1, y + h - yy), body)
                hline(img, x0, yy, x1 - x0, shade(body, 1.18) + (alpha,))
                if x0 > x:
                    vline(img, x0, yy, min(ch - 1, y + h - yy), shade(body, 0.8) + (alpha,))
                if rng.random() < 0.22:
                    px(img, x0 + rng.randint(1, max(1, x1 - x0 - 2)),
                       yy + rng.randint(1, max(1, ch - 3)), shade(body, 0.86) + (alpha,))
            cx += bw


def dither(img, x, y, w, h, colour, density: float, seed: int = 0) -> None:
    rng = random.Random(seed)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if rng.random() < density:
                px(img, xx, yy, colour)


def glow_blob(img, cx: float, cy: float, rx: float, ry: float, colour, alpha: int,
              steps: int = 5) -> None:
    """Soft elliptical fill built from nested alpha layers (no blur filter)."""
    for i in range(steps, 0, -1):
        t = i / steps
        a = int(alpha * (1.0 - t) ** 1.7)
        if a <= 0:
            continue
        for yy in range(int(cy - ry * t), int(cy + ry * t) + 1):
            for xx in range(int(cx - rx * t), int(cx + rx * t) + 1):
                dx = (xx - cx) / max(0.001, rx * t)
                dy = (yy - cy) / max(0.001, ry * t)
                if dx * dx + dy * dy <= 1.0:
                    cur = img.getpixel((xx, yy)) if 0 <= xx < img.width and 0 <= yy < img.height else None
                    if cur is None:
                        continue
                    base = cur[:3]
                    px(img, xx, yy, mix(base, colour, a / 255.0) + (255,))


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------
def bedrock(seed: int) -> Image.Image:
    """Unexcavated rock: what is behind every room in a crypt.

    Deliberately near-black and low contrast so it recedes, but with real stone
    joints so it reads as rock rather than as a hole in the renderer.
    """
    rng = random.Random(seed)
    img = new(T, T)
    base = (22, 19, 21) if seed % 2 else (17, 15, 17)
    rect(img, 0, 0, T, T, base)
    for row in range(0, T, 5):
        offset = (row // 5) % 2 * 4
        hline(img, 0, row, T, shade(base, 0.72))
        for x in range(-offset, T, 9):
            vline(img, x % T, row, 5, shade(base, 0.78))
    for _ in range(9):
        px(img, rng.randint(1, 14), rng.randint(1, 14), shade(base, rng.choice([1.22, 1.4, 0.85])))
    # a faint damp sheen, never enough to compete with the room
    for _ in range(3):
        px(img, rng.randint(2, 13), rng.randint(2, 13), (34, 36, 42, 190))
    return img


def floor_slab(seed: int, tone: float = 1.0, cracks: int = 0,
               base=BASALT_M) -> Image.Image:
    """A 16x16 patch of large basalt flags: two slabs, deep grout, worn bevels."""
    rng = random.Random(seed)
    img = new(T, T)
    rect(img, 0, 0, T, T, GROUT)
    slabs = [(0, 0, 9, 8), (9, 0, 7, 8), (0, 8, 6, 8), (6, 8, 10, 8)]
    for (x, y, w, h) in slabs:
        body = shade(base, tone * rng.choice([0.96, 1.0, 1.04, 1.08]))
        rect(img, x, y, w, h, body)
        hline(img, x, y, w, shade(body, 1.16))
        vline(img, x, y, h, shade(body, 1.08))
        hline(img, x, y + h - 1, w, shade(body, 0.72))
        vline(img, x + w - 1, y, h, shade(body, 0.80))
        for _ in range(rng.randint(1, 3)):
            px(img, x + rng.randint(1, w - 2), y + rng.randint(1, h - 2), shade(body, 0.88))
    for _ in range(cracks):
        x, y = rng.randint(2, 13), rng.randint(1, 5)
        for _step in range(rng.randint(4, 9)):
            px(img, x, y, shade(base, 0.55))
            x += rng.choice([-1, 0, 0, 1])
            y += 1
            if y > 14:
                break
    return img


def floor_aisle(seed: int, variant: int) -> Image.Image:
    """The processional walk: cut slabs with a brass inlay line at each edge.

    variant 0 = straight, 1 = the band turning; the brass line is what makes the
    route read as built rather than as a differently-coloured carpet.
    """
    rng = random.Random(seed)
    img = floor_slab(seed, tone=1.10, base=shade(BASALT_M, 1.06))
    # inlaid brass strips follow the walking axis (vertical on screen)
    if variant == 0:
        for y in range(T):
            px(img, 1, y, BRASS_D)
            px(img, 2, y, BRASS_M)
            px(img, 13, y, BRASS_M)
            px(img, 14, y, BRASS_D)
        for y in range(0, T, 8):
            px(img, 2, y, BRASS_L)
            px(img, 13, y, BRASS_L)
    else:
        for x in range(T):
            px(img, x, 1, BRASS_D)
            px(img, x, 2, BRASS_M)
            px(img, x, 13, BRASS_M)
            px(img, x, 14, BRASS_D)
    for _ in range(5):
        px(img, rng.randint(3, 12), rng.randint(3, 12), shade(BASALT_L, 1.05))
    return img


def floor_channel(kind: str) -> Image.Image:
    """A blood runnel: recessed iron-lined trough carrying dark oxblood."""
    img = floor_slab(0x51 + ord(kind[0]), tone=1.0)
    blood_hi = mix(OX_M, OX_L, 0.55)
    if kind in ("h", "cross"):
        rect(img, 0, 4, T, 8, IRON_D)
        rect(img, 0, 5, T, 6, OX_D)
        rect(img, 0, 6, T, 4, OX_M)
        hline(img, 0, 6, T, blood_hi)
        hline(img, 0, 11, T, IRON_M)
        for x in range(0, T, 5):
            px(img, x, 7, mix(OX_L, FIRE_M, 0.25))
    if kind in ("v", "cross"):
        rect(img, 4, 0, 8, T, IRON_D)
        rect(img, 5, 0, 6, T, OX_D)
        rect(img, 6, 0, 4, T, OX_M)
        vline(img, 6, 0, T, blood_hi)
        vline(img, 11, 0, T, IRON_M)
    if kind == "end":
        rect(img, 0, 4, T, 8, IRON_D)
        rect(img, 0, 5, T, 6, OX_D)
        rect(img, 0, 6, T, 4, OX_M)
        hline(img, 0, 6, T, blood_hi)
        vline(img, 13, 4, 8, IRON_L)
    return img


def floor_grate(seed: int) -> Image.Image:
    img = floor_slab(seed, tone=0.86)
    rect(img, 1, 1, 14, 14, IRON_D)
    for x in range(2, 14, 3):
        vline(img, x, 2, 12, IRON_L)
        vline(img, x + 1, 2, 12, IRON_M)
    hline(img, 1, 1, 14, IRON_M)
    hline(img, 1, 14, 14, IRON_D)
    return img


def floor_stain(seed: int, *, big: bool) -> Image.Image:
    """Sparse iron-oxide / blood stain decal, drawn with a hard-edged rim."""
    rng = random.Random(seed)
    img = new(T, T)
    cx, cy = T / 2 + rng.uniform(-2, 2), T / 2 + rng.uniform(-1, 2)
    rx = rng.uniform(4.5, 6.5) if big else rng.uniform(3.0, 4.5)
    ry = rx * rng.uniform(0.5, 0.75)
    for _ in range(3):
        ox, oy = rng.uniform(-2, 2), rng.uniform(-1.5, 1.5)
        for yy in range(T):
            for xx in range(T):
                dx = (xx - cx - ox) / rx
                dy = (yy - cy - oy) / ry
                d = dx * dx + dy * dy
                if d <= 1.0:
                    a = 190 if d < 0.72 else 120
                    px(img, xx, yy, mix(OX_D, OX_M, rng.random() * 0.5) + (a,))
    return img


# ---------------------------------------------------------------------------
# Wall stack — five courses so a wall has vertical stratification
# ---------------------------------------------------------------------------
def wall_plinth(seed: int) -> Image.Image:
    """Bottom course: a dark projecting socle with a lit top lip."""
    img = new(T, T)
    rect(img, 0, 0, T, T, GROUT)
    course_band(img, 0, 0, T, T, shade(BASALT_D, 1.12), rows=1, seed=seed)
    # the projecting lip catches light and casts the shadow the next course needs
    hline(img, 0, 0, T, BASALT_HI)
    hline(img, 0, 1, T, BASALT_L)
    hline(img, 0, 13, T, BASALT_L)
    hline(img, 0, 14, T, BASALT_M)
    hline(img, 0, 15, T, GROUT)
    return img


def wall_field(seed: int) -> Image.Image:
    img = new(T, T)
    course_band(img, 0, 0, T, T, WARM_M, rows=3, seed=seed)
    # damp seeping from the course above
    dither(img, 0, 0, T, 3, shade(WARM_D, 0.9), 0.30, seed)
    return img


def wall_dado(seed: int) -> Image.Image:
    """Carved band: a repeated chevron, the sacrificial motif of the complex."""
    img = new(T, T)
    course_band(img, 0, 0, T, T, shade(WARM_M, 0.92), rows=2, seed=seed)
    # sunken panel
    rect(img, 1, 4, 14, 8, shade(WARM_D, 0.92))
    frame(img, 1, 4, 14, 8, shade(WARM_D, 0.72))
    hline(img, 2, 5, 12, shade(WARM_L, 1.02))
    for i, x in enumerate(range(3, 13, 3)):
        px(img, x, 9, WARM_HI)
        px(img, x + 1, 8, WARM_HI)
        px(img, x + 1, 9, shade(WARM_D, 0.8))
        px(img, x + 2, 7, shade(WARM_L, 1.05))
    return img


def wall_cornice(seed: int) -> Image.Image:
    """Projecting top course: lit upper face, deep soffit shadow."""
    img = new(T, T)
    rect(img, 0, 0, T, T, GROUT)
    rect(img, 0, 2, T, 9, WARM_L)
    hline(img, 0, 2, T, WARM_HI)
    hline(img, 0, 3, T, shade(WARM_L, 1.1))
    for x in range(0, T, 5):
        vline(img, x, 4, 6, shade(WARM_M, 0.9))
    hline(img, 0, 10, T, shade(WARM_D, 0.8))
    hline(img, 0, 11, T, shade(WARM_D, 0.62))
    hline(img, 0, 12, T, GROUT)
    return img


def wall_pier(seed: int) -> Image.Image:
    """A pilaster: a lit shaft with a joint, used to break a long wall into bays."""
    img = new(T, T)
    rect(img, 0, 0, T, T, GROUT)
    rect(img, 3, 0, 10, T, WARM_L)
    vline(img, 3, 0, T, WARM_HI)
    vline(img, 4, 0, T, shade(WARM_L, 1.12))
    vline(img, 11, 0, T, shade(WARM_M, 0.92))
    vline(img, 12, 0, T, shade(WARM_D, 0.9))
    hline(img, 3, 7, 10, shade(WARM_D, 0.84))
    hline(img, 3, 8, 10, shade(WARM_L, 1.06))
    for y in range(0, T, 6):
        px(img, 6, y, shade(WARM_M, 0.9))
        px(img, 9, y + 3, shade(WARM_M, 0.9))
    return img


def wall_cap(seed: int, mask: int = 0) -> Image.Image:
    """Top surface of a wall mass; lit where nothing sits above it."""
    img = new(T, T)
    rect(img, 0, 0, T, T, BASALT_M)
    rng = random.Random(seed)
    for jx in (0, 8):
        for jy in range(0, T, 8):
            ox = 4 if (jy // 8) % 2 else 0
            vline(img, (jx + ox) % T, jy, 8, shade(BASALT_M, 0.84))
            hline(img, 0, jy, T, shade(BASALT_M, 0.88))
    for _ in range(6):
        px(img, rng.randint(1, 14), rng.randint(1, 14), shade(BASALT_M, rng.choice([0.9, 1.1])))
    if not mask & 1:
        hline(img, 0, 0, T, BASALT_HI)
        hline(img, 0, 1, T, BASALT_L)
    if not mask & 8:
        vline(img, 0, 0, T, shade(BASALT_L, 1.06))
    if not mask & 2:
        vline(img, 15, 0, T, shade(BASALT_D, 0.9))
    return img


# ---------------------------------------------------------------------------
# Props — whole sprites, base-anchored, y-sorted
# ---------------------------------------------------------------------------
def floor_shadow(img, cx: float, y: float, rx: float, ry: float, alpha: int = 118) -> None:
    for i in range(int(ry), 0, -1):
        a = int(alpha * (1 - i / max(1.0, ry)) ** 1.4)
        if a <= 0:
            continue
        for xx in range(int(cx - rx * (i / ry)), int(cx + rx * (i / ry)) + 1):
            px(img, xx, int(y - (i - ry * 0.5)), (0, 0, 0, a))


def prop_column(seed: int, *, broken: bool = False) -> Image.Image:
    """A masonry pier: plinth, moulded base, drummed shaft, capital.

    The shaft is shaded across its width so it reads as a cylinder, and the
    capital projects past the shaft so the pier has a silhouette against the
    wall behind it.
    """
    w, h = 36, 80 if not broken else 56
    img = new(w, h)
    rng = random.Random(seed)
    shaft_top = 16 if not broken else 22
    x0, x1 = 9, 27
    # plinth + base moulding
    block(img, 1, h - 14, w - 2, 14, shade(WARM_M, 0.92))
    block(img, 3, h - 20, w - 6, 8, shade(WARM_L, 1.0))
    hline(img, 3, h - 20, w - 6, WARM_HI)
    # shaft
    for y in range(shaft_top, h - 20):
        for x in range(x0, x1):
            u = (x - x0) / max(1, (x1 - x0 - 1))
            px(img, x, y, mix(shade(WARM_L, 1.20), shade(WARM_D, 1.02), u ** 0.8))
    for y in range(shaft_top, h - 20, 11):
        for x in range(x0, x1):
            px(img, x, y, WARM_HI if x < x0 + 6 else shade(WARM_D, 0.82))
    for _ in range(14):
        px(img, rng.randint(x0, x1 - 1), rng.randint(shaft_top, h - 22), shade(WARM_D, 0.9))
    if broken:
        # snapped drum: a jagged fractured top
        for x in range(x0, x1):
            cut = shaft_top + ((x * 7 + seed) % 4)
            for y in range(max(0, cut - 4), cut):
                px(img, x, y, (0, 0, 0, 0))
            px(img, x, cut, shade(WARM_HI, 1.05))
            px(img, x, cut + 1, shade(WARM_L, 0.95))
    else:
        # capital: abacus + echinus with a griffin-ish carving
        block(img, 1, shaft_top - 12, w - 2, 8, shade(WARM_L, 1.06))
        hline(img, 1, shaft_top - 12, w - 2, WARM_HI)
        block(img, 4, shaft_top - 4, w - 8, 6, shade(WARM_M, 1.04))
        for x in range(6, w - 8, 6):
            px(img, x, shaft_top - 8, BRASS_D)
            px(img, x + 1, shaft_top - 8, BRASS_M)
    floor_shadow(img, w / 2, h - 1, w * 0.56, 5, 120)
    return img


def _arc_px(img, cx, cy, r, a0, a1, colour, thickness: float = 1.0):
    """Stroke an arc by walking angle, not by stepping pixels, so the curve is
    smooth instead of a staircase of integer x/y jumps."""
    steps = max(24, int(abs(a1 - a0) * r / 22.0))
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(a0 + (a1 - a0) * t)
        x = cx + math.cos(a) * r
        y = cy + math.sin(a) * r
        for k in range(max(1, int(thickness))):
            px(img, int(round(x)), int(round(y)) + k, colour)


def prop_arch(w: int = 200, h: int = 168, *, variant: str = "wide") -> Image.Image:
    """A monumental gate: coursed spandrels with a semicircular arch cut into them.

    The lesson from the reference rooms is that a gate is not a ring standing on
    two legs -- it is a *wall* with a hole in it. So the whole rectangle is built
    up as masonry first (coursed ashlar, lit from the upper left), the arch
    opening is then carved out of it, and the mouldings are applied last: jamb
    pilasters, voussoir ring, keystone, cornice, gilded crest.
    """
    img = new(w, h)
    small = variant == "small"
    cap_h = 26 if not small else 18                  # pediment reserve at the top
    ring_w = 14 if not small else 10
    inner_r = int(w * (0.33 if not small else 0.30))
    spring = cap_h + ring_w + inner_r                # arch springing line
    cx = w // 2
    sill = h - 1

    # ---- 1. the wall, before the opening --------------------------------
    course_band(img, 0, cap_h, w, h - cap_h, WARM_M, rows=max(2, (h - cap_h) // 15),
                seed=0x0A7 + w)
    # stronger northwest lighting on the whole mass
    for y in range(cap_h, h):
        for x in range(w):
            t = (x / w) * 0.6 + ((y - cap_h) / max(1, h - cap_h)) * 0.4
            cur = img.getpixel((x, y))
            if cur[3] > 0:
                px(img, x, y, shade(cur[:3], 1.18 - 0.42 * t))

    # ---- 2. the opening -------------------------------------------------
    rect(img, cx - inner_r, spring, inner_r * 2, sill - spring, (0, 0, 0, 255))
    for y in range(spring - inner_r, spring + 1):
        for x in range(cx - inner_r, cx + inner_r + 1):
            if (x - cx) ** 2 + (y - spring) ** 2 <= inner_r ** 2:
                px(img, x, y, (0, 0, 0, 255))
    # a cold far wall deep inside the gate, then a low ritual glow at the sill
    for y in range(spring + 8, sill - 6):
        t = (y - spring) / max(1, (sill - 6) - spring)
        for x in range(cx - inner_r + 6, cx + inner_r - 5):
            if (x - cx) ** 2 / max(1, (inner_r - 6) ** 2) + ((y - spring - inner_r) ** 2) / max(1.0, (inner_r * 0.9) ** 2) >= 0.98:
                continue
            px(img, x, y, mix((0, 0, 0), (46, 20, 22), t ** 1.6))
    glow_blob(img, cx, sill - 3, inner_r * 0.55, 13, OX_M, 165)
    glow_blob(img, cx, sill - 5, inner_r * 0.34, 8, OX_L, 130)
    # a lit threshold slab at the bottom of the opening
    block(img, cx - inner_r + 2, sill - 6, inner_r * 2 - 4, 6, shade(WARM_M, 0.8))

    # ---- 3. jamb pilasters ---------------------------------------------
    for flip in (False, True):
        bx = 0 if not flip else w - (16 if not small else 12)
        jw = 16 if not small else 12
        block(img, bx, spring - 10, jw, sill - spring + 10, shade(WARM_L, 0.98))
        hline(img, bx, spring - 10, jw, WARM_HI)
        for i in range(4):
            yy = spring + 2 + i * 15
            if yy + 10 > sill - 8:
                break
            block(img, bx + 3, yy, jw - 6, 10, shade(WARM_L, 0.9))
            frame(img, bx + 3, yy, jw - 6, 10, shade(WARM_D, 0.78))
            hline(img, bx + 4, yy + 1, jw - 8, shade(WARM_HI, 0.88))
        block(img, bx - 2 if not flip else bx - 1, sill - 9, jw + 3, 9, shade(WARM_M, 0.86))
        hline(img, bx, sill - 9, jw + 3, WARM_HI)

    # ---- 4. voussoir ring ----------------------------------------------
    for k in range(ring_w):
        r = inner_r + k
        t = k / max(1, ring_w - 1)
        col = mix(WARM_HI, shade(WARM_M, 0.7), t * 0.9)
        _arc_px(img, cx, spring, r, 180, 360, col)
    for i in range(180, 361, 11):
        a = math.radians(i)
        for r in range(inner_r, inner_r + ring_w):
            px(img, int(round(cx + math.cos(a) * r)), int(round(spring + math.sin(a) * r)),
               shade(WARM_D, 0.86))
    # keystone
    ky = spring - inner_r - ring_w
    block(img, cx - 7, ky, 15, ring_w + 8, shade(WARM_L, 1.1))
    hline(img, cx - 7, ky, 15, WARM_HI)
    rect(img, cx - 2, ky + 5, 4, 10, BRASS_D)
    px(img, cx - 1, ky + 6, BRASS_M)
    px(img, cx + 1, ky + 6, BRASS_M)
    px(img, cx, ky + 4, BRASS_L)

    # ---- 5. cornice + gilded crest above --------------------------------
    block(img, 0, cap_h - 8, w, 6, shade(WARM_L, 1.06))
    hline(img, 0, cap_h - 8, w, WARM_HI)
    hline(img, 0, cap_h - 3, w, shade(WARM_D, 0.8))
    for x in range(2, w - 2, 4):
        px(img, x, cap_h - 2, shade(WARM_D, 0.86))
    crest_y = max(0, cap_h - 26)
    if cap_h >= 22:
        for a in range(0, 360, 2):
            rad = math.radians(a)
            px(img, int(cx + math.cos(rad) * 13), int(crest_y + 11 + math.sin(rad) * 12),
               BRASS_M if math.sin(rad) < 0 else BRASS_D)
        pts = [(cx, crest_y + 1), (cx - 9, crest_y + 19), (cx + 9, crest_y + 19)]
        for i in range(3):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % 3]
            for t in range(40):
                tt = t / 40
                px(img, int(x0 + (x1 - x0) * tt), int(y0 + (y1 - y0) * tt), BRASS_L)
                px(img, int(x0 + (x1 - x0) * tt), int(y0 + (y1 - y0) * tt) + 1, BRASS_D)
    floor_shadow(img, cx, h - 1, w * 0.44, 4, 130)
    return img


def prop_altar(seed: int, *, blood: bool = True, w: int = 64, h: int = 48) -> Image.Image:
    """The offering altar: a monolithic block with a carved front and a bowl."""
    img = new(w, h)
    rng = random.Random(seed)
    block(img, 2, 12, w - 4, h - 12, WARM_M)          # body
    block(img, 0, 6, w, 10, shade(WARM_L, 1.02))      # mensa (top slab)
    hline(img, 0, 6, w, WARM_HI)
    hline(img, 0, 15, w, shade(WARM_D, 0.8))
    # carved front: two niches with skulls
    for i, nx in enumerate((8, w // 2 - 8, w - 26)):
        if nx + 18 > w - 4:
            break
        block(img, nx, 20, 18, 18, shade(WARM_D, 0.92))
        frame(img, nx, 20, 18, 18, shade(WARM_D, 0.7))
        cx = nx + 9
        rect(img, cx - 4, 26, 8, 6, BONE_M)
        rect(img, cx - 3, 27, 6, 4, BONE)
        px(img, cx - 2, 29, (18, 14, 14))
        px(img, cx + 1, 29, (18, 14, 14))
        rect(img, cx - 2, 32, 4, 3, BONE_D)
    # the bowl on top
    by = 2
    rect(img, w // 2 - 14, by, 28, 6, BRASS_D)
    rect(img, w // 2 - 12, by + 1, 24, 4, BRASS_M)
    hline(img, w // 2 - 14, by, 28, BRASS_L)
    rect(img, w // 2 - 10, by + 2, 20, 3, OX_D if blood else IRON_D)
    hline(img, w // 2 - 9, by + 2, 18, OX_L if blood else IRON_M)
    if blood:
        for x in range(4, w - 4, 11):
            for y in range(16, h - 2):
                if rng.random() < 0.35:
                    px(img, x + rng.randint(-1, 1), y, OX_M + (200,))
    # base
    block(img, 0, h - 6, w, 6, shade(WARM_D, 0.86))
    floor_shadow(img, w / 2, h - 1, w * 0.55, 5, 120)
    return img


def _ellipse_top(img, cx: float, cy: float, rx: float, ry: float, colour, *,
                 lit: bool = True, alpha: int = 255) -> None:
    """Filled ellipse with a lit upper-left rim and a dark lower-right rim."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x - cx) / max(0.001, rx)
            dy = (y - cy) / max(0.001, ry)
            if dx * dx + dy * dy <= 1.0:
                col = colour
                if lit:
                    if dy < -0.62 and dx < 0.45:
                        col = shade(colour, 1.14)
                    elif dx > 0.72 or dy > 0.72:
                        col = shade(colour, 0.86)
                px(img, x, y, col + (alpha,) if len(col) == 3 else col)


def prop_crucible(w: int = 200, h: int = 156) -> Image.Image:
    """The crucible: a sunken octagonal basin read in three dimensions.

    Painted as concentric elliptical tiers: each tier is a filled lip, and the
    wall between it and the next tier is drawn as a shadowed band hanging below
    the inner lip. That band is the whole trick - without it a ring of
    concentric ellipses is a target painted on the floor, with it the basin has
    walls and the eye reads depth.
    """
    img = new(w, h)
    cx = w / 2
    cy = 46.0
    rng = random.Random(0x51AC)

    # (rx, ry, top colour, wall colour, wall height)
    tiers = [
        (98, 54, shade(WARM_HI, 1.04), shade(WARM_D, 1.02), 8),
        (90, 48, WARM_L, shade(WARM_D, 0.94), 8),
        (81, 41, shade(WARM_M, 1.02), shade(WARM_D, 0.84), 7),
        (72, 34, shade(WARM_M, 0.92), shade(WARM_D, 0.72), 6),
    ]
    for (rx, ry, top, _wall, _fh) in tiers:
        _ellipse_top(img, cx, cy, rx, ry, top)

    # walls, innermost first so an outer wall never paints over a deeper tier
    for i in range(len(tiers) - 1, -1, -1):
        rx, ry, _top, wall_col, fh = tiers[i]
        inner_ry = tiers[i + 1][1] if i + 1 < len(tiers) else ry
        for x in range(int(cx - rx), int(cx + rx) + 1):
            t = (x - cx) / max(0.001, rx)
            if abs(t) >= 1.0:
                continue
            lip = cy + inner_ry * math.sqrt(max(0.0, 1.0 - t * t))
            for k in range(1, fh + 1):
                # wall is darkest at its base; its left side catches a little of
                # the same northwest light every other surface here obeys.
                amount = 1.10 - 0.13 * k - (0.09 if t > 0.35 else 0.0)
                px(img, x, int(lip) + k, shade(wall_col, amount))

    # --- the blood, deepest and most saturated thing on the floor ---------
    bcy = cy + 20
    for (rx, ry, col) in ((64, 29, OX_D), (57, 25, OX_M), (48, 20, OX_L),
                          (36, 14, OX_HI), (24, 9, mix(OX_HI, FIRE_D, 0.45)),
                          (13, 5, mix(OX_HI, FIRE_M, 0.3))):
        _ellipse_top(img, cx, bcy, rx, ry, col, lit=False)
    for _ in range(90):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0, 1) ** 0.55
        px(img, int(cx + math.cos(a) * r * 56), int(bcy + math.sin(a) * r * 24),
           mix(OX_L, FIRE_M, rng.uniform(0.05, 0.5)))
    for _ in range(16):
        a = rng.uniform(0, math.tau)
        bx = int(cx + math.cos(a) * rng.uniform(8, 46))
        by = int(bcy + math.sin(a) * rng.uniform(4, 20))
        hline(img, bx - 3, by, 7, mix(OX_HI, BONE, 0.32))
    glow_blob(img, cx, bcy, 44, 18, FIRE_D, 70, 6)
    glow_blob(img, cx, bcy, 18, 7, FIRE_M, 55, 5)

    # --- iron clamps at the octagon corners -------------------------------
    for i in range(8):
        a = math.radians(22.5 + i * 45)
        x = int(cx + math.cos(a) * 90)
        y = int(cy + math.sin(a) * 48)
        rect(img, x - 3, y - 2, 7, 4, IRON_M)
        hline(img, x - 3, y - 2, 7, IRON_L)
        hline(img, x - 3, y + 1, 7, IRON_D)

    # --- steps down into the basin on the south face ---------------------
    for i, (sw, yy) in enumerate(((88, int(cy + 50)), (74, int(cy + 58)), (60, int(cy + 66)))):
        block(img, int(cx - sw / 2), yy, sw, 9, shade(WARM_M, 0.92 + i * 0.05))
        hline(img, int(cx - sw / 2), yy, sw, WARM_HI)
        rect(img, int(cx - sw / 2) + 4, yy + 5, sw - 8, 2, OX_D + (150,))
        for x in range(int(cx - sw / 2) + 2, int(cx + sw / 2) - 2, 7):
            vline(img, x, yy, 9, shade(WARM_D, 0.82))
    floor_shadow(img, cx, h - 1, 74, 6, 135)
    return img


def prop_brazier(seed: int, *, broken: bool = False) -> Image.Image:
    """An iron fire-bowl on a tripod: the floor's practical light source."""
    w, h = 36, 52 if not broken else 38
    img = new(w, h)
    top = 10 if not broken else 14
    # tripod
    for (lx, bend) in ((9, -2), (17, 0), (25, 2)):
        for y in range(top + 16, h - 2):
            t = (y - (top + 16)) / max(1.0, (h - 2) - (top + 16))
            px(img, int(lx + bend * t), y, IRON_M)
            px(img, int(lx + bend * t) + 1, y, IRON_D)
        px(img, int(lx + bend), h - 2, IRON_L)
        px(img, int(lx + bend) + 1, h - 2, IRON_L)
    # bowl: rim then body tapering in
    for i in range(9):
        inset = i // 3
        hline(img, 4 + inset, top + 8 + i, w - 8 - inset * 2, mix(IRON_L, IRON_D, i / 8))
    block(img, 3, top + 5, w - 6, 6, IRON_M)
    hline(img, 3, top + 5, w - 6, IRON_HI)
    hline(img, 3, top + 10, w - 6, IRON_D)
    rect(img, 8, top + 6, w - 16, 3, EMBER)
    # coals + a modest flame
    if not broken:
        for x in range(8, w - 8):
            fy = top + 5 - int(3 + 2.2 * math.sin(x * 0.8) + 1.2 * math.sin(x * 2.4))
            for y in range(max(0, fy), top + 7):
                t = (y - fy) / max(1, top + 7 - fy)
                px(img, x, y, mix(FIRE_M, EMBER, t))
        for x in range(12, w - 12, 3):
            px(img, x, top + 2, FIRE)
        glow_blob(img, 18, top + 4, 14, 8, FIRE_M, 100)
        for x in range(7, w - 7):
            px(img, x, top + 7, mix(EMBER, FIRE_M, 0.45))
    floor_shadow(img, 18, h - 1, 17, 4, 120)
    return img


def prop_chain(seed: int, *, hook: bool = True, length: int = 80) -> Image.Image:
    """Hanging chain with a hook: ceiling clutter that makes the hall feel tall."""
    w = 16
    img = new(w, length)
    for y in range(length):
        link = (y // 3) % 2
        col = IRON_M if (y // 3) % 2 else IRON_L
        if link:
            px(img, 7, y, col)
            px(img, 8, y, shade(col, 0.8))
            px(img, 6, y, shade(col, 0.95) if y % 3 == 1 else (0, 0, 0, 0))
        else:
            px(img, 7, y, col)
            px(img, 8, y, shade(col, 0.9))
            px(img, 9, y, shade(col, 0.7) if y % 3 == 1 else (0, 0, 0, 0))
    if hook:
        y = length - 8
        for i in range(8):
            px(img, 7 + i // 2, y + i, IRON_L)
            px(img, 6 - i // 2, y + i, IRON_M)
        px(img, 7, length - 1, IRON_HI)
    return img


def prop_cage(seed: int) -> Image.Image:
    """Hanging iron gibbet with its occupant: vertical clutter that reads at zoom."""
    w, h = 40, 88
    img = new(w, h)
    chain = prop_chain(seed, hook=False, length=40)
    img.alpha_composite(chain, (w // 2 - 8, 0))
    # yoke
    block(img, 4, 38, w - 8, 6, IRON_M)
    hline(img, 4, 38, w - 8, IRON_L)
    # cage: corner posts + top and bottom hoops + bars
    frame(img, 5, 44, w - 10, 34, IRON_L)
    hline(img, 5, 44, w - 10, IRON_HI)
    for x in range(8, w - 8, 4):
        vline(img, x, 45, 32, IRON_M)
        vline(img, x + 1, 45, 32, IRON_D)
    hline(img, 5, 60, w - 10, IRON_M)
    hline(img, 5, 77, w - 10, IRON_D)
    # occupant: a slumped skeleton
    rect(img, w // 2 - 4, 52, 8, 7, BONE_M)
    rect(img, w // 2 - 3, 53, 6, 5, BONE)
    px(img, w // 2 - 2, 55, (18, 14, 14))
    px(img, w // 2 + 1, 55, (18, 14, 14))
    for i in range(4):
        px(img, w // 2 - 1 + (i % 2), 59 + i, BONE_D)
    rect(img, w // 2 - 4, 64, 8, 3, BONE_M)
    vline(img, w // 2 - 4, 64, 10, BONE_D)
    vline(img, w // 2 + 3, 64, 10, BONE_D)
    return img


def prop_banner(seed: int) -> Image.Image:
    """Wall banner: oxblood wool with a gilded crucible sigil, torn hem."""
    w, h = 40, 84
    img = new(w, h)
    rng = random.Random(seed)
    # rod and finials
    block(img, 1, 0, w - 2, 4, BRASS_M)
    px(img, 0, 1, BRASS_L)
    px(img, w - 1, 1, BRASS_L)
    # cloth: two panels falling with a slight sway, ragged bottom edge
    for x in range(4, w - 4):
        sway = int(round(1.6 * math.sin((x - 4) / 7.0)))
        bottom = h - 6 - int(3 * math.sin(x * 0.7)) - (5 if rng.random() < 0.22 else 0)
        u = (x - 4) / max(1.0, (w - 8) - 1)
        body = mix(shade(OX_L, 1.02), OX_D, u * 0.7)
        for y in range(5, bottom):
            px(img, x + sway // 2, y, body)
        # central fold highlight and side shadow
        px(img, x + sway // 2, 5, OX_HI)
    # fold shading: three vertical bands
    for x in (10, 20, 30):
        for y in range(6, h - 12):
            px(img, x, y, shade(OX_D, 0.86))
            px(img, x + 1, y, shade(OX_L, 1.06))
    # sigil
    cx = w // 2
    pts = [(cx, 22), (cx - 9, 40), (cx + 9, 40)]
    for i in range(3):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % 3]
        for t in range(30):
            tt = t / 30
            px(img, int(x0 + (x1 - x0) * tt), int(y0 + (y1 - y0) * tt), BRASS_L)
            px(img, int(x0 + (x1 - x0) * tt), int(y0 + (y1 - y0) * tt) + 1, BRASS_D)
    for y in range(34, 42):
        half = int((y - 34) * 0.45)
        for x in range(cx - half, cx + half + 1):
            px(img, x, y, OX_HI)
    # grommets
    for x in (7, w - 8):
        rect(img, x - 1, 2, 3, 3, IRON_M)
        px(img, x, 2, IRON_HI)
    return img


def prop_torch(seed: int) -> Image.Image:
    """Wall bracket with a burning brand. Hangs on a wall face, not on the floor."""
    w, h = 20, 36
    img = new(w, h)
    # backplate bolted to the wall
    block(img, 2, 12, 5, 16, IRON_M)
    px(img, 3, 14, IRON_HI)
    px(img, 3, 24, IRON_HI)
    # arm out from the wall
    rect(img, 5, 16, 9, 3, IRON_M)
    hline(img, 5, 16, 9, IRON_L)
    hline(img, 5, 18, 9, IRON_D)
    # brand cup
    rect(img, 11, 10, 6, 8, IRON_D)
    rect(img, 12, 10, 4, 7, IRON_M)
    hline(img, 11, 10, 6, IRON_L)
    # flame: three tongues, brightest at the base
    for x in range(9, 19):
        fy = 10 - int(4 + 3.2 * math.sin((x - 9) * 0.9) + 1.8 * math.sin(x * 2.1))
        for y in range(max(0, fy), 11):
            t = (y - fy) / max(1, 11 - fy)
            px(img, x, y, mix(FIRE, FIRE_D, t ** 1.4))
    hline(img, 11, 9, 6, FIRE)
    glow_blob(img, 14, 7, 10, 7, FIRE_M, 120)
    return img


def prop_rubble(seed: int, *, w: int = 48, h: int = 30, fallen_column: bool = False) -> Image.Image:
    """A fall of broken masonry: dry stone chunks, dust, bent iron, one big block."""
    img = new(w, h)
    rng = random.Random(seed)
    # the big block gives the heap a silhouette instead of a scatter of pebbles
    bw, bh = int(w * 0.42), int(h * 0.55)
    block(img, 3, h - bh - 3, bw, bh, shade(WARM_M, 0.92))
    hline(img, 3, h - bh - 3, bw, WARM_HI)
    for i in range(2):
        vline(img, 3 + bw // 3 * (i + 1), h - bh - 3, bh, shade(WARM_D, 0.8))
    # secondary chunks
    for layer in range(3):
        for _ in range(4 - layer):
            cw, chh = rng.randint(6, 13), rng.randint(5, 9)
            cx = rng.randint(2, max(3, w - cw - 2))
            cy = h - 6 - layer * 5 - rng.randint(0, 3)
            body = shade(WARM_M, rng.choice([0.78, 0.88, 1.0, 0.72]))
            block(img, cx, cy, cw, chh, body)
    # dust and grit
    for _ in range(24):
        px(img, rng.randint(1, w - 2), rng.randint(h - 12, h - 1),
           shade(BASALT_D, rng.choice([1.0, 1.3, 1.6])))
    # bent iron rebar
    for _ in range(2):
        rx = rng.randint(4, max(5, w - 10))
        ry = h - rng.randint(8, 14)
        for i in range(rng.randint(5, 10)):
            px(img, rx + i, ry - i // 3 - (1 if (i // 3) % 2 else 0), IRON_M)
            px(img, rx + i, ry + 1 - i // 3 - (1 if (i // 3) % 2 else 0), IRON_D)
    if fallen_column:
        # a snapped drum lying across the heap
        for x in range(4, w - 6):
            tone = 1.10 - 0.5 * abs((x - w / 2) / (w / 2))
            for y in range(h - 20, h - 12):
                px(img, x, y, shade(WARM_L, tone))
            hline(img, x, h - 20, 1, WARM_HI)
        for x in (w // 3, 2 * w // 3):
            vline(img, x, h - 20, 8, shade(WARM_D, 0.8))
    floor_shadow(img, w / 2, h - 1, w * 0.55, 4, 120)
    return img


def prop_slab(seed: int) -> Image.Image:
    """A sacrificial slab: a stone table seen from the camera, with restraints,
    a blood channel round its rim and old stains running down the front."""
    w, h = 56, 48
    img = new(w, h)
    rng = random.Random(seed)
    # top surface, receding: lighter at the back, darker at the front lip
    for y in range(6, 16):
        t = (y - 6) / 9
        hline(img, 4, y, w - 8, mix(shade(WARM_L, 1.16), shade(WARM_L, 1.02), t))
    hline(img, 4, 5, w - 8, WARM_HI)
    # front face
    block(img, 4, 15, w - 8, 16, shade(WARM_M, 0.96))
    hline(img, 4, 15, w - 8, WARM_L)
    # rim channel with blood
    frame(img, 7, 7, w - 14, 7, shade(WARM_D, 0.86))
    hline(img, 8, 8, w - 16, OX_M)
    hline(img, 8, 9, w - 16, OX_L)
    for x in range(10, w - 10, 8):
        px(img, x, 8, mix(OX_L, FIRE_M, 0.3))
    # stains down the front
    for _ in range(6):
        x = rng.randint(8, w - 10)
        for y in range(16, 16 + rng.randint(5, 12)):
            px(img, x, y, OX_D + (rng.randint(150, 220),))
    # restraints at the corners
    for x in (9, w - 15):
        rect(img, x, 4, 6, 5, IRON_M)
        hline(img, x, 4, 6, IRON_L)
        vline(img, x, 4, 13, IRON_D)
        px(img, x + 2, 2, IRON_L)
    # legs
    block(img, 6, h - 14, 9, 14, shade(WARM_D, 0.94))
    block(img, w - 15, h - 14, 9, 14, shade(WARM_D, 0.94))
    for x in range(10, w - 12, 9):
        vline(img, x, 18, h - 32, shade(WARM_D, 0.84))
    floor_shadow(img, w / 2, h - 1, w * 0.52, 5, 125)
    return img


def prop_offering_stand(seed: int) -> Image.Image:
    """Brass ritual machinery: a fed bowl on a plinth, with pipes into the floor."""
    w, h = 40, 58
    img = new(w, h)
    rng = random.Random(seed)
    # pipework rising from the floor into the bowl
    for x0 in (7, 30):
        vline(img, x0, 26, h - 30, BRASS_D)
        vline(img, x0 + 1, 26, h - 30, BRASS_M)
        vline(img, x0 + 2, 26, h - 30, shade(BRASS_D, 0.8))
        rect(img, x0 - 1, h - 8, 5, 4, BRASS_D)
        hline(img, x0 - 1, h - 8, 5, BRASS_M)
    hline(img, 8, 34, 24, BRASS_D)
    hline(img, 8, 35, 24, BRASS_M)
    # bowl: rim, body, lit left face
    for i in range(7):
        hline(img, 4 + i, 10 + i, w - 8 - i * 2, mix(BRASS_L, BRASS_D, i / 6))
    hline(img, 4, 10, w - 8, BRASS_HI)
    hline(img, 5, 11, w - 10, BRASS_L)
    rect(img, 9, 12, w - 18, 4, OX_D)
    hline(img, 10, 12, w - 20, OX_M)
    hline(img, 11, 13, w - 24, mix(OX_M, OX_L, 0.6))
    # stem + plinth
    block(img, 14, 18, 12, 9, shade(BRASS_M, 0.94))
    block(img, 8, h - 10, 24, 10, shade(BRASS_D, 0.92))
    hline(img, 8, h - 10, 24, BRASS_M)
    # rivets and spill
    for x in range(10, 30, 6):
        px(img, x, h - 6, BRASS_L)
    for _ in range(8):
        px(img, rng.randint(8, 31), rng.randint(14, 22), OX_L)
    floor_shadow(img, w / 2, h - 1, 18, 4, 115)
    return img


def prop_skulls(seed: int) -> Image.Image:
    w, h = 32, 22
    img = new(w, h)
    rng = random.Random(seed)
    for i in range(5):
        cx = 4 + i * 6 + rng.randint(-1, 1)
        cy = h - 8 - rng.randint(0, 5)
        rect(img, cx, cy, 6, 5, BONE_M)
        rect(img, cx + 1, cy + 1, 4, 3, BONE)
        px(img, cx + 1, cy + 2, (24, 18, 18))
        px(img, cx + 4, cy + 2, (24, 18, 18))
        rect(img, cx + 1, cy + 5, 4, 2, BONE_D)
    floor_shadow(img, w / 2, h - 1, w * 0.42, 3, 100)
    return img


def prop_emblem(seed: int) -> Image.Image:
    """Wall carving: the crucible sigil, cut into the stone and gilded."""
    w, h = 48, 48
    img = new(w, h)
    frame(img, 0, 0, w, h, shade(WARM_D, 0.8))
    block(img, 2, 2, w - 4, h - 4, shade(WARM_M, 0.92))
    cx, cy = w / 2, h / 2
    # ring
    for a in range(360):
        rad = math.radians(a)
        x = int(cx + math.cos(rad) * 17)
        y = int(cy + math.sin(rad) * 17)
        px(img, x, y, BRASS_M)
        px(img, x, y + 1, BRASS_D)
    # triangle
    pts = [(cx, cy - 13), (cx - 12, cy + 9), (cx + 12, cy + 9)]
    for i in range(3):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % 3]
        steps = 40
        for s in range(steps):
            t = s / steps
            px(img, int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t), BRASS_L)
            px(img, int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t) + 1, BRASS_D)
    # drop
    for y in range(int(cy + 2), int(cy + 11)):
        half = int((y - (cy + 2)) * 0.4)
        for x in range(int(cx) - half, int(cx) + half + 1):
            px(img, x, y, OX_L if x < cx else OX_M)
    return img


def prop_throne_apparatus(seed: int) -> Image.Image:
    """The broken sacrificial apparatus that closes the boss arena.

    A stepped octagonal plinth carrying a snapped iron ring over a blood well,
    with the broken arc lying where it fell.
    """
    w, h = 132, 124
    img = new(w, h)
    cx = w / 2
    cy = h * 0.44
    rng = random.Random(seed)

    tiers = [(58, 26, shade(WARM_HI, 1.03), 8), (52, 22, WARM_L, 7), (45, 18, WARM_M, 6)]
    for (rx, ry, top, _fh) in tiers:
        _ellipse_top(img, cx, cy, rx, ry, top)
    for i in range(len(tiers) - 1, -1, -1):
        rx, ry, _t, fh = tiers[i]
        inner_ry = tiers[i + 1][1] if i + 1 < len(tiers) else ry
        for x in range(int(cx - rx), int(cx + rx) + 1):
            t = (x - cx) / max(0.001, rx)
            if abs(t) >= 1.0:
                continue
            lip = cy + inner_ry * math.sqrt(max(0.0, 1.0 - t * t))
            for k in range(1, fh + 1):
                px(img, x, int(lip) + k, shade(shade(WARM_D, 0.95), 1.08 - 0.12 * k))
    # well
    for (rx, ry, col) in ((38, 13, OX_D), (31, 10, OX_M), (22, 6, OX_L), (12, 3, OX_HI)):
        _ellipse_top(img, cx, cy + 12, rx, ry, col, lit=False)
    glow_blob(img, cx, cy + 12, 28, 9, FIRE_D, 80, 5)
    for _ in range(34):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0, 1) ** 0.6
        px(img, int(cx + math.cos(a) * r * 33), int(cy + 12 + math.sin(a) * r * 10),
           mix(OX_L, FIRE_M, rng.uniform(0, 0.5)))

    # snapped iron ring
    ring_cy = cy - 24
    for (a0, a1) in ((200, 352), (12, 158)):
        steps = int((a1 - a0) * 1.4)
        for i in range(steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / steps)
            for r, col in ((34, IRON_L), (33, IRON_M), (32, IRON_M), (31, IRON_D)):
                px(img, int(cx + math.cos(a) * r), int(ring_cy + math.sin(a) * r * 0.78), col)
    for a in (200, 352, 12, 158):
        rad = math.radians(a)
        for r in range(30, 36):
            px(img, int(cx + math.cos(rad) * r), int(ring_cy + math.sin(rad) * r * 0.78), IRON_HI)
    for a in (245, 295, 65, 115):
        rad = math.radians(a)
        for t in range(10, 32):
            x = int(cx + math.cos(rad) * t)
            y = int(ring_cy + math.sin(rad) * t * 0.78 + 18)
            px(img, x, y, IRON_M)
            px(img, x, y + 1, IRON_D)
    for i in range(18):
        px(img, int(cx + 32 + i), int(cy + 18 - i // 2), IRON_M if i % 3 else IRON_L)
        px(img, int(cx + 32 + i), int(cy + 19 - i // 2), IRON_D)
    for _ in range(110):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0, 1) ** 0.5
        px(img, int(cx + math.cos(a) * r * 50), int(cy + 8 + math.sin(a) * r * 16),
           OX_M + (rng.randint(140, 220),))
    floor_shadow(img, cx, h - 1, 60, 6, 130)
    return img


# ---------------------------------------------------------------------------
# Light texture
# ---------------------------------------------------------------------------
def radial_light(size: int = 256) -> Image.Image:
    img = new(size, size)
    half = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot((x - half) / half, (y - half) / half)
            if d >= 1.0:
                continue
            a = (1.0 - d) ** 2.2
            img.putpixel((x, y), (255, 255, 255, int(255 * a)))
    return img


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
def build_tiles() -> dict:
    frames = {}
    grid = 8

    def place(name, image, col, row):
        frames[name] = {
            "x": col * T, "y": row * T,
            "w": image.width, "h": image.height,
        }
        return image

    cells = []
    variants = {
        "floor_a": (lambda: floor_slab(1, 1.00), 0, 0),
        "floor_b": (lambda: floor_slab(2, 1.05), 1, 0),
        "floor_c": (lambda: floor_slab(3, 0.95), 2, 0),
        "floor_d": (lambda: floor_slab(4, 1.02, cracks=2), 3, 0),
        "floor_worn": (lambda: floor_slab(5, 0.88, cracks=1), 4, 0),
        "floor_broken": (lambda: floor_slab(6, 1.0, cracks=3), 5, 0),
        "floor_grate": (lambda: floor_grate(7), 6, 0),
        "floor_aisle_v": (lambda: floor_aisle(8, 0), 7, 0),
        "floor_aisle_h": (lambda: floor_aisle(9, 1), 0, 1),
        "floor_channel_h": (lambda: floor_channel("h"), 1, 1),
        "floor_channel_v": (lambda: floor_channel("v"), 2, 1),
        "floor_channel_x": (lambda: floor_channel("cross"), 3, 1),
        "floor_channel_end": (lambda: floor_channel("end"), 4, 1),
        "stain_a": (lambda: floor_stain(11, big=True), 5, 1),
        "stain_b": (lambda: floor_stain(12, big=False), 6, 1),
        "stain_c": (lambda: floor_stain(13, big=False), 7, 1),
        "wall_plinth": (lambda: wall_plinth(21), 0, 2),
        "wall_field_a": (lambda: wall_field(22), 1, 2),
        "wall_field_b": (lambda: wall_field(23), 2, 2),
        "wall_dado_a": (lambda: wall_dado(24), 3, 2),
        "wall_dado_b": (lambda: wall_dado(25), 4, 2),
        "wall_cornice": (lambda: wall_cornice(26), 5, 2),
        "wall_pier": (lambda: wall_pier(27), 6, 2),
        "wall_cap": (lambda: wall_cap(28), 7, 2),
        "bedrock_a": (lambda: bedrock(31), 0, 3),
        "bedrock_b": (lambda: bedrock(32), 1, 3),
    }
    width, height = grid * T, 4 * T
    sheet = new(width, height)
    for name, (builder, col, row) in variants.items():
        image = builder()
        sheet.alpha_composite(image, (col * T, row * T))
        place(name, image, col, row)
    sheet.save(os.path.join(ART, "crucible_tiles.png"))
    return frames


def build_props() -> dict:
    builders = {
        "arch_monumental": (lambda: prop_arch(112, 168, variant="narrow"), 0, 0),
        "arch_wide": (lambda: prop_arch(208, 168, variant="wide"), 22, 0),
        "arch_doorway": (lambda: prop_arch(88, 112, variant="small"), 0, 0),
        "altar": (lambda: prop_altar(31), 2, 0),
        "altar_dry": (lambda: prop_altar(32, blood=False), 3, 0),
        "crucible": (lambda: prop_crucible(), 4, 0),
        "apparatus": (lambda: prop_throne_apparatus(33), 5, 0),
        "column": (lambda: prop_column(41), 6, 0),
        "column_broken": (lambda: prop_column(42, broken=True), 7, 0),
        "brazier": (lambda: prop_brazier(43), 8, 0),
        "brazier_broken": (lambda: prop_brazier(44, broken=True), 9, 0),
        "cage": (lambda: prop_cage(45), 10, 0),
        "banner": (lambda: prop_banner(46), 11, 0),
        "torch": (lambda: prop_torch(47), 12, 0),
        "rubble_large": (lambda: prop_rubble(48, w=48, h=30), 13, 0),
        "rubble_small": (lambda: prop_rubble(49, w=32, h=22), 14, 0),
        "rubble_column": (lambda: prop_rubble(56, w=56, h=34, fallen_column=True), 21, 0),
        "slab": (lambda: prop_slab(50), 15, 0),
        "stand": (lambda: prop_offering_stand(51), 16, 0),
        "skulls": (lambda: prop_skulls(52), 17, 0),
        "emblem": (lambda: prop_emblem(53), 18, 0),
        "chain_long": (lambda: prop_chain(54, length=96), 19, 0),
        "chain_short": (lambda: prop_chain(55, length=56, hook=False), 20, 0),
    }
    # simple shelf packer: tallest first, three rows
    frames = {}
    cursor_x, cursor_y, row_h = 0, 0, 0
    max_w = 0
    placed = []
    for name, (builder, _c, _r) in builders.items():
        image = builder()
        if cursor_x + image.width > 1024:
            cursor_y += row_h
            cursor_x, row_h = 0, 0
        frames[name] = {"x": cursor_x, "y": cursor_y, "w": image.width, "h": image.height}
        placed.append((cursor_x, cursor_y, image))
        cursor_x += image.width + 2
        row_h = max(row_h, image.height)
        max_w = max(max_w, cursor_x)
    sheet = new(max_w, cursor_y + row_h)
    for (x, y, image) in placed:
        sheet.alpha_composite(image, (x, y))
    sheet.save(os.path.join(ART, "crucible_props.png"))
    return frames


def sheet_preview(tiles: dict, props: dict) -> None:
    """Inspection sheet: every frame in its own labelled cell at 3x."""
    tile_sheet = Image.open(os.path.join(ART, "crucible_tiles.png"))
    prop_sheet = Image.open(os.path.join(ART, "crucible_props.png"))
    scale = 3
    cell = 200
    cols = 8
    names = list(props.items())
    rows = (len(names) + cols - 1) // cols
    canvas = new(cols * cell + 16, 3 * T * scale + rows * cell + 60)
    canvas.alpha_composite(
        tile_sheet.resize((tile_sheet.width * scale, tile_sheet.height * scale), Image.NEAREST), (8, 8))
    d = ImageDraw.Draw(canvas)
    for name, f in tiles.items():
        d.text((8 + f["x"] * scale + 1, 8 + f["y"] * scale + 1), name[:14], fill=(255, 240, 170, 255))
    base_y = 3 * T * scale + 24
    for i, (name, f) in enumerate(names):
        cx = 8 + (i % cols) * cell
        cy = base_y + (i // cols) * cell
        sprite = prop_sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        d.rectangle([cx, cy, cx + cell - 8, cy + cell - 8], fill=(26, 22, 24, 255))
        canvas.alpha_composite(
            sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST), (cx + 4, cy + 18))
        d.text((cx + 4, cy + 4), "%s %dx%d" % (name, f["w"], f["h"]), fill=(255, 240, 170, 255))
    canvas.convert("RGB").save(os.path.join(ART, "sheet_preview.png"))


def main() -> None:
    os.makedirs(ART, exist_ok=True)
    tiles = build_tiles()
    props = build_props()
    radial_light().save(os.path.join(ART, "light_radial.png"))
    with open(os.path.join(ART, "crucible_tiles.json"), "w", encoding="utf-8") as fh:
        json.dump({"tile_size": T, "frames": tiles}, fh, indent=2)
        fh.write("\n")
    with open(os.path.join(ART, "crucible_props.json"), "w", encoding="utf-8") as fh:
        json.dump({"tile_size": T, "frames": props}, fh, indent=2)
        fh.write("\n")
    sheet_preview(tiles, props)
    print("tiles %d, props %d -> %s" % (len(tiles), len(props), ART))


if __name__ == "__main__":
    main()
