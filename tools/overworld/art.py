#!/usr/bin/env python3
"""Pixel-art generation for the Hollow Marches overworld.

This module is *engineering*: pixel primitives, a fixed 16 px grid, and a
deterministic writer. The composition of the region lives in `author.py`.

Everything here is authored by hand in code, at the project's real scale: a
16 x 16 tile and a 640 x 360 gameplay frame. Nothing is a smooth gradient fill
or a scaled photograph; every surface is drawn from a small palette with
explicit bevels, dithers and edge masks so the result tiles cleanly and reads
at 2x presentation.

Outputs (written by `author.py`):
  assets/environment/overworld/overworld_tiles.png    ground + detail + solid
  assets/environment/overworld/overworld_props.png    landmark/camp/vegetation
  data/overworld/overworld_tiles.json                 frame -> atlas rects
  data/overworld/overworld_props.json                 prop  -> atlas rects
"""

from __future__ import annotations

import json
import os

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
T = 16
ART_DIR = os.path.join(ROOT, "assets", "environment", "overworld")
DATA_DIR = os.path.join(ROOT, "data", "overworld")

OUTLINE = (14, 12, 18, 255)


# ---------------------------------------------------------------------------
# palette — a dying autumn frontier: pale dead grass, cold grey stone, dried
# blood, and the cyan of a failing Soul Relay.
# ---------------------------------------------------------------------------
P = {
    "void": (16, 13, 22, 255),

    "grass_dk": (66, 72, 50, 255),
    "grass": (92, 96, 64, 255),
    "grass_hi": (118, 120, 80, 255),
    "grass_dry": (132, 124, 78, 255),
    "grass_dry_hi": (158, 148, 96, 255),

    "moor_dk": (54, 66, 56, 255),
    "moor": (76, 90, 72, 255),
    "moor_hi": (104, 120, 88, 255),

    "dirt_dk": (74, 60, 44, 255),
    "dirt": (108, 88, 62, 255),
    "dirt_hi": (134, 110, 76, 255),

    "gravel_dk": (78, 76, 84, 255),
    "gravel": (104, 102, 112, 255),
    "gravel_hi": (136, 134, 146, 255),

    "rock_dk": (66, 66, 80, 255),
    "rock": (92, 92, 108, 255),
    "rock_hi": (124, 124, 144, 255),

    "ash_dk": (72, 66, 68, 255),
    "ash": (100, 94, 94, 255),
    "ash_hi": (128, 122, 118, 255),

    "mud_dk": (62, 54, 44, 255),
    "mud": (88, 76, 60, 255),
    "mud_hi": (114, 100, 80, 255),

    "stone_dk": (70, 72, 88, 255),
    "stone": (100, 102, 120, 255),
    "stone_hi": (138, 140, 158, 255),
    "stone_edge": (52, 54, 66, 255),

    "ritual_dk": (62, 36, 42, 255),
    "ritual": (88, 52, 58, 255),
    "ritual_hi": (120, 72, 78, 255),

    "soul_dk": (52, 68, 84, 255),
    "soul": (76, 102, 116, 255),
    "soul_hi": (112, 156, 164, 255),
    "soul_glow": (126, 216, 206, 255),

    "water_dk": (32, 54, 72, 255),
    "water": (46, 76, 98, 255),
    "water_hi": (74, 118, 142, 255),
    "water_glint": (134, 184, 200, 255),

    "wood_dk": (66, 46, 32, 255),
    "wood": (108, 76, 50, 255),
    "wood_hi": (144, 106, 70, 255),

    "iron_dk": (72, 74, 84, 255),
    "iron": (124, 126, 136, 255),
    "iron_hi": (176, 178, 186, 255),

    "blood_dk": (78, 24, 28, 255),
    "blood": (132, 38, 42, 255),
    "blood_hi": (178, 66, 60, 255),

    "fire": (236, 148, 60, 255),
    "fire_hi": (252, 214, 132, 255),
    "gold": (206, 172, 84, 255),
    "gold_hi": (240, 214, 140, 255),
    "bone": (206, 198, 178, 255),
    "bone_dk": (168, 160, 140, 255),
    "cloth": (140, 66, 64, 255),
    "cloth_hi": (176, 92, 80, 255),
}


def C(key):
    return P[key]


# ---------------------------------------------------------------------------
# primitives
# ---------------------------------------------------------------------------
def new(w, h):
    return Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0))


def px(img, x, y, colour):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((int(x), int(y)), colour if len(colour) == 4 else tuple(colour[:3]) + (255,))


def rect(img, x, y, w, h, colour):
    body = colour if len(colour) == 4 else tuple(colour[:3]) + (255,)
    for yy in range(int(y), int(y + h)):
        for xx in range(int(x), int(x + w)):
            if 0 <= xx < img.width and 0 <= yy < img.height:
                img.putpixel((xx, yy), body)


def hline(img, x, y, w, colour):
    for xx in range(int(x), int(x + w)):
        px(img, xx, y, colour)


def vline(img, x, y, h, colour):
    for yy in range(int(y), int(y + h)):
        px(img, x, yy, colour)


def frame_box(img, x, y, w, h, colour):
    hline(img, x, y, w, colour)
    hline(img, x, y + h - 1, w, colour)
    vline(img, x, y, h, colour)
    vline(img, x + w - 1, y, h, colour)


def shade(colour, amount):
    return tuple(max(0, min(255, int(c * amount))) for c in colour[:3]) + (colour[3] if len(colour) == 4 else 255,)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3)) + (a[3] if len(a) == 4 else 255,)


def h01(*values):
    """Deterministic hash in [0,1) — no RNG state, so art is reproducible.

    The raw FNV-1a accumulator is not good enough here: for small, dense keys
    (seed, cell_x, cell_y) its bits 8..23 stay tiny, so `h01(92, a, b) < 0.05`
    came out true for most cells and an ordered dither filled whole blocks with
    one tone instead of speckling. A murmur3 finalizer avalanches the word
    before it is scaled.
    """
    h = 2166136261
    for v in values:
        h ^= int(v) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFFFFFF) / 4294967296.0


def dither(img, x, y, w, h, colour, density, seed=0, block=2):
    """Sparse ordered dither, clustered into `block`-sized dots.

    The overworld camera runs at 2x, so a single-pixel dither pattern turns into
    salt-and-pepper. Clusters keep the texture readable at presentation scale.
    """
    # The pattern is offset per surface, not the geometry: a clipped half-block on
    # the tile edge would put an identical dark column on every tile and draw a
    # grid line across the region.
    jx = int(h01(seed, 91) * block)
    jy = int(h01(seed, 92) * block)
    for yy in range(int(y), int(y + h), block):
        for xx in range(int(x), int(x + w), block):
            key_x = (xx - int(x)) // block + jx
            key_y = (yy - int(y)) // block + jy
            if h01(seed, key_x, key_y) < density:
                rect(img, xx, yy, block, block, colour)


def grain(img, x, y, w, h, base, light, dark, seed=0, amount=0.18, block=2, soften=0.55):
    """Fill a region with a base tone plus two-tone grain in `block` clusters.

    `soften` pulls the two accents toward the base: full-contrast accents at 2 px
    clusters turn a wide open surface into visible noise instead of texture.
    """
    light = mix(base, light, soften)
    dark = mix(base, dark, soften)
    rect(img, x, y, w, h, base)
    jx = int(h01(seed, 81) * block)
    jy = int(h01(seed, 82) * block)
    for yy in range(int(y), int(y + h), block):
        for xx in range(int(x), int(x + w), block):
            n = h01(seed, (xx - int(x)) // block + jx, (yy - int(y)) // block + jy)
            if n < amount * 0.5:
                rect(img, xx, yy, block, block, dark)
            elif n < amount:
                rect(img, xx, yy, block, block, light)


def bevel_block(img, x, y, w, h, base, *, light, dark, top=None, joint=None):
    """A stone block with a lit top/left and a shaded bottom/right."""
    rect(img, x, y, w, h, base)
    hline(img, x, y, w, light)
    vline(img, x, y, h, light)
    hline(img, x, y + h - 1, w, dark)
    vline(img, x + w - 1, y, h, dark)
    if top is not None and h > 3:
        hline(img, x + 1, y + 1, w - 2, top)
    if joint is not None:
        hline(img, x + 1, y + h - 2, w - 2, joint)


def courses(img, x, y, w, h, base, *, row_h=8, seed=1, mortar=None, light=None, dark=None):
    """Masonry courses: offset rows of blocks with mortar lines."""
    light = light or shade(base, 1.25)
    dark = dark or shade(base, 0.62)
    mortar = mortar or shade(base, 0.5)
    rect(img, x, y, w, h, base)
    row = 0
    yy = int(y)
    while yy < y + h:
        rh = min(row_h, int(y + h - yy))
        offset = 0 if row % 2 == 0 else 8
        x0 = int(x)
        while x0 < x + w:
            bx = x0 - offset
            bw = 16
            bevel_block(img, max(x, bx), yy, min(bw, x + w - max(x, bx)), rh, base,
                        light=light, dark=dark, joint=mortar)
            x0 += bw
        row += 1
        yy += row_h
    for i in range(0, 10):
        cx = int(x) + int(h01(seed, i) * w)
        cy = int(y) + int(h01(seed, i, 3) * h)
        px(img, cx, cy, mortar)
        if h01(seed, i, 7) < 0.4:
            px(img, cx + 1, cy, mortar)


def speck(img, x, y, w, h, colour, count, seed=0):
    for i in range(count):
        px(img, int(x) + int(h01(seed, i, 1) * w), int(y) + int(h01(seed, i, 2) * h), colour)


def blade(img, x, y, h, colour, lean=0):
    for i in range(h):
        px(img, x + (1 if (lean > 0 and i > h // 2) else (-1 if lean < 0 and i > h // 2 else 0)), y - i, colour)


def arch(img, x, y, w, h, fill, *, edge=None, thick=1):
    """A round-headed arch opening: filled with `fill`, outlined."""
    edge = edge or shade(fill, 0.55)
    r = w // 2
    cy = y + r
    for yy in range(int(y), int(y + h)):
        if yy < cy:
            dy = cy - yy
            half = int((r * r - dy * dy) ** 0.5)
            x0 = x + r - half
            x1 = x + r + half
        else:
            x0, x1 = x, x + w
        hline(img, x0, yy, x1 - x0, fill)
        if thick:
            px(img, x0, yy, edge)
            px(img, x1 - 1, yy, edge)


def glow_disc(img, cx, cy, rx, ry, colour, alpha):
    for yy in range(int(cy - ry), int(cy + ry) + 1):
        for xx in range(int(cx - rx), int(cx + rx) + 1):
            dx = (xx - cx) / max(1.0, rx)
            dy = (yy - cy) / max(1.0, ry)
            d = dx * dx + dy * dy
            if d > 1.0:
                continue
            a = int(alpha * (1.0 - d))
            if a <= 0:
                continue
            if not (0 <= xx < img.width and 0 <= yy < img.height):
                continue
            base = img.getpixel((xx, yy))
            out = mix((base[0], base[1], base[2], 255), colour, a / 255.0)
            img.putpixel((xx, yy), (out[0], out[1], out[2], max(base[3], a if base[3] == 0 else base[3])))


def contact_shadow(img, alpha=96):
    """A 1-2 px occlusion strip along the bottom of a prop."""
    w, h = img.size
    for x in range(w):
        px(img, x, h - 1, (10, 8, 14, alpha))
    for x in range(w // 6, w - w // 6):
        px(img, x, h - 2, (10, 8, 14, max(0, alpha - 34)))


def edge_mask(mask_bits):
    """Return (n, e, s, w) booleans from a 4-bit mask (1=N, 2=E, 4=S, 8=W)."""
    return (bool(mask_bits & 1), bool(mask_bits & 2), bool(mask_bits & 4), bool(mask_bits & 8))


def opened_mask(mask_bits):
    """Sides of a tile that are NOT shared with another tile of its family.

    The baker (`author.bake`) sets a bit when the neighbour holds the *same*
    terrain, i.e. the side is interior to a continuous surface. Any art that
    only draws on an exposed side has to invert that mask: with the raw bits
    every interior tile would paint its own outline and a road, a wall or a
    copse would resolve into a grid of 16 px boxes.
    """
    return edge_mask((~int(mask_bits)) & 0xF)


# ---------------------------------------------------------------------------
# ground tiles — opaque 16 x 16, tiling variants
# ---------------------------------------------------------------------------
def ground_grass(seed, dry=0.0):
    img = new(T, T)
    base = mix(C("grass"), C("grass_dry"), dry) if dry else C("grass")
    dark = mix(C("grass_dk"), C("grass_dry"), dry * 0.7) if dry else C("grass_dk")
    light = mix(C("grass_hi"), C("grass_dry_hi"), dry) if dry else C("grass_hi")
    grain(img, 0, 0, T, T, base, light, dark, seed=seed, amount=0.2)
    # short blades: a few readable tufts beat a dense scatter at 2x zoom
    for i in range(4):
        bx = int(h01(seed, i, 11) * (T - 2)) + 1
        by = int(h01(seed, i, 12) * (T - 3)) + 3
        blade(img, bx, by, 2 + int(h01(seed, i, 13) * 3), mix(light, base, 0.2), lean=1 if i % 2 else -1)
    speck(img, 0, 0, T, T, dark, 5, seed=seed + 7)
    if h01(seed, 17) < 0.5:
        # one heavier feature per variant: a bare patch, a stone, a fallen stem
        fx = int(h01(seed, 18) * (T - 6)) + 2
        fy = int(h01(seed, 19) * (T - 5)) + 2
        if h01(seed, 20) < 0.34:
            dither(img, fx, fy, 5, 4, mix(base, C("dirt"), 0.55), 0.6, seed=seed + 21, block=1)
        elif h01(seed, 22) < 0.5:
            rect(img, fx, fy, 2, 1, C("gravel"))
            px(img, fx, fy + 1, C("gravel_dk"))
        else:
            hline(img, fx, fy, 3, mix(dark, base, 0.3))
    return img


def ground_moor(seed):
    img = new(T, T)
    grain(img, 0, 0, T, T, C("moor"), C("moor_hi"), C("moor_dk"), seed=seed, amount=0.18)
    for i in range(3):
        bx = int(h01(seed, i, 21) * (T - 2)) + 1
        by = int(h01(seed, i, 22) * (T - 4)) + 4
        blade(img, bx, by, 2 + int(h01(seed, i, 23) * 3), C("moor_hi"), lean=1 if i % 3 else -1)
    if h01(seed, 5) < 0.5:
        rect(img, 4 + int(h01(seed, 6) * 6), 6 + int(h01(seed, 7) * 6), 2, 1, mix(C("moor_dk"), C("water"), 0.4))
    return img


def ground_dirt(seed, tone=1.0):
    """Packed earth. Three tones of grain plus one per-variant feature, so a wide
    dirt apron does not read as one repeated stamp at the camera's 2x zoom."""
    img = new(T, T)
    base = shade(C("dirt"), tone)
    light = shade(C("dirt_hi"), tone)
    dark = shade(C("dirt_dk"), tone)
    # 16 % grain in 2 px blocks was measured at 12.7 % "static" (adjacent-pixel
    # luma jumps) on a native-framed render, and that is what a packed-earth
    # apron looked like at 2x: television snow. Half the grain, softened, plus
    # one feature at a *larger* scale per tile, puts two spatial frequencies in
    # the surface instead of one.
    grain(img, 0, 0, T, T, base, light, dark, seed=seed, amount=0.09, soften=0.42)
    speck(img, 0, 0, T, T, shade(dark, 0.9), 3, seed=seed + 3)
    roll_b = h01(seed, 21)
    if roll_b < 0.30:
        # a patch of damp earth, darker and wider than the grain
        dx = int(h01(seed, 22) * (T - 9)) + 1
        dy = int(h01(seed, 23) * (T - 7)) + 1
        for i in range(4):
            rect(img, dx + i, dy + i // 2, 8 - i, 1, shade(dark, 0.94))
    elif roll_b < 0.55:
        # a scatter of small stones pressed into the surface
        for i in range(4):
            gx = int(h01(seed, i, 24) * (T - 4)) + 1
            gy = int(h01(seed, i, 25) * (T - 4)) + 1
            rect(img, gx, gy, 2, 2, mix(C("gravel"), base, 0.35))
            px(img, gx, gy, C("gravel_hi"))
    px(img, int(h01(seed, 10) * T), int(h01(seed, 11) * T), C("gravel"))
    roll = h01(seed, 12)
    fx = int(h01(seed, 13) * (T - 7)) + 2
    fy = int(h01(seed, 14) * (T - 6)) + 2
    if roll < 0.3:
        # a rut: two short parallel grooves
        hline(img, fx, fy, 5, shade(dark, 0.9))
        hline(img, fx + 1, fy + 2, 4, shade(light, 0.96))
    elif roll < 0.6:
        # trodden gravel patch
        for i in range(4):
            px(img, fx + int(h01(seed, i, 31) * 5), fy + int(h01(seed, i, 32) * 4), C("gravel_hi"))
        px(img, fx + 1, fy + 1, C("gravel_dk"))
    else:
        # dried mud crack
        for k in range(4):
            px(img, fx + k, fy + (k % 2), shade(dark, 0.82))
    return img


def ground_gravel(seed):
    """Plains gravel.

    Measured against a render of the plateau: at the camera's 2x zoom the old
    18 % grain in 2 px blocks turned a wide field into television static, because
    every tile carried the same energy at the same scale. Three changes follow
    from that measurement - grain down to 10 %, softened, and every second tile
    carries one *broad* feature (a slab, a drift, a worn patch) so the shallow
    scale is not the only scale in the frame.
    """
    img = new(T, T)
    grain(img, 0, 0, T, T, C("gravel"), C("gravel_hi"), C("gravel_dk"),
          seed=seed, amount=0.10, soften=0.4)
    roll = h01(seed, 7)
    if roll < 0.34:
        # A cracked slab. The first version was a 10x7 rectangle of pale stone
        # with a hard lit top edge, and at 2x it read as a literal tile: a field
        # of them printed a brick lattice, worse than the noise it replaced. This
        # one is irregular, low-contrast, and never touches a tile edge.
        sx = int(h01(seed, 8) * (T - 11)) + 2
        sy = int(h01(seed, 9) * (T - 9)) + 2
        slab = mix(C("gravel_hi"), C("gravel"), 0.72)
        rect(img, sx, sy, 8, 5, slab)
        rect(img, sx + 1, sy + 4, 6, 1, mix(C("gravel_dk"), C("gravel"), 0.6))
        px(img, sx, sy, mix(C("gravel_hi"), C("gravel"), 0.3))
        px(img, sx + 5, sy + 2, C("gravel_dk"))
    elif roll < 0.62:
        # a drift of finer stone collected in a hollow
        dx = int(h01(seed, 10) * (T - 8)) + 1
        dy = int(h01(seed, 11) * (T - 5)) + 2
        for i in range(7):
            w = 7 - i
            hline(img, dx + i // 2, dy + i, w, mix(C("gravel_dk"), C("gravel"), 0.55))
    else:
        for i in range(4):
            gx = int(h01(seed, i, 31) * (T - 3)) + 1
            gy = int(h01(seed, i, 32) * (T - 3)) + 1
            s = 1 + int(h01(seed, i, 33) * 2)
            rect(img, gx, gy, s, max(1, s - 1), C("gravel_hi"))
            px(img, gx, gy + s - 1, C("gravel_dk"))
    return img


def ground_rock(seed, tone=1.0):
    """Fractured stone plate: cracks, not strata.

    Two previous versions laid a full-width horizontal seam in every variant.
    Across a four-variant field that is a stack of perfectly level lines - the
    same defect as the "two flat planks" cliff, one layer down, and it measured
    100 % line coverage before this rewrite. These cracks wander in y, start and
    stop inside the tile, and light a lip on one side only, which is what makes
    stone read as broken rather than striped.
    """
    base = shade(C("rock"), tone)
    img = new(T, T)
    grain(img, 0, 0, T, T, base, C("rock_hi"), C("rock_dk"), seed=seed, amount=0.18)

    # A short wandering fissure that starts and stops inside the tile.
    cx = int(h01(seed, 1) * (T - 6)) + 3
    y = 2 + int(h01(seed, 1, 2) * 4)
    stop = T - 2 - int(h01(seed, 2, 3) * 3)
    lit = 0
    while y < stop:
        step = 1 + int(h01(seed, y, 4) * 3)
        lean = 0
        r = h01(seed, y, 5)
        if r < 0.34:
            lean = -1
        elif r > 0.66:
            lean = 1
        for k in range(step):
            if y + k >= stop:
                break
            px(img, cx, y + k, shade(base, 0.84))
            if lit < 4:
                px(img, cx - lean, y + k, mix(base, C("rock_hi"), 0.24))
                lit += 1
        cx = max(2, min(T - 3, cx + lean))
        y += step

    # A second, shorter crack from an edge, so plates meet.
    ex = int(h01(seed, 6) * (T - 8)) + 3
    ey = 3 if h01(seed, 7) < 0.5 else T - 4
    dy = 1 if ey < T // 2 else -1
    for k in range(2 + int(h01(seed, 8) * 3)):
        px(img, ex - (k // 3), ey + dy * k, shade(base, 0.88))
    speck(img, 0, 0, T, T, C("rock_dk"), 3, seed=seed + 5)
    for i in range(2):
        gx = int(h01(seed, i, 51) * (T - 2)) + 1
        gy = int(h01(seed, i, 52) * (T - 2)) + 1
        px(img, gx, gy, C("rock_hi"))
    return img


def ground_ash(seed):
    img = new(T, T)
    grain(img, 0, 0, T, T, C("ash"), C("ash_hi"), C("ash_dk"), seed=seed, amount=0.2)
    dither(img, 0, 0, T, T, mix(C("ash_dk"), C("void"), 0.35), 0.04, seed=seed + 1)
    return img


def ground_mud(seed):
    img = new(T, T)
    grain(img, 0, 0, T, T, C("mud"), C("mud_hi"), C("mud_dk"), seed=seed, amount=0.18)
    # wet rims
    for i in range(3):
        cx = int(h01(seed, i, 41) * (T - 4)) + 2
        cy = int(h01(seed, i, 42) * (T - 3)) + 2
        hline(img, cx, cy, 2 + int(h01(seed, i, 43) * 3), mix(C("water_hi"), C("mud"), 0.55))
    return img


def ground_flagstone(seed, *, base=None, joint=None, worn=0.0, tone=1.0):
    """Broken masonry paving: courses of slabs with joints you can actually see.

    The previous version had the right idea - joints drawn only inside the tile,
    edge bricks running off it, so courses continue across cells - but the joints
    were drawn at 0.86 tone against a 1.0 field, i.e. about four luma, and then a
    10 % grain pass and a moss speckle were laid on top. At the camera's 2x zoom
    the result was grey mush with no paviour lines at all: the L10 forecourt, which
    is 600 cells of this stone, read as scattered debris on an untextured floor
    rather than as a paved terrace.

    What makes paving read is the *pair* of lines: a dark joint, and the lit edge
    of the slab on the light side of it. Joint contrast is now 0.58 tone, the lit
    edge is 1.14, and the grain and moss are cut right back so they cannot eat the
    lines. Tone spread across variants stays narrow (0.98-1.03) so the plaza is one
    surface; the variants differ in course layout and wear.
    """
    base = shade(base or C("stone"), tone)
    joint = shade(joint or C("stone_edge"), tone)
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(base, 0.97 + 0.05 * h01(seed, 3)))

    row_y = -int(h01(seed, 1) * 5)
    row = 0
    joints = []
    while row_y < T:
        row_h = 5 + int(h01(seed, row, 11) * 3)
        if 0 < row_y < T:
            joints.append(("h", row_y, row, 0, 0))
        x = -int(h01(seed, row, 12) * 8)
        brick = 0
        while x < T:
            bw = 6 + int(h01(seed, row, brick, 13) * 6)
            if 0 < x < T:
                # a vertical joint belongs to ONE course. Running it the full
                # height of the tile is what made paving print as graph paper:
                # every brick lined up vertically through every course.
                joints.append(("v", x, row * 31 + brick, row_y, row_h))
            brick += 1
            x += bw
        row_y += row_h
        row += 1

    # Grain goes down BEFORE the joints. `grain()` fills its region with its base
    # colour first (it is a painter, not a brush), so a grain pass drawn after the
    # courses repaints the whole tile and erases them - which is exactly why paving
    # in this world has never shown a paviour line, at any contrast, in three
    # passes. Every other caller in this file paints grain first for the same
    # reason.
    grain(img, 0, 0, T, T, shade(base, 0.98), shade(base, 1.05), shade(base, 0.90),
          seed=seed + 11, amount=0.05)

    for kind, at, k, r0, rh in joints:
        depth = 0.76 + 0.08 * h01(seed, k, 5)
        if kind == "h":
            # one dark line, one lit arris below it: the pair is what reads as a
            # raised slab edge. Two dark rows plus an arris was too busy.
            hline(img, 0, at, T, shade(joint, depth))
            if at + 1 < T:
                hline(img, 0, at + 1, T, shade(base, 1.07))
        else:
            # clipped to its own course, so the courses stay offset from each
            # other instead of aligning into a grid
            y0 = max(0, r0)
            y1 = min(T, r0 + rh)
            vline(img, at, y0, y1 - y0, shade(joint, depth))
            if at + 1 < T:
                vline(img, at + 1, y0, y1 - y0, shade(base, 1.05))

    # a few chipped corners, inside the tile
    for i in range(2 + int(worn * 2)):
        cx = int(h01(seed, i, 21) * (T - 6)) + 2
        cy = int(h01(seed, i, 22) * (T - 6)) + 2
        for k in range(2 + int(h01(seed, i, 23) * 3)):
            px(img, cx + k, cy + k // 2, shade(joint, 0.72))
    if worn > 0:
        # moss and grit collect in the joints, not across the slabs
        for i in range(int(5 * worn)):
            jx = int(h01(seed, i, 41) * (T - 2)) + 1
            jy = int(h01(seed, i, 42) * (T - 2)) + 1
            px(img, jx, jy, mix(C("grass_dk"), joint, 0.45))
    return img


def ground_ritual(seed):
    img = new(T, T)
    grain(img, 0, 0, T, T, C("ritual"), C("ritual_hi"), C("ritual_dk"), seed=seed, amount=0.3)
    # dried blood pooling in the cracks
    for i in range(3):
        cx = int(h01(seed, i, 51) * (T - 5)) + 2
        cy = int(h01(seed, i, 52) * (T - 3)) + 1
        w = 2 + int(h01(seed, i, 53) * 4)
        hline(img, cx, cy, w, C("blood_dk"))
        px(img, cx + 1, cy + 1, C("blood"))
    speck(img, 0, 0, T, T, C("blood_dk"), 9, seed=seed + 6)
    return img


def ground_soul(seed):
    img = new(T, T)
    grain(img, 0, 0, T, T, C("soul"), C("soul_hi"), C("soul_dk"), seed=seed, amount=0.28)
    for i in range(2):
        cx = int(h01(seed, i, 61) * (T - 6)) + 3
        cy = int(h01(seed, i, 62) * (T - 4)) + 2
        hline(img, cx, cy, 3, mix(C("soul_glow"), C("soul"), 0.45))
    return img


def ground_water(seed, shallow=False):
    """Water, with depth rather than wallpaper.

    Audited from the world overview: the shallow-water bands were the most
    obviously wrong surface in the region - one variant, so fifteen hundred cells
    repeated the same three horizontal glints, and the result read as a striped
    ribbon rather than as water. What is here now:

      * two tones of body with a depth blotch, so the surface is not flat,
      * ripples drawn as short *broken* arcs at varied heights, never a full-width
        line (a line across a tile is the tile grid showing through),
      * a lighter film at the top edge and a darker undertow at the bottom, which
        is what makes a body of water read as having a shallow and a deep side,
      * a per-variant seed, so four shallow variants tile without the eye finding
        the repeat.
    """
    img = new(T, T)
    base = C("water") if not shallow else mix(C("water"), C("water_hi"), 0.42)
    dark = C("water_dk")
    light = C("water_hi")
    glint = C("water_glint") if not shallow else mix(C("water_glint"), C("water_hi"), 0.45)
    grain(img, 0, 0, T, T, base, light, dark, seed=seed, amount=0.13 if shallow else 0.17)

    # depth: one soft blotch, two steps darker, so the body has shape
    bx = int(h01(seed, 11, 1) * (T - 7))
    by = int(h01(seed, 12, 1) * (T - 5))
    rect(img, bx, by, 6, 4, mix(base, dark, 0.35))
    rect(img, bx + 1, by, 4, 3, mix(base, dark, 0.2))

    # ripples: broken arcs, not rules
    for i in range(5):
        y = int(h01(seed, i, 71) * (T - 2))
        x = int(h01(seed, i, 72) * (T - 6))
        run = 2 + int(h01(seed, i, 73) * 3)
        hline(img, x, y, run, glint)
        if h01(seed, i, 74) > 0.45:
            hline(img, min(T - 1, x + run + 2), y, 1 + int(h01(seed, i, 75) * 2), glint)

    # the shallow shelf: a lit film along the top, an undertow along the bottom
    if shallow:
        hline(img, 0, 0, T, mix(base, glint, 0.30))
        for x in range(0, T, 2):
            if h01(seed, x, 80) > 0.5:
                px(img, x, 1, mix(base, glint, 0.22))
        hline(img, 0, T - 1, T, mix(base, dark, 0.55))
        hline(img, 0, T - 2, T, mix(base, dark, 0.25))
    return img


def ground_cliff_top(seed):
    """The broken plateau surface.

    The cliff tops are the largest uninterrupted ground area in the world, so
    they are where repeated tiling is most obvious. Two rules came out of trying
    to paint them, both measured rather than guessed:

    * a *hard* full-width line tiles into a horizon every 16 px and reads as
      graph paper at map scale (100 % line coverage, which is how it was found);
    * but a field of small per-tile features is worse, because the features land
      at the same offsets in every variant and the plateau becomes a regular dot
      grid. Both were rendered at world scale and compared before choosing.

    What survives is a soft bedding seam - the stratification the plateau needs
    for direction, at a contrast low enough that it does not rule a line - plus
    one crack and a few chips, low contrast so they read as texture.
    """
    base = mix(C("rock"), C("gravel"), 0.4)
    img = new(T, T)
    grain(img, 0, 0, T, T, base, C("rock_hi"), C("rock_dk"),
          seed=seed, amount=0.09, soften=0.4)
    sy = 3 + int(h01(seed, 5) * 10)
    hline(img, 0, sy, T, shade(base, 0.90))
    hline(img, 0, sy + 1, T, shade(base, 1.05))
    if h01(seed, 6) < 0.5:
        cx = int(h01(seed, 7) * (T - 6)) + 2
        for k in range(5):
            px(img, cx + k, 4 + k + (k % 2), shade(base, 0.74))
            px(img, cx + k + 1, 4 + k + (k % 2), shade(base, 1.06))
    for i in range(3):
        x = int(h01(seed, i, 81) * (T - 4)) + 2
        y = int(h01(seed, i, 82) * (T - 3)) + 1
        hline(img, x, y, 2 + int(h01(seed, i, 83) * 3), shade(base, 0.84))
    return img


def ground_bog(seed):
    """Standing water in a marsh: mostly wet ground, with real pools rare.

    Three attempts are worth recording, because the fen is 592 cells and every one
    of them showed:

      1. three 3 px pale streaks per tile -> each read as a separate object, so the
         fen looked like small blue tiles scattered among olive ones;
      2. water running off two tile edges, so neighbours would join -> every copy
         lined up at the same offset and the fen printed as a striped rug;
      3. a contained pool in every variant -> the same rug at a shorter period.

    The lesson is the one this atlas keeps teaching: *any* feature that every
    variant carries at a similar offset becomes a pattern across a large region,
    and because `bog` is chosen per 3x3 block, a per-variant feature also lands on
    the block lattice. So the wetness is carried only by the tile's colour and
    sheen - a cool, dark, slightly specular ground that reads as saturated at 2x.
    Pools are placed in world space by `detail_pool`, where a per-cell field
    decides, and cannot form a lattice. A marsh read from above is mostly the
    colour of wet peat.
    """
    base = mix(C("moor_dk"), C("mud"), 0.42)
    img = new(T, T)
    grain(img, 0, 0, T, T, base, mix(C("moor"), C("water_hi"), 0.26),
          mix(C("water_dk"), base, 0.42), seed=seed, amount=0.16, soften=0.5)
    # a wet sheen across the whole tile: short horizontal highlights, low contrast
    for i in range(3):
        sx = 1 + int(h01(seed, i, 71) * (T - 6))
        sy = 2 + int(h01(seed, i, 72) * (T - 4))
        hline(img, sx, sy, 2 + int(h01(seed, i, 73) * 3),
              mix(C("water_hi"), base, 0.30))
    # No pool here on purpose. `bog` is a ground family chosen per 3x3 block from
    # four variants, so a pool drawn into the tile appears once per block and lines
    # up on the variant lattice - three attempts at a pool inside this tile each
    # printed a pattern across the fen. Pools are placed in world space instead, by
    # the detail overlay below, where a per-cell field decides.
    if h01(seed, 96) < 0.5:
        bx = 2 + int(h01(seed, 97) * 11)
        blade(img, bx, 8 + int(h01(seed, 98) * 5), 3, mix(C("moor_hi"), base, 0.30), lean=1)
    return img


# ---------------------------------------------------------------------------
# detail overlays — transparent 16 x 16, drawn over ground
# ---------------------------------------------------------------------------
def detail_road(seed, stone=False):
    img = new(T, T)
    res = 16
    if stone:
        base = C("stone")
        rect(img, 0, 0, res, res, shade(base, 0.95))
        # Measured: this road tile scored 13.6 % "static" (adjacent-pixel luma
        # jumps > 18) against 0.7-3 % for the ground under it, and roads are the
        # most-travelled surface in the world. Same defect the dirt apron had:
        # one spatial frequency, at full contrast, everywhere.
        grain(img, 0, 0, res, res, shade(base, 0.95), shade(base, 1.1), shade(base, 0.8),
              seed=seed, amount=0.08, soften=0.4)
        # Worn paving, not a ladder: a transverse joint only on some tiles, and
        # never the full width, so the road surface does not repeat every 16 px.
        if h01(seed, 5) < 0.55:
            jy = 3 + int(h01(seed, 6) * (res - 7))
            jx = int(h01(seed, 7) * 5)
            hline(img, jx, jy, res - jx - 2, shade(base, 0.74))
            hline(img, jx + 1, jy + 1, res - jx - 4, shade(base, 1.12))
        for i in range(3):
            gx = int(h01(seed, i, 8) * (res - 3)) + 1
            gy = int(h01(seed, i, 9) * (res - 2)) + 1
            rect(img, gx, gy, 2, 1, C("gravel_hi"))
        speck(img, 0, 0, res, res, mix(C("gravel_hi"), base, 0.5), 4, seed=seed + 1)
        speck(img, 0, 0, res, res, mix(C("stone_edge"), base, 0.4), 3, seed=seed + 2)
    else:
        base = mix(C("dirt"), C("gravel"), 0.55)
        grain(img, 0, 0, res, res, base, C("dirt_hi"), C("dirt_dk"),
              seed=seed, amount=0.075, soften=0.4)
        speck(img, 0, 0, res, res, mix(C("gravel"), base, 0.45), 4, seed=seed + 3)
        # one worn rut per tile, wider than a grain cell, so the road has a
        # scale larger than its own noise
        ry = int(h01(seed, 13) * (res - 5)) + 2
        for i in range(9):
            rect(img, 2 + i, ry + (i % 2), 2, 1, mix(C("dirt_dk"), base, 0.45))
        hline(img, 3, ry + 2, 8, mix(C("dirt_hi"), base, 0.5))
        for i in range(2):
            x = int(h01(seed, i, 101) * (res - 3)) + 1
            y = int(h01(seed, i, 102) * (res - 2)) + 1
            hline(img, x, y, 2, mix(C("dirt_dk"), base, 0.6))
    return img


def detail_road_edge(base_img, mask_bits, *, fringe_colour):
    """Fade a road tile into the ground on the sides that are not road.

    The baker's road mask is per *tile*, so a hard cut at the tile border turns
    every bend into a 16 px staircase, and the verge has to be drawn.

    Two earlier versions of this function are worth recording, because both
    looked reasonable in code and measured badly on screen:

    1. A 3 px band eroded with a seeded *dither* (skip 30-85 % of pixels) in a
       fringe colour much darker than the road, plus a final row scattered to
       full transparency. At the camera's 2x zoom that is a checkered dark ring
       on every tile, and on a single-tile-wide path — which is what the guard
       rails in this world are — it is the dominant feature of the surface. It
       measured 13.2 % adjacent-pixel luma jumps, against 0.7-2.6 % for the
       ground beneath it.
    2. A solid 2 px fringe. No noise, but the edge became a hard line, which is
       the staircase it was supposed to hide.

    What it does now: the verge is a *solid* two-pixel band in a tone between
    the road and the ground, its outer boundary wanders by one pixel under a
    seeded noise, and the two rows blend toward the ground in fixed steps. The
    silhouette is broken (no staircase) and the values are smooth (no static).
    """
    img = base_img.copy()
    n, e, s, w = opened_mask(mask_bits)
    sides = {"n": (n, 0), "s": (s, 1), "w": (w, 2), "e": (e, 3)}
    # verge tone: the road pulled 55 % toward the ground it sits on
    verge = mix(fringe_colour, C("dirt_dk"), 0.3)
    inner = mix(verge, fringe_colour, 0.45)

    def wobble(x, y, side_index):
        # 1 px of licensed irregularity so the edge is not a ruler line
        return 1 if h01(x, y, mask_bits, side_index) > 0.55 else 0

    for side, (present, k) in sides.items():
        if not present:
            continue
        for i in range(16):
            if side in ("n", "s"):
                base_y = i
            else:
                base_y = i
            for d in range(2):
                if side in ("n", "s"):
                    y = d if side == "n" else 15 - d
                    x = i
                else:
                    x = d if side == "w" else 15 - d
                    y = i
                # where the band actually reaches, wobbled outward by a pixel
                reach = 2 + wobble(x, y, k)
                if d >= reach - 1:
                    continue
                if d == 0:
                    # outer row: the road stops here, mostly
                    img.putpixel((x, y), verge[:3] + (200,))
                else:
                    img.putpixel((x, y), inner[:3] + (232,))
    return img


def detail_bank(mask_bits):
    """Shoreline: a dark silt band where water meets land."""
    img = new(T, T)
    n, e, s, w = edge_mask(mask_bits)
    silt = mix(C("water_dk"), C("mud"), 0.45)
    for i in range(16):
        if n:
            hline(img, 0, 0, 16, silt)
            px(img, i, 1, shade(silt, 0.85))
        if s:
            hline(img, 0, 15, 16, silt)
            px(img, i, 14, shade(silt, 0.85))
        if w:
            vline(img, 0, 0, 16, silt)
            px(img, 1, i, shade(silt, 0.85))
        if e:
            vline(img, 15, 0, 16, silt)
            px(img, 14, i, shade(silt, 0.85))
    for i in range(10):
        px(img, int(h01(mask_bits, i, 1) * 16), int(h01(mask_bits, i, 2) * 16), mix(C("mud_hi"), silt, 0.5))
    return img


def detail_path(seed):
    """A trodden path: a dusty wash with a few stones in it.

    This used to be a per-pixel 42 % coin flip between two tones, which is a
    dither, and at the camera's 2x zoom a dither is television static. Measured
    on a native-framed render it scored 13.2 % adjacent-pixel luma jumps against
    0.7-3 % for the ground it lies on, and it is the overlay on every footpath
    and every camp clearing in the world. It is now a low-contrast wash plus a
    handful of hand-placed features, so a path reads as *worn ground* rather than
    as a different material with noise on it.
    """
    img = new(T, T)
    wash = mix(C("dirt"), C("gravel"), 0.32)
    # the wash itself: solid, slightly lighter than the ground, so a path is a
    # change of tone and not a change of texture
    for y in range(16):
        for x in range(16):
            if h01(seed, x, y, 7) < 0.72:
                px(img, x, y, wash)
    # dust drift along the direction of travel
    for i in range(7):
        y = int(h01(seed, i, 3) * 14) + 1
        x = int(h01(seed, i, 4) * 8) + 1
        hline(img, x, y, 4 + int(h01(seed, i, 5) * 4), mix(wash, C("dirt_hi"), 0.35))
    # three stones pressed into the surface, at a readable size
    for i in range(3):
        x = int(h01(seed, i, 11) * 12) + 2
        y = int(h01(seed, i, 12) * 12) + 2
        rect(img, x, y, 2, 2, mix(C("gravel"), wash, 0.4))
        px(img, x, y, mix(C("gravel_hi"), wash, 0.3))
    # and one darker scuff, for the direction a foot makes
    sx = int(h01(seed, 21) * 10) + 3
    sy = int(h01(seed, 22) * 10) + 3
    px(img, sx, sy, mix(C("dirt_dk"), wash, 0.5))
    px(img, sx + 1, sy + 1, mix(C("dirt_dk"), wash, 0.5))
    return img


def detail_conduit(mask_bits):
    """Soul Relay conduit: a carved channel with a cold light in it."""
    img = new(T, T)
    n, e, s, w = edge_mask(mask_bits)
    rect(img, 0, 1, T, T - 2, mix(C("stone_edge"), C("soul_dk"), 0.4))
    hline(img, 0, 1, T, C("soul_dk"))
    hline(img, 0, 14, T, C("soul_dk"))
    hline(img, 0, 7, T, C("soul"))
    hline(img, 0, 8, T, mix(C("soul_glow"), C("soul"), 0.35))
    if n:
        rect(img, 0, 0, T, 1, (0, 0, 0, 0))
    if s:
        rect(img, 0, 15, T, 1, (0, 0, 0, 0))
    if w:
        vline(img, 0, 0, T, (0, 0, 0, 0))
        hline(img, 1, 7, T - 1, C("stone_edge"))
    if e:
        vline(img, 15, 0, T, (0, 0, 0, 0))
        hline(img, 0, 7, T - 1, C("stone_edge"))
    return img


def detail_tuft(seed):
    img = new(T, T)
    for i in range(3):
        bx = 4 + int(h01(seed, i, 111) * 8)
        by = 9 + int(h01(seed, i, 112) * 4)
        blade(img, bx, by, 3 + int(h01(seed, i, 113) * 2), C("grass_hi"), lean=1 if i % 2 else -1)
    return img


def detail_pebbles(seed):
    img = new(T, T)
    for i in range(4):
        gx = 2 + int(h01(seed, i, 121) * 12)
        gy = 3 + int(h01(seed, i, 122) * 10)
        rect(img, gx, gy, 2, 1, C("gravel_hi"))
        px(img, gx, gy + 1, C("gravel_dk"))
    return img


def detail_kerb(mask_bits):
    """A dressed-stone kerb round the edge of a paved surface.

    Mask convention: the baker sets a bit when the neighbour is paving, so a bit
    *absent* is an exposed edge. (The first version read the bits the other way
    round, which put the kerb on the inside of every plaza and left the actual
    outline untouched - visible at once in a 4x crop, and worth recording because
    every other masked overlay in this file inverts the mask and this one does
    not.)

    Plazas are painted as ellipses onto a tile grid, so their outline is a
    stair-step of whole tiles. The ground layer cannot fix that - the cells are
    what they are - so the fix is a kerb: a band of dressed stone along the edge,
    lit on top and shadowed at its foot, which reads as built no matter how the
    cells step. Without it, a paving region's boundary is the one place in the
    world where the tile grid is visible on purpose.

    A two-pixel version was tried first and measured as invisible at the camera's
    2x zoom; the band is now three pixels and the top course is well above the
    paving's own value, so the edge reads before the joints do.
    """
    img = new(T, T)
    n, e, s, w = edge_mask(mask_bits)
    stone = mix(C("stone"), C("stone_edge"), 0.10)
    lit = shade(stone, 1.34)
    mid = shade(stone, 1.04)
    dark = shade(stone, 0.58)
    for i in range(T):
        if not n:
            px(img, i, 0, lit)
            px(img, i, 1, mid)
            px(img, i, 2, dark)
        if not s:
            px(img, i, T - 3, dark)
            px(img, i, T - 2, mid)
            px(img, i, T - 1, lit)
        if not w:
            px(img, 0, i, mid)
            px(img, 1, i, dark)
        if not e:
            px(img, T - 2, i, dark)
            px(img, T - 1, i, mid)
    for i in range(3, T - 2, 5):
        if not n:
            px(img, i, 1, dark)
        if not s:
            px(img, i, T - 2, dark)
    return img


def detail_pool(seed):
    """Standing water on wet ground, placed per cell in world space.

    Sized to *nearly fill* its tile: a small blob per cell was tried first and read
    as a scatter of isolated puddles with gaps between them, which is not what a
    marsh looks like from above. With the water reaching most of the tile, a run of
    wet cells joins into a sheet and the ragged edge comes from the boundary of the
    run rather than from each cell, so the pools read as water that has found a
    level. The shape is per-variant (five frames) and picked per tile, not per 3x3
    block - a per-block pick draws the same puddle nine times and reads as a grid.
    """
    img = new(T, T)
    base = mix(C("water_dk"), C("mud"), 0.26)
    deep = mix(C("water_dk"), C("void"), 0.20)
    # The water fills the whole tile at its edges. This is the third attempt at a
    # pool overlay and the two failures are instructive: small blobs read as a
    # scatter of separate puddles, and inset blobs (a per-variant margin) left a
    # 1-2 px dry gutter between neighbours, which printed a *grid* dividing the
    # sheets back into cells. For a run of wet cells to look like one body of
    # water, the water has to reach the cell boundary - so it does, and the shape
    # of the sheet comes from the run's ragged boundary field instead.
    rect(img, 0, 0, T, T, base)
    # Deeper water, as a smooth per-variant gradient rather than per-pixel noise,
    # and no highlight along the tile's own top edge: a lit line on row 0 of every
    # pool tile printed a horizontal stripe every 16 px straight across the sheet -
    # the same shelf problem as the cliff face, one layer down. A body of water
    # assembled from cells cannot know where its own shoreline is, so it carries no
    # shoreline; the marsh's edge is where the `bog` ground simply stops.
    for y in range(T):
        t = y / float(T - 1)
        for x in range(T):
            if h01(seed, x, y) < 0.45 - 0.25 * t:
                px(img, x, y, deep if t > 0.5 else mix(deep, base, 0.5))
    return img


def detail_moss(mask_bits):
    img = new(T, T)
    for x in range(16):
        for y in range(16):
            h = h01(mask_bits, x, y, 7)
            if h < 0.3:
                px(img, x, y, (58, 76, 48, 210))
            elif h < 0.36:
                px(img, x, y, (76, 96, 58, 190))
    return img


def detail_crack(seed):
    """A short fracture. The full-height diagonal an earlier pass drew put the
    same stroke on every cracked cell and read as a repeating glyph."""
    img = new(T, T)
    x = 3 + int(h01(seed, 1) * 8)
    y = 3 + int(h01(seed, 2) * 5)
    tone = mix(C("stone_edge"), C("void"), 0.35)
    for _ in range(4 + int(h01(seed, 3) * 4)):
        px(img, x, y, tone)
        if h01(seed, y, 4) < 0.35:
            px(img, x + 1, y, mix(tone, C("stone"), 0.5))
        x += 1 if h01(seed, y, 5) < 0.5 else -1
        y += 1
    return img


def detail_blood(seed):
    img = new(T, T)
    cx = 5 + int(h01(seed, 1) * 6)
    cy = 5 + int(h01(seed, 2) * 6)
    for y in range(16):
        for x in range(16):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d < 4.2 and h01(seed, x, y) < 0.6:
                px(img, x, y, C("blood_dk") if d > 2 else C("blood"))
    return img


def detail_ash(seed):
    img = new(T, T)
    for i in range(26):
        px(img, int(h01(seed, i, 1) * 16), int(h01(seed, i, 2) * 16), mix(C("ash_hi"), C("bone_dk"), 0.4))
    return img


def detail_soulspark(seed):
    img = new(T, T)
    for i in range(3):
        px(img, 3 + int(h01(seed, i, 1) * 10), 3 + int(h01(seed, i, 2) * 10), C("soul_glow"))
        px(img, 3 + int(h01(seed, i, 1) * 10) + 1, 3 + int(h01(seed, i, 2) * 10), mix(C("soul_glow"), C("soul"), 0.6))
    return img


# ---------------------------------------------------------------------------
# solid / obstacle tiles — opaque 16 x 16, carry collision
# ---------------------------------------------------------------------------
def solid_cliff(mask_bits, seed=0):
    """Cliff face, lit on top: two different tiles for two different jobs.

    The interior variant (no exposed side) is the single most repeated graphic in
    the world - 13 545 of the ~23 350 solid cells, in bands up to 380 wide - so
    it carries *no feature at all*. That took three attempts to accept, each one
    caught only by rendering the cliff at the camera's own 2x zoom rather than at
    10x:

      1. two 8 px `courses()` rows          -> the band printed as long grey
         shelves, the most obvious artefact in the world overview;
      2. irregular seams and loose stones   -> a corduroy dash grid, because every
         variant put its dashes at a similar offset;
      3. 22 % grain in 2 px blocks          -> the same dash grid at a finer
         pitch.

    Any feature inside this tile repeats on the 3-tile variant lattice, and across
    a 380-tile band that is a grid. So the interior is a quiet bed with a
    per-variant tone step and a whisper of grit, and all the structure of a cliff
    face comes from decals placed in world space (`cliff_ledge_*`,
    `cliff_crack_*`, `cliff_buttress_*` in `art_props.py`), which can be
    irregular because they are not tiled.

    The edge variants are a different case: they are seen in short runs along a
    cliff rim, so they can carry a face, and they must carry a lit rim or the drop
    is unreadable. Two earlier faces - blocky courses, and 4-7 px blocks with 1 px
    dark joints - both printed as a brick wall, and the joints printed the shelf
    harder than the courses had. What is here is one soft vertical gradient (lit
    at the top, shaded at the foot), a single bedding seam that never spans the
    tile, two vertical fissures with a lit left lip, and per-pixel grit drawn on
    top of the gradient. No full-width horizontal line exists anywhere in it, so
    a long run of it cannot align into a stripe.
    """
    img = new(T, T)
    n, e, s, w = opened_mask(mask_bits)
    base = mix(C("rock"), C("stone"), 0.35)
    # The mass is *dark*. Measured, the previous face sat at 79 mean luma against
    # walkable ground at 84-101, i.e. the impassable half of the world was the
    # same value as the walkable half and read as more ground. A cliff is a wall
    # seen from above: it is in shadow, and the only bright part of it is the rim
    # where the light lands. Every tone below is derived from this one number.
    base = shade(base, 0.80)
    if not (n or e or s or w):
        tone = shade(base, 0.97 + 0.10 * h01(seed, 1))
        rect(img, 0, 0, T, T, tone)
        for gy in range(T):
            for gx in range(T):
                r = h01(seed + 9, gx, gy)
                if r < 0.030:
                    px(img, gx, gy, shade(tone, 1.10))
                elif r < 0.060:
                    px(img, gx, gy, shade(tone, 0.90))
        return img

    top = shade(base, 1.22 + 0.06 * h01(seed, 1))
    foot = shade(base, 0.74)
    for y in range(T):
        t = y / float(T - 1)
        hline(img, 0, y, T, mix(top, foot, t ** 0.85))
    # one bedding seam, never full width
    sy = 5 + int(h01(seed, 3) * 6)
    sx0 = 1 + int(h01(seed, 4) * 5)
    sx1 = sx0 + 5 + int(h01(seed, 5) * 6)
    hline(img, sx0, sy, min(T - sx0, sx1 - sx0), shade(base, 0.5))
    hline(img, sx0, sy + 1, min(T - sx0, sx1 - sx0), shade(base, 0.76))
    # vertical fissures with a lit left lip
    for i in range(2):
        fx = 3 + int(h01(seed, i, 41) * 10)
        fy = int(h01(seed, i, 42) * 6)
        for k in range(4 + int(h01(seed, i, 43) * 5)):
            y = fy + k
            if y >= T:
                break
            px(img, fx, y, shade(base, 0.44))
            px(img, fx + 1, y, shade(base, 1.1))
    # grit and veining, low contrast. `grain()` fills with its base colour first,
    # so a transparent base blanks the tile - it has to be drawn per pixel over
    # the gradient that is already there.
    for gy in range(T):
        for gx in range(T):
            r = h01(seed + 9, gx, gy)
            shade_now = mix(top, foot, (gy / float(T - 1)) ** 0.85)
            if r < 0.05:
                px(img, gx, gy, shade(shade_now, 1.16))
            elif r < 0.10:
                px(img, gx, gy, shade(shade_now, 0.74))
    if n:
        # the lit rim: the top of the wall catches the sky, and this line is what
        # tells the player where the drop is
        rect(img, 0, 0, T, 3, shade(base, 1.55))
        hline(img, 0, 0, T, shade(base, 1.75))
        for x in range(0, T, 2):
            px(img, x, 3, shade(base, 0.72))
        # a fringe of moss and grit where the wall meets the ground above it
        for x in range(T):
            if h01(seed, x, 36) > 0.55:
                px(img, x, 2, mix(C("grass_dk"), base, 0.45))
    if s:
        rect(img, 0, T - 3, T, 3, shade(base, 0.5))
        for x in range(1, T, 3):
            px(img, x, T - 4, shade(base, 0.62))
        dither(img, 0, T - 2, T, 2, (0, 0, 0, 0), 0.5, seed=seed + 1)
    if w:
        vline(img, 0, 0, T, shade(base, 0.55))
    if e:
        vline(img, T - 1, 0, T, shade(base, 0.55))
    return img


def solid_wall(mask_bits, seed=0, *, base=None):
    """Ruined masonry wall seen face-on: three courses, broken on top."""
    img = new(T, T)
    n, e, s, w = opened_mask(mask_bits)
    base = base or C("stone")
    courses(img, 0, 0, T, T, shade(base, 0.85), row_h=5, seed=seed + 3,
            mortar=shade(base, 0.45), light=shade(base, 1.22), dark=shade(base, 0.6))
    if n:
        # jagged, broken coping
        for x in range(T):
            drop = 1 + int(h01(seed, x, 9) * 3)
            for yy in range(drop):
                px(img, x, yy, (0, 0, 0, 0))
            px(img, x, drop, shade(base, 1.3))
    if s:
        rect(img, 0, T - 2, T, 2, shade(base, 0.45))
    if w:
        vline(img, 0, 0, T, shade(base, 0.5))
    if e:
        vline(img, T - 1, 0, T, shade(base, 0.5))
    # missing blocks
    if h01(seed, 2) < 0.5:
        bx = 2 + int(h01(seed, 3) * 10)
        by = 4 + int(h01(seed, 4) * 6)
        rect(img, bx, by, 3, 2, (0, 0, 0, 0))
    return img


def solid_canopy(mask_bits, seed=0):
    """Dense forest canopy: a dark mass with a lit crown and leaf scatter."""
    img = new(T, T)
    n, e, s, w = opened_mask(mask_bits)
    base = mix(C("moor_dk"), C("void"), 0.28)
    rect(img, 0, 0, T, T, base)
    for y in range(T):
        for x in range(T):
            h = h01(seed, x, y, 3)
            if h < 0.42:
                px(img, x, y, mix(base, (30, 44, 34, 255), 0.7))
            elif h < 0.52:
                px(img, x, y, mix(base, C("moor"), 0.55))
    if n:
        for x in range(T):
            if h01(seed, x, 1) < 0.5:
                px(img, x, 0, mix(base, C("moor_hi"), 0.5))
                px(img, x, 1, mix(base, C("moor"), 0.6))
    if s:
        rect(img, 0, T - 2, T, 2, mix(base, C("void"), 0.4))
    if w:
        vline(img, 0, 0, T, mix(base, C("void"), 0.35))
    if e:
        vline(img, T - 1, 0, T, mix(base, C("void"), 0.35))
    speck(img, 0, 0, T, T, mix(C("moor_hi"), C("grass_hi"), 0.4), 6, seed=seed + 2)
    return img


def solid_rubble(seed):
    img = new(T, T)
    base = mix(C("gravel_dk"), C("stone_edge"), 0.5)
    rect(img, 0, 0, T, T, base)
    for i in range(9):
        bx = 1 + int(h01(seed, i, 1) * 12)
        by = 1 + int(h01(seed, i, 2) * 11)
        bw = 3 + int(h01(seed, i, 3) * 3)
        bh = 2 + int(h01(seed, i, 4) * 2)
        bevel_block(img, bx, by, bw, bh, shade(C("stone"), 0.8 + 0.3 * h01(seed, i, 5)),
                    light=C("stone_hi"), dark=C("stone_edge"))
    dither(img, 0, 0, T, T, (0, 0, 0, 0), 0.06, seed=seed + 1)
    return img


# ---------------------------------------------------------------------------
# tileset assembly
# ---------------------------------------------------------------------------
GROUND_TILES = {
    "grass0": lambda: ground_grass(11, 0.0),
    "grass1": lambda: ground_grass(12, 0.07),
    "grass2": lambda: ground_grass(13, 0.14),
    "grass3": lambda: ground_grass(14, 0.24),
    "grass4": lambda: ground_grass(15, 0.0),
    "grass5": lambda: ground_grass(16, 0.11),
    "moor0": lambda: ground_moor(21),
    "moor1": lambda: ground_moor(22),
    "moor2": lambda: ground_moor(23),
    "moor3": lambda: ground_moor(24),
    "dirt0": lambda: ground_dirt(31),
    "dirt1": lambda: ground_dirt(32, 1.03),
    "dirt2": lambda: ground_dirt(33, 0.97),
    "dirt3": lambda: ground_dirt(34, 1.05),
    "dirt4": lambda: ground_dirt(35, 0.95),
    "gravel0": lambda: ground_gravel(41),
    "gravel1": lambda: ground_gravel(42),
    "gravel2": lambda: ground_gravel(43),
    "gravel3": lambda: ground_gravel(44),
    "gravel4": lambda: ground_gravel(45),
    "gravel5": lambda: ground_gravel(46),
    "rock0": lambda: ground_rock(51),
    "rock1": lambda: ground_rock(52, 0.9),
    "rock2": lambda: ground_rock(53, 1.08),
    "rock3": lambda: ground_rock(54, 0.95),
    "ash0": lambda: ground_ash(61),
    "ash1": lambda: ground_ash(62),
    "mud0": lambda: ground_mud(71),
    "mud1": lambda: ground_mud(72),
    "floor0": lambda: ground_flagstone(81),
    # Tone spread is deliberately narrow (0.98-1.03): the four variants used to
    # span 0.92-1.08, i.e. 14 luma, and a plaza drawn from them read as a
    # patchwork of individual 16 px slabs rather than as one paved surface. The
    # variants now differ in joint layout and wear, not in brightness.
    "floor1": lambda: ground_flagstone(82, worn=0.7, tone=0.98),
    "floor2": lambda: ground_flagstone(83, worn=1.0, tone=1.03),
    "floor3": lambda: ground_flagstone(84, worn=0.4, tone=0.995),
    "ritual0": lambda: ground_ritual(91),
    "ritual1": lambda: ground_ritual(92),
    "soul0": lambda: ground_soul(101),
    "soul1": lambda: ground_soul(102),
    "water0": lambda: ground_water(111),
    "water1": lambda: ground_water(112),
    "water2": lambda: ground_water(114),
    "shallow0": lambda: ground_water(113, shallow=True),
    "shallow1": lambda: ground_water(115, shallow=True),
    "shallow2": lambda: ground_water(116, shallow=True),
    "shallow3": lambda: ground_water(117, shallow=True),
    "cliff_top0": lambda: ground_cliff_top(121),
    "cliff_top1": lambda: ground_cliff_top(122),
    "cliff_top2": lambda: ground_cliff_top(123),
    "cliff_top3": lambda: ground_cliff_top(124),
    "bog0": lambda: ground_bog(131),
    "bog1": lambda: ground_bog(132),
    "bog2": lambda: ground_bog(133),
    "bog3": lambda: ground_bog(134),
}

# codes used by the authored layer grids; the first entry is the default variant
GROUND_CODES = {
    ",": ["grass0", "grass1", "grass2", "grass3", "grass4", "grass5"],
    ";": ["moor0", "moor1", "moor2", "moor3"],
    "d": ["dirt0", "dirt1", "dirt2", "dirt3", "dirt4"],
    "g": ["gravel0", "gravel1", "gravel2", "gravel3", "gravel4", "gravel5"],
    "r": ["rock0", "rock1", "rock2", "rock3"],
    "a": ["ash0", "ash1"],
    "m": ["mud0", "mud1"],
    "f": ["floor0", "floor1", "floor2", "floor3"],
    "v": ["ritual0", "ritual1"],
    "y": ["soul0", "soul1"],
    "~": ["water0", "water1", "water2"],
    "-": ["shallow0", "shallow1", "shallow2", "shallow3"],
    "c": ["cliff_top0", "cliff_top1", "cliff_top2", "cliff_top3"],
    "b": ["bog0", "bog1", "bog2", "bog3"],
}

DETAIL_BASE = {
    "=": ("road_dirt", lambda: detail_road(201)),
    "+": ("road_stone", lambda: detail_road(202, stone=True)),
    ":": ("path", lambda: detail_path(203)),
    "*": ("crack", lambda: detail_crack(204)),
    "`": ("tuft", lambda: detail_tuft(205)),
    "o": ("pebbles", lambda: detail_pebbles(206)),
    "x": ("bloodstain", lambda: detail_blood(207)),
    "z": ("ashdrift", lambda: detail_ash(208)),
    "p": ("pool", lambda: detail_pool(210)),
    "^": ("soulspark", lambda: detail_soulspark(209)),
}

## Overlays that need several frames because a single frame repeats visibly when
## scattered. `pool` covers hundreds of fen cells.
DETAIL_VARIANTS = {"p": 5}

DETAIL_MASKED = {
    "/": "bank",
    "|": "conduit",
    "M": "moss",
    # Inverted mask: bits mark the sides that are NOT paving. See `detail_kerb`.
    "k": "kerb",
}

def solid_blocker(mask, seed=0):
    """An invisible collider: deep water is impassable, so its cells carry a
    physics-only tile while the water is drawn on the ground layer."""
    return new(T, T)


SOLID_TILES = {
    "cliff": solid_cliff,
    "wall": solid_wall,
    "canopy": solid_canopy,
    "rubble": solid_rubble,
    "blocker": solid_blocker,
}


def build_tileset():
    """Pack every tile into one atlas; return (image, frames_json)."""
    frames = {}
    cells = []  # (name, masked, image)

    for code, names in GROUND_CODES.items():
        for i, name in enumerate(names):
            cells.append((name, False, GROUND_TILES[name]()))
    frames["ground"] = {code: names for code, names in GROUND_CODES.items()}

    # detail: plain variants
    frames["detail"] = {}
    for code, (name, fn) in DETAIL_BASE.items():
        variants = DETAIL_VARIANTS.get(code)
        if variants:
            # An unmasked overlay drawn from a *single* frame is identical on every
            # cell it covers, which prints a lattice the moment it is scattered over
            # a region - the fen's pools did exactly that. Multi-variant overlays
            # get several frames and a per-cell pick, the way ground does.
            names = []
            for i in range(variants):
                cells.append(("%s%d" % (name, i), False, detail_pool(210 + i)))
                names.append("%s%d" % (name, i))
            frames["detail"][code] = {"frame": name, "masked": False, "variant_names": names}
        else:
            cells.append((name, False, fn()))
            frames["detail"][code] = {"frame": name, "masked": False}

    # detail: edge-masked families (16 orientation variants each)
    for code, name in DETAIL_MASKED.items():
        for mask in range(16):
            if name == "bank":
                img = detail_bank(mask)
            elif name == "conduit":
                img = detail_conduit(mask)
            elif name == "kerb":
                img = detail_kerb(mask)
            else:
                img = detail_moss(mask)
            cells.append(("%s#%d" % (name, mask), True, img))
        frames["detail"][code] = {"frame": name, "masked": True}

    for code, name in {"=": "road_dirt", "+": "road_stone", ":": "path"}.items():
        base = DETAIL_BASE[code][1]()
        for mask in range(16):
            cells.append(("%s#%d" % (name, mask), True, detail_road_edge(base, mask, fringe_colour=mix(C("dirt_dk"), C("grass"), 0.35))))
        frames["detail"][code] = {"frame": name, "masked": True}
    # remove the unmasked duplicates of the masked families
    cells = [c for c in cells if not (c[0] in ("road_dirt", "road_stone", "path") and not c[1])]

    # solids: 16 orientation variants each. The layer symbols are what the baked
    # grid stores; the family name is the art frame prefix.
    SOLID_SYMBOLS = {"#": "cliff", "W": "wall", "T": "canopy", "!": "blocker", "R": "rubble"}
    frames["solid"] = {}
    for code, fn in SOLID_TILES.items():
        for mask in range(16):
            if fn is solid_rubble:
                img = fn(300 + mask) if mask < 4 else None
                if img is None:
                    continue
            else:
                img = fn(mask, seed=400 + mask)
            cells.append(("%s#%d" % (code, mask), True, img))
        symbol = next((k for k, v in SOLID_SYMBOLS.items() if v == code), code)
        frames["solid"][symbol] = {"frame": code, "masked": True,
                                   "variants": 16 if fn is not solid_rubble else 4}

    # pack
    columns = 32
    rows = (len(cells) + columns - 1) // columns
    sheet = new(columns * T, rows * T)
    index = {}
    for i, (name, masked, img) in enumerate(cells):
        cx = (i % columns) * T
        cy = (i // columns) * T
        sheet.alpha_composite(img, (cx, cy))
        index[name] = [cx, cy, T, T]

    return sheet, {"tile_size": T, "columns": columns, "rows": rows, "index": index, "codes": frames}


def build_light_texture(size=256):
    """Radial warm light used by campfires, braziers and the beacon."""
    img = new(size, size)
    cx = cy = size / 2.0
    for y in range(size):
        for x in range(size):
            d = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / (size / 2.0)
            if d >= 1.0:
                continue
            a = int(255 * (1.0 - d) ** 2)
            px(img, x, y, (255, 226, 172, a))
    return img


def main():
    os.makedirs(ART_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    sheet, meta = build_tileset()
    sheet.save(os.path.join(ART_DIR, "overworld_tiles.png"))
    with open(os.path.join(DATA_DIR, "overworld_tiles.json"), "w") as f:
        json.dump(meta, f, indent=1, sort_keys=True)
    light = build_light_texture()
    light.save(os.path.join(ART_DIR, "light_radial.png"))
    print("tiles: %d frames, sheet %dx%d" % (len(meta["index"]), sheet.width, sheet.height))
    # Hand-painted overrides are applied last, on top of the freshly generated
    # sheet, so regeneration can never lose manual work. See tools/overworld/overrides.py.
    try:
        import overrides as _overrides
        _overrides.compose("tiles")
    except Exception as error:  # pragma: no cover - the generator must not die over art
        print("override pass skipped: %s" % error)


if __name__ == "__main__":
    main()
