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
# Six explicit value bands, darkest to lightest. The bands are the entire
# material system: as long as rock < recess < wall face < floor < trim < lit
# stone, a room reads as a building carved into a dark mass no matter what the
# lights do. The previous pass had floor and wall in the same band, which is why
# the rooms still flattened out under a torch.
#
#   rock      ~30   unexcavated mass, must lose against everything
#   recess    ~18   joints, wall feet, anything the light cannot reach
#   floor     ~76   walkable stone: mid, so props and light pools read on it
#   wall      ~100  structural wall faces, one step above the floor
#   trim      ~150  mouldings, cornices, pilasters
#   lit stone ~200  wall top planes and focal architecture: the brightest stone
ROCK_D = (26, 24, 30)
ROCK_M = (34, 32, 39)
RECESS = (16, 14, 18)

BASALT_D = (42, 40, 43)
BASALT_M = (76, 72, 70)     # flagstone body
BASALT_L = (92, 87, 83)     # lit flag edge, dressed paving
BASALT_HI = (116, 110, 103)
GROUT = (36, 33, 36)

WARM_D = (58, 54, 51)       # wall field in shadow
WARM_M = (100, 94, 86)      # structural wall face
WARM_L = (148, 140, 124)    # mouldings, pilaster shafts, carved bands
WARM_HI = (186, 176, 156)   # cornice
CAP = (202, 190, 168)       # lit top plane of a wall mass

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
    """Unexcavated rock: the mass every room is cut out of.

    Dark, but not black: it has to read as stone strata at gameplay scale or the
    area around a lit room turns into a hole in the picture. Broken courses and
    a few damp seams give it scale without competing with the architecture.
    """
    rng = random.Random(seed)
    img = new(T, T)
    base = ROCK_M if seed % 2 else ROCK_D
    rect(img, 0, 0, T, T, base)
    for row in range(0, T, 6):
        offset = (row // 6) % 2 * 5
        hline(img, 0, row, T, shade(base, 0.72))
        hline(img, 0, row + 1, T, shade(base, 0.90))
        for x in range(-offset, T, 11):
            vline(img, x % T, row, 6, shade(base, 0.74))
    for _ in range(26):
        px(img, rng.randint(0, 15), rng.randint(0, 15), shade(base, rng.choice([1.10, 1.20, 0.86, 0.92])))
    # a couple of damp seams, the only cool note down here
    for _ in range(2):
        x = rng.randint(2, 13)
        y = rng.randint(1, 6)
        for step in range(rng.randint(4, 9)):
            px(img, x, (y + step) % T, (38, 40, 46, 220))
            x += rng.choice([-1, 0, 1])
    return img


def floor_flag(seed: int, quad: int, base=BASALT_M, tone: float = 1.0) -> Image.Image:
    """One quadrant of a 32 px flagstone.

    The runtime lays four quadrants out as a 2x2 block, so the paving reads as
    large flags with a joint every 32 px instead of a 16 px grid. quad: 0=TL,
    1=TR, 2=BL, 3=BR — the joint is drawn only on the outer edges of the block.
    """
    rng = random.Random(seed)
    img = new(T, T)
    body = shade(base, tone)
    rect(img, 0, 0, T, T, body)
    joint = shade(body, 0.70)
    lip = shade(body, 1.07)
    if quad in (0, 1):
        hline(img, 0, 0, T, joint)
        hline(img, 0, 1, T, lip)
    if quad in (0, 2):
        vline(img, 0, 0, T, joint)
        vline(img, 1, 0, T, lip)
    if quad in (2, 3):
        hline(img, 0, T - 1, T, shade(body, 0.92))
    if quad in (1, 3):
        vline(img, T - 1, 0, T, shade(body, 0.94))
    # stone grain: identical in all four quadrants so the flag reads as one stone
    for _ in range(18):
        px(img, rng.randint(0, 7), rng.randint(0, 7), shade(body, rng.choice([0.97, 1.03])))
    for _ in range(10):
        px(img, rng.randint(8, 15), rng.randint(8, 15), shade(body, rng.choice([0.96, 1.04])))
    return img


def floor_slab(seed: int, tone: float = 1.0, cracks: int = 0,
               base=BASALT_M) -> Image.Image:
    """A worn single flag with cracks, used for the damaged variants."""
    rng = random.Random(seed)
    img = floor_flag(seed, 3, base=base, tone=tone)
    for _ in range(cracks):
        x, y = rng.randint(3, 12), rng.randint(2, 5)
        for _step in range(rng.randint(5, 9)):
            px(img, x, y, shade(base, 0.76))
            x += rng.choice([-1, 0, 0, 1])
            y += 1
            if y > 14:
                break
    return img


def floor_aisle(seed: int, variant: str = "h") -> Image.Image:
    """Processional paving: the same stone, dressed finer and cut to a band.

    The band has to read as a built edge, not as a painted stripe. An earlier
    version studded the edge with brass every eight pixels and drew two full
    width lines, which tiled into something that looked like a ladder lying on
    the floor. This version is just finer, paler stone with one recessed shadow
    line on each edge and a single brass witness mark where the courses meet.
    """
    rng = random.Random(seed)
    body = shade(BASALT_L, rng.choice([0.99, 1.02]))
    img = new(T, T)
    rect(img, 0, 0, T, T, body)
    horizontal = variant in ("h", "end")
    if horizontal:
        hline(img, 0, 0, T, shade(body, 0.86))
        hline(img, 0, 1, T, shade(body, 1.05))
        hline(img, 0, 15, T, shade(body, 0.88))
    else:
        vline(img, 0, 0, T, shade(body, 0.86))
        vline(img, 1, 0, T, shade(body, 1.05))
        vline(img, 15, 0, T, shade(body, 0.88))
    for _ in range(12):
        px(img, rng.randint(2, 13), rng.randint(2, 13), shade(body, rng.choice([0.97, 1.04])))
    px(img, 7, 7, BRASS_D)
    px(img, 8, 8, BRASS_D)
    return img


def floor_channel(kind: str) -> Image.Image:
    """A blood runnel: a narrow recessed gutter cut through the paving.

    Narrow on purpose. A wide painted band reads as decoration; a 4 px recess
    with a dark rim, oxblood in the bottom and a wet highlight reads as a drain
    that was built into the floor.
    """
    rng = random.Random(0x51 + ord(kind[0]))
    palette = Image
    img = floor_slab(0x51 + ord(kind[0]), tone=0.97)
    delivered = mix(OX_D, OX_M, 0.6)
    if kind in ("h", "cross", "end"):
        rect(img, 0, 6, T, 5, shade(BASALT_M, 0.62))
        rect(img, 0, 7, T, 3, delivered)
        hline(img, 0, 7, T, mix(OX_M, OX_L, 0.45))
        hline(img, 0, 10, T, shade(BASALT_M, 0.80))
        hline(img, 0, 6, T, shade(BASALT_M, 0.52))
        for x in range(rng.randint(0, 3), T, 6):
            px(img, x, 8, mix(OX_M, OX_D, 0.5))
    if kind in ("v", "cross"):
        rect(img, 6, 0, 5, T, shade(BASALT_M, 0.62))
        rect(img, 7, 0, 3, T, delivered)
        vline(img, 7, 0, T, mix(OX_M, OX_L, 0.45))
        vline(img, 10, 0, T, shade(BASALT_M, 0.80))
        vline(img, 6, 0, T, shade(BASALT_M, 0.52))
    if kind == "end":
        rect(img, 11, 5, 4, 7, shade(BASALT_M, 0.66))
        vline(img, 14, 5, 7, shade(BASALT_M, 0.88))
    return img


def floor_grate(seed: int) -> Image.Image:
    img = floor_slab(seed, tone=0.9)
    rect(img, 2, 2, 12, 12, shade(BASALT_M, 0.42))
    for x in range(3, 13, 2):
        vline(img, x, 3, 10, IRON_M)
    hline(img, 2, 2, 12, IRON_L)
    hline(img, 2, 13, 12, IRON_D)
    return img


def floor_stain(seed: int, *, big: bool) -> Image.Image:
    """Dried blood: an irregular, alpha-edged pool, never a coloured tile.

    Drawn on transparency so the paving keeps showing through. The rejected
    version painted opaque red squares, which read as red carpets dropped on the
    floor rather than as something spilled.
    """
    rng = random.Random(seed)
    img = new(T, T)
    cx, cy = T / 2 + rng.uniform(-2, 2), T / 2 + rng.uniform(-1, 2)
    rx = rng.uniform(5.0, 7.0) if big else rng.uniform(3.2, 4.6)
    ry = rx * rng.uniform(0.55, 0.8)
    for layer, (spread, alpha) in enumerate(((1.0, 150), (0.72, 90))):
        for yy in range(T):
            for xx in range(T):
                dx = (xx - cx) / (rx * spread)
                dy = (yy - cy) / (ry * spread)
                if dx * dx + dy * dy <= 1.0:
                    tone = mix(OX_D, OX_M, rng.random() * 0.6)
                    px(img, xx, yy, tone + (alpha,))
    for _ in range(rng.randint(2, 5)):
        px(img, rng.randint(1, 14), rng.randint(1, 14), OX_D + (170,))
    return img


# ---------------------------------------------------------------------------
# Wall stack — five courses so a wall has vertical stratification
# ---------------------------------------------------------------------------
def shadow_edge(seed: int = 0) -> Image.Image:
    """Ambient occlusion where a wall meets the floor.

    A 16 px strip that is darkest at its top row and fades to nothing by the
    eighth. Laid along the foot of every wall face it is the cheapest, strongest
    depth cue in a top down room: without it the wall and the floor are two flat
    planes meeting on a line.
    """
    img = new(T, T)
    for y in range(9):
        alpha = int(126 * (1.0 - y / 9.0) ** 1.5)
        if alpha <= 0:
            continue
        for x in range(T):
            px(img, x, y, (8, 7, 10, alpha))
    return img


def wall_plinth(seed: int) -> Image.Image:
    """Bottom course: the dark projecting socle the wall stands on.

    Its job is to put a hard value step between the lit floor and the wall, so
    the wall reads as rising out of the ground instead of meeting it.
    """
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(WARM_D, 0.72))
    course_band(img, 0, 0, T, T, shade(WARM_D, 0.82), rows=1, seed=seed)
    # the projecting lip catches light; the shadow under it belongs to the floor
    hline(img, 0, 0, T, shade(WARM_L, 0.92))
    hline(img, 0, 1, T, shade(WARM_M, 0.86))
    hline(img, 0, 15, T, shade(WARM_D, 0.5))
    return img


def wall_field(seed: int) -> Image.Image:
    """The main wall face: coursed ashlar, 16x8 blocks, thin joints."""
    img = new(T, T)
    rng = random.Random(seed)
    rect(img, 0, 0, T, T, shade(WARM_D, 0.9))
    for row in range(2):
        y = row * 8
        offset = 0 if (row + seed) % 2 == 0 else 8
        for block_x in (-offset, -offset + 16):
            body = shade(WARM_M, rng.choice([0.96, 1.0, 1.03]))
            rect(img, block_x, y, 15, 7, body)
            hline(img, block_x, y, 15, shade(body, 1.08))
            hline(img, block_x, y + 6, 15, shade(body, 0.82))
            vline(img, block_x + 15, y, 7, shade(body, 0.74))
            if rng.random() < 0.5:
                px(img, block_x + rng.randint(2, 12), y + rng.randint(1, 5), shade(body, 0.9))
    return img


def wall_dado(seed: int) -> Image.Image:
    """Carved band above the socle: a sunken panel with the cult's chevron."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(WARM_M, 0.92))
    rect(img, 1, 3, 14, 10, shade(WARM_D, 0.80))
    frame(img, 1, 3, 14, 10, shade(WARM_D, 0.55))
    hline(img, 2, 4, 12, shade(WARM_L, 0.9))
    for x in range(3, 14, 3):
        px(img, x, 10, shade(WARM_L, 1.02))
        px(img, x + 1, 9, shade(WARM_L, 1.02))
        px(img, x + 1, 10, shade(WARM_D, 0.62))
        px(img, x + 2, 8, shade(WARM_M, 0.86))
    return img


def wall_cornice(seed: int) -> Image.Image:
    """Projecting top course: a lit band with a hard shadow beneath it.

    This bright band is what tells the eye where the wall ends and the dark
    interior of the next room begins. Without it a wall is just more floor.
    """
    img = new(T, T)
    rect(img, 0, 0, T, T, GROUT)
    rect(img, 0, 1, T, 8, WARM_HI)
    hline(img, 0, 1, T, CAP)
    hline(img, 0, 2, T, shade(CAP, 1.02))
    for x in range(0, T, 4):
        px(img, x, 5, shade(WARM_L, 1.04))
        px(img, x + 2, 7, shade(WARM_L, 0.98))
    rect(img, 0, 9, T, 3, shade(WARM_D, 0.62))
    hline(img, 0, 9, T, shade(WARM_L, 0.9))
    hline(img, 0, 11, T, GROUT)
    hline(img, 0, 12, T, GROUT)
    return img


def wall_pier(seed: int) -> Image.Image:
    """A pilaster: a lit shaft that breaks a long wall into bays."""
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(WARM_D, 0.9))
    rect(img, 3, 0, 10, T, WARM_L)
    vline(img, 3, 0, T, WARM_HI)
    vline(img, 4, 0, T, shade(WARM_L, 1.06))
    vline(img, 11, 0, T, shade(WARM_M, 0.92))
    vline(img, 12, 0, T, shade(WARM_D, 0.82))
    hline(img, 3, 7, 10, shade(WARM_D, 0.78))
    hline(img, 3, 8, 10, shade(WARM_L, 1.04))
    return img


def wall_cap(seed: int) -> Image.Image:
    """The top plane of a wall mass: the brightest stone in the room."""
    img = new(T, T)
    rng = random.Random(seed)
    rect(img, 0, 0, T, T, CAP)
    for jy in range(0, T, 8):
        hline(img, 0, jy, T, shade(CAP, 0.86))
        offset = 4 if (jy // 8) % 2 else 0
        for jx in range(0, T, 8):
            vline(img, (jx + offset) % T, jy, 8, shade(CAP, 0.88))
    for _ in range(10):
        px(img, rng.randint(1, 14), rng.randint(1, 14), shade(CAP, rng.choice([0.94, 1.03])))
    # edge of the mass: a lit rim at the top, shadow where it falls away
    hline(img, 0, 0, T, shade(CAP, 1.04))
    hline(img, 0, 15, T, shade(WARM_D, 0.7))
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


def finish_prop(img: Image.Image, *, shadow: bool = True) -> Image.Image:
    """Give a prop the two things that make it sit in the world.

    A one pixel dark outline, so a pale stone prop separates from a pale stone
    floor at gameplay scale, and a soft contact shadow at its foot, so it reads
    as standing on the ground rather than pasted onto it. Both are baked here
    once, for every prop, instead of being special-cased per prop.
    """
    if shadow:
        floor_shadow(img, img.width / 2, img.height - 2,
                     img.width * 0.34, max(3.0, img.height * 0.07), 120)
    px_data = img.load()
    w, h = img.size
    outline = (16, 14, 17, 220)
    edges = []
    for y in range(h):
        for x in range(w):
            if px_data[x, y][3] > 24:
                continue
            for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px_data[nx, ny][3] > 190:
                    edges.append((x, y))
                    break
    for (x, y) in edges:
        px_data[x, y] = outline
    return img



def _hash01(*values: int) -> float:
    """Deterministic pseudo-random in [0,1) from integers: no RNG state, so the
    same block is always the same stone across a rebuild."""
    h = 2166136261
    for v in values:
        h = (h ^ (int(v) & 0xFFFFFFFF)) * 16777619 & 0xFFFFFFFF
    # FNV alone leaves almost all of its entropy in the low bits, so two inputs
    # that differ only in the last value (an x, a y) come back nearly equal and
    # the "random" speckle lines up in columns. The final avalanche fixes that.
    h ^= h >> 15
    h = (h * 2246822519) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 3266489917) & 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFF) / 65536.0


def ring_masonry(img, cx: float, cy: float, rx: float, ry: float,
                 d0: float, d1: float, base, seed: int, *, blocks: int = 26,
                 damage=(), joint: float = 0.9, lit: bool = True) -> None:
    """Concentric ring of individual cut stones, the way a basin rim is built.

    Every block is a separate stone with its own tone, separated by a radial
    joint, so the rim reads as masonry instead of as a smooth ellipse. The outer
    edge catches the light and the inner edge falls into shade, which is what
    gives the ring thickness. `damage` lists block indices to knock out.
    """
    if d1 <= d0:
        return
    span = math.tau / blocks
    for y in range(int(cy - ry * d1) - 1, int(cy + ry * d1) + 2):
        for x in range(int(cx - rx * d1) - 1, int(cx + rx * d1) + 2):
            dx = (x - cx) / max(0.001, rx)
            dy = (y - cy) / max(0.001, ry)
            d = math.hypot(dx, dy)
            if d < d0 or d > d1:
                continue
            a = math.atan2(dy, dx)
            u = (a + math.pi) / math.tau
            index = int(u * blocks) % blocks
            if index in damage:
                continue
            tone = 0.93 + 0.16 * _hash01(seed, index, int(d * 40))
            col = shade(base, tone)
            # radial joints between cut stones
            frac = (u * blocks) % 1.0
            edge_px = min(frac, 1.0 - frac) * span * rx * max(0.25, d)
            if edge_px < joint:
                col = shade(base, 0.58)
            else:
                # concentric course lines
                if lit:
                    if dy < -0.45 and d > d1 - (d1 - d0) * 0.30:
                        col = shade(col, 1.10)
                    elif dy > 0.35 and d < d0 + (d1 - d0) * 0.30:
                        col = shade(col, 0.84)
            px(img, x, y, col)


def _basin_steps(img, cx: float, base_y: int, w: int, base, seed: int) -> None:
    """Three descending steps cut into the south face of a basin rim."""
    for i, (sw, sy, depth) in enumerate(((84, base_y, 10), (70, base_y + 8, 9), (56, base_y + 16, 8))):
        x0 = int(cx - sw / 2)
        course_band(img, x0, sy, sw, depth, base, rows=2, seed=seed + i)
        hline(img, x0, sy, sw, CAP)
        hline(img, x0, sy + 1, sw, shade(base, 1.10))
        # wear in the middle of the tread
        for x in range(x0 + 6, x0 + sw - 6, 9):
            px(img, x, sy + 3, shade(base, 0.74))
            px(img, x + 1, sy + 4, shade(base, 0.80))
        hline(img, x0, sy + depth - 1, sw, RECESS)


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


def prop_crucible(w: int = 216, h: int = 168, scale: float = 1.0) -> Image.Image:
    """The Blood Court basin: a monumental sunken ritual basin in cut stone.

    Built the way the real thing would be: an apron of paving the basin is set
    into, a coping course, a ring of jointed rim blocks with iron cramps, then the
    bowl inside — coursed masonry walls going down, with the blood lying in it.
    The near (south) wall is drawn *over* the blood, so the blood reads as a
    surface below the rim rather than as a red disc dropped on top of one. Damage
    on the north east rim (blocks knocked out, a snapped cramp, spill down the
    face, rubble at the foot) is the story of the thing that got out.
    """
    w, h = int(w * scale), int(h * scale)
    img = new(w, h)
    cx = w / 2
    cy = 52.0 * scale
    rng = random.Random(0x51AC)
    # Every ring is measured in *one* normalised radial space (RX, RY) so the
    # bands tile edge to edge. Measuring each ring against its own radii leaves
    # unpainted slivers between them, which is exactly what a previous version did.
    RX, RY = 106.0 * scale, 64.0 * scale
    open_rx, open_ry = RX * 0.60, RY * 0.60

    # --- the apron and the coping: the basin is set into built paving ------
    ring_masonry(img, cx, cy, RX, RY, 0.91, 1.0, shade(BASALT_L, 0.94), 0x11, blocks=38)
    ring_masonry(img, cx, cy, RX, RY, 0.82, 0.91, WARM_L, 0x22, blocks=32)
    # --- the rim proper: big cut blocks, lit on the north edge ------------
    ring_masonry(img, cx, cy, RX, RY, 0.68, 0.82, WARM_M, 0x33, blocks=20, damage=(4, 5))
    # --- the lip: a hard shadow under the overhang ------------------------
    ring_masonry(img, cx, cy, RX, RY, 0.60, 0.68, WARM_D, 0x44, blocks=20, lit=False)

    # --- the bowl: coursed masonry all the way down -----------------------
    def bowl_tone(depth: int, u: float, band_y: int):
        course = depth // 8
        tone = 0.78 + 0.16 * _hash01(0x55, int(u * 9), course)
        tone *= 1.0 - 0.30 * min(1.0, depth / 60.0)
        col = shade(WARM_D, tone)
        if abs((u * 9) % 1.0) < 0.05:
            col = shade(WARM_D, 0.50)
        if band_y % 8 == 0:
            col = shade(col, 0.55)
        return col

    def opening_half(y: float) -> float:
        dy = (y - cy) / open_ry
        if abs(dy) >= 1.0:
            return 0.0
        return open_rx * math.sqrt(max(0.0, 1.0 - dy * dy))

    for y in range(int(cy - open_ry) + 1, int(cy + open_ry)):
        half = opening_half(y)
        if half <= 0:
            continue
        depth = int(abs(y - cy) * 0.9)
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - cx) / max(1.0, half)
            px(img, x, y, bowl_tone(depth, u, y))

    # --- the blood: a surface below the rim -------------------------------
    # Clipped to the opening row by row, so it can never spill onto the bowl wall
    # or the rim. It sits low in the bowl, which leaves lit masonry in front of
    # it: that band of stone is what reads as depth.
    bcy = cy + 18
    brx, bry = open_rx * 0.74, open_ry * 0.60
    for y in range(int(bcy - bry) + 1, int(bcy + bry)):
        half_blood = brx * math.sqrt(max(0.0, 1.0 - ((y - bcy) / bry) ** 2))
        half = min(half_blood, opening_half(y) - 2)
        if half <= 1:
            continue
        for x in range(int(cx - half), int(cx + half) + 1):
            u = abs((x - cx) / max(1.0, brx))
            v = abs((y - bcy) / max(1.0, bry))
            r = math.hypot(u, v)
            if r > 0.94:
                col = OX_D
            elif r > 0.74:
                col = OX_M
            elif r > 0.52:
                col = OX_L
            elif r > 0.28:
                col = OX_HI
            else:
                col = mix(OX_HI, FIRE_D, 0.30)
            if _hash01(0x77, x, y) < 0.05:
                col = mix(col, FIRE_M, 0.35)
            px(img, x, y, col)
    # skim and clots on the surface
    for _ in range(16):
        a = rng.uniform(0, math.tau)
        bx = int(cx + math.cos(a) * rng.uniform(6, brx * 0.8))
        by = int(bcy + math.sin(a) * rng.uniform(3, bry * 0.7))
        hline(img, bx - 4, by, 9, mix(OX_HI, BONE, 0.24))
    # contact shadow where the blood meets the near wall
    for y in range(int(bcy + bry * 0.55), int(bcy + bry) + 2):
        half_blood = brx * math.sqrt(max(0.0, 1.0 - ((y - bcy) / bry) ** 2))
        for x in range(int(cx - half_blood) - 4, int(cx + half_blood) + 5):
            if y >= bcy + bry - 5:
                px(img, x, y, shade(OX_D, 0.55))

    # --- iron cramps on the rim joints ------------------------------------
    for i in range(10):
        a = math.radians(18 + i * 36)
        if i in (2, 3):
            continue
        x = int(cx + math.cos(a) * RX * 0.75)
        y = int(cy + math.sin(a) * RY * 0.75)
        rect(img, x - 3, y - 2, 7, 4, IRON_M)
        hline(img, x - 3, y - 2, 7, IRON_L)
        hline(img, x - 3, y + 1, 7, IRON_D)

    # --- damage: knocked-out rim blocks on the north east side ------------
    dmg_x = int(cx + RX * 0.60)
    dmg_y = int(cy - RY * 0.52)
    rect(img, dmg_x - 7, dmg_y - 3, 14, 7, shade(WARM_D, 0.46))
    for k in range(12):
        px(img, dmg_x - 6 + k, dmg_y - 3 + (k % 2), shade(IRON_D, 1.25))
    for k in range(20):
        px(img, dmg_x + 5 + (k % 3), dmg_y + 5 + k, OX_D + (140 + k * 5,))
    for _ in range(18):
        rx_ = dmg_x + rng.randint(-16, 20)
        ry_ = dmg_y + rng.randint(10, 34)
        rect(img, rx_, ry_, rng.randint(3, 6), rng.randint(2, 4), shade(WARM_M, 0.88))
        hline(img, rx_, ry_, 4, shade(WARM_M, 1.06))

    # --- steps cut into the south face ------------------------------------
    # steps standing on the floor at the south face, leading up to the coping.
    # Inside the bowl they crossed the blood and read as scratches.
    _basin_steps(img, cx, int(cy + RY) - 6, 0, WARM_M, 0x66)
    floor_shadow(img, cx, h - 1, 88, 7, 140)
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
    # Iron reads as iron because of its holes, not its outline. The old chain was a
    # single column of pixels that alternated shade - at 1:1 that is a dotted seam,
    # not a chain, and it is the same failure as the chapter's hairline motifs: a
    # real object described by one line. These links are four pixels of metal each,
    # alternating vertical and edge-on, with a lit top-left and a dark bottom-right,
    # so the chain has thickness and a twist at native scale.
    step = 5
    for index, y in enumerate(range(1, length - 8, step)):
        if index % 2 == 0:
            # a link seen face-on: a 5x4 ring with its hole in the middle
            hline(img, 5, y, 6, IRON_L)
            hline(img, 5, y + 3, 6, IRON_M)
            px(img, 5, y + 1, IRON_L)
            px(img, 10, y + 1, IRON_HI)
            px(img, 6, y + 2, IRON_M)
            px(img, 9, y + 2, IRON_M)
            px(img, 6, y + 1, (0, 0, 0, 0))
            px(img, 7, y + 1, (0, 0, 0, 0))
            px(img, 7, y + 2, (0, 0, 0, 0))
            px(img, 8, y + 2, (0, 0, 0, 0))
            px(img, 8, y + 1, IRON_L)
            px(img, 9, y + 1, IRON_M)
        else:
            # the next link turned ninety degrees: only its edge is visible
            hline(img, 6, y + 1, 4, IRON_L)
            hline(img, 6, y + 2, 4, IRON_M)
            px(img, 6, y + 1, IRON_HI)
            px(img, 9, y + 2, IRON_D)
    if hook:
        y = length - 8
        for i in range(8):
            px(img, 7 + i // 2, y + i, IRON_L)
            px(img, 6 - i // 2, y + i, IRON_M)
            if i % 2 == 0:
                px(img, 7 + i // 2, y + i - 1, IRON_HI)
        px(img, 7, length - 1, IRON_HI)
        px(img, 8, length - 1, IRON_D)
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
    w, h = 30, 62
    img = new(w, h)
    rng = random.Random(seed)
    # rod and finials
    block(img, 1, 0, w - 2, 4, BRASS_M)
    px(img, 0, 1, BRASS_L)
    px(img, w - 1, 1, BRASS_L)
    # cloth: two panels falling with a slight sway, ragged bottom edge
    for x in range(3, w - 3):
        sway = int(round(1.2 * math.sin((x - 3) / 6.0)))
        bottom = h - 5 - int(2.5 * math.sin(x * 0.8)) - (4 if rng.random() < 0.22 else 0)
        u = (x - 4) / max(1.0, (w - 8) - 1)
        body = mix(shade(OX_L, 1.02), OX_D, u * 0.7)
        for y in range(5, bottom):
            px(img, x + sway // 2, y, body)
        # central fold highlight and side shadow
        px(img, x + sway // 2, 5, OX_HI)
    # fold shading: three vertical bands
    for x in (9, 15, 21):
        for y in range(6, h - 12):
            px(img, x, y, shade(OX_D, 0.86))
            px(img, x + 1, y, shade(OX_L, 1.06))
    # sigil
    cx = w // 2
    pts = [(cx, 16), (cx - 7, 32), (cx + 7, 32)]
    for i in range(3):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % 3]
        for t in range(30):
            tt = t / 30
            px(img, int(x0 + (x1 - x0) * tt), int(y0 + (y1 - y0) * tt), BRASS_L)
            px(img, int(x0 + (x1 - x0) * tt), int(y0 + (y1 - y0) * tt) + 1, BRASS_D)
    for y in range(27, 33):
        half = int((y - 27) * 0.45)
        for x in range(cx - half, cx + half + 1):
            px(img, x, y, OX_HI)
    # grommets
    for x in (6, w - 7):
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

    An octagonal plinth of jointed masonry carrying four snapped iron uprights
    over a blood well, with the snapped-off iron lying where it fell and the
    plinth's north east corner knocked away. Built from the same ring-masonry
    vocabulary as the court basin, so the two read as the same installation at
    two scales — the complex's centrepiece and its portable altar.
    """
    w, h = 148, 136
    img = new(w, h)
    cx = w / 2
    cy = h * 0.46
    rng = random.Random(seed)
    RX, RY = 70.0, 42.0

    # --- plinth: apron, then two stepped courses of jointed stone ---------
    ring_masonry(img, cx, cy, RX, RY, 0.90, 1.0, shade(BASALT_L, 0.94), seed + 1, blocks=24)
    ring_masonry(img, cx, cy, RX, RY, 0.74, 0.90, WARM_L, seed + 2, blocks=20)
    ring_masonry(img, cx, cy, RX, RY, 0.56, 0.74, WARM_M, seed + 3, blocks=18,
                 damage=(1, 2))
    ring_masonry(img, cx, cy, RX, RY, 0.44, 0.56, WARM_D, seed + 4, blocks=18, lit=False)

    # --- the well: coursed masonry, then blood ----------------------------
    open_rx, open_ry = RX * 0.44, RY * 0.44
    for y in range(int(cy - open_ry), int(cy + open_ry) + 1):
        dy = (y - cy) / open_ry
        half = open_rx * math.sqrt(max(0.0, 1.0 - min(1.0, dy * dy)))
        depth = int(abs(y - cy))
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - cx) / max(1.0, half)
            tone = 0.62 + 0.14 * _hash01(seed, int(u * 8), depth // 6)
            tone *= 1.0 - 0.22 * (depth / max(1.0, open_ry))
            col = shade(WARM_D, tone)
            if abs((u * 8) % 1.0) < 0.06 or depth % 6 == 0:
                col = shade(WARM_D, 0.44)
            px(img, x, y, col)
    bcy = cy + 5
    brx, bry = open_rx * 0.86, open_ry * 0.80
    for y in range(int(bcy - bry) + 1, int(bcy + bry)):
        half = brx * math.sqrt(max(0.0, 1.0 - ((y - bcy) / bry) ** 2))
        half = min(half, open_rx * math.sqrt(max(0.0, 1.0 - min(1.0, ((y - cy) / open_ry) ** 2))) - 1)
        for x in range(int(cx - half), int(cx + half) + 1):
            r = math.hypot((x - cx) / max(1.0, brx), (y - bcy) / max(1.0, bry))
            col = OX_D if r > 0.9 else OX_M if r > 0.66 else OX_L if r > 0.4 else OX_HI
            if _hash01(seed + 9, x, y) < 0.06:
                col = mix(col, FIRE_M, 0.4)
            px(img, x, y, col)

    # --- four iron uprights, two of them snapped -------------------------
    for i, angle in enumerate((205, 335, 262, 285)):
        a = math.radians(angle)
        bx = int(cx + math.cos(a) * RX * 0.66)
        by = int(cy + math.sin(a) * RY * 0.66)
        top = by - (44 if i < 2 else 24)
        for y in range(top, by + 1):
            for dx in (-2, -1, 0, 1, 2):
                if dx == -2:
                    col = IRON_HI
                elif dx == -1:
                    col = IRON_L
                elif dx == 0:
                    col = IRON_M
                elif dx == 1:
                    col = IRON_D
                else:
                    col = shade(IRON_D, 0.7)
                px(img, bx + dx, y, col)
            if y % 14 == 0:
                px(img, bx - 2, y, IRON_HI)
                px(img, bx + 1, y, IRON_HI)
        # foot plate
        rect(img, bx - 5, by - 1, 11, 3, IRON_M)
        hline(img, bx - 5, by - 1, 11, IRON_L)
        hline(img, bx - 5, by + 1, 11, IRON_D)
        if i < 2:
            # collar and chain stub at the top of the intact ones
            rect(img, bx - 2, top, 5, 3, IRON_M)
            hline(img, bx - 2, top, 5, IRON_HI)
            for k in range(4):
                px(img, bx, top - 2 - k, IRON_M if k % 2 else IRON_L)
        else:
            # snapped: a jagged bright fracture, and the broken length on the floor
            px(img, bx, top, IRON_HI)
            px(img, bx + 1, top + 1, IRON_HI)
            # the snapped length, lying on the plinth at an angle
            for k in range(26):
                for d in (0, 1):
                    px(img, bx + 12 + k, by + 14 - k // 3 + d,
                       IRON_M if (k + d) % 4 else IRON_L)

    # --- knocked-away corner: rubble and a sheared stone -----------------
    for _ in range(26):
        rx_ = int(cx + rng.uniform(20, 58))
        ry_ = int(cy + rng.uniform(-6, 30))
        rw, rh = rng.randint(3, 7), rng.randint(2, 4)
        rect(img, rx_, ry_, rw, rh, shade(WARM_M, rng.choice([0.9, 1.0, 1.08])))
        hline(img, rx_, ry_, rw, shade(WARM_L, 1.02))
    # blood trail running off the plinth to the south east
    for _ in range(60):
        px(img, int(cx + rng.uniform(6, 40)), int(cy + rng.uniform(6, 46)),
           OX_D + (rng.randint(90, 190),))
    floor_shadow(img, cx, h - 2, 62, 6, 130)
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
KIT_GAMMA = 0.72


def apply_exposure(image, gamma: float):
    """Lift the mid-tones of a finished atlas, leaving black and white alone.

    Measured on the native mosaic this level's rooms sat at a median luminance of
    33 out of 255: the player was looking at near-black mush and the basins read
    only because they are lit. Multiplying would clip the blood and the embers,
    so the lift is a gamma curve - the stone comes up into a readable band and the
    shoulder compresses instead of blowing. The authored lights, their ordering
    and their falloff are untouched, so a lit pool still separates from a corner.
    """
    table = [min(255, int(round(255.0 * ((v / 255.0) ** gamma)))) for v in range(256)]
    bands = image.split()
    if len(bands) == 4:
        r, g, b, a = bands
        return Image.merge("RGBA", (r.point(table), g.point(table), b.point(table), a))
    return image.point(table)


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
        "floor_a": (lambda: floor_flag(1, 0), 0, 0),
        "floor_b": (lambda: floor_flag(1, 1), 1, 0),
        "floor_c": (lambda: floor_flag(1, 2), 2, 0),
        "floor_d": (lambda: floor_flag(1, 3), 3, 0),
        "floor_worn": (lambda: floor_slab(5, 0.88, cracks=1), 4, 0),
        "floor_broken": (lambda: floor_slab(6, 1.0, cracks=3), 5, 0),
        "floor_grate": (lambda: floor_grate(7), 6, 0),
        "floor_aisle_v": (lambda: floor_aisle(8, "v"), 7, 0),
        "floor_aisle_h": (lambda: floor_aisle(9, "h"), 0, 1),
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
        "shadow_edge": (lambda: shadow_edge(), 2, 3),
        "bedrock_a": (lambda: bedrock(31), 0, 3),
        "bedrock_b": (lambda: bedrock(32), 1, 3),
    }
    width, height = grid * T, 4 * T
    sheet = new(width, height)
    for name, (builder, col, row) in variants.items():
        image = builder()
        sheet.alpha_composite(image, (col * T, row * T))
        place(name, image, col, row)
    apply_exposure(sheet, KIT_GAMMA).save(os.path.join(ART, "crucible_tiles.png"))
    return frames


def build_props() -> dict:
    builders = {
        "arch_monumental": (lambda: prop_arch(112, 168, variant="narrow"), 0, 0),
        "arch_wide": (lambda: prop_arch(208, 168, variant="wide"), 22, 0),
        "arch_doorway": (lambda: prop_arch(88, 112, variant="small"), 0, 0),
        "altar": (lambda: prop_altar(31), 2, 0),
        "altar_dry": (lambda: prop_altar(32, blood=False), 3, 0),
        "crucible": (lambda: prop_crucible(), 4, 0),
        "crucible_small": (lambda: prop_crucible(216, 168, scale=0.78), 4, 0),
        "crucible_grand": (lambda: prop_crucible(216, 168, scale=1.30), 4, 0),
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
        # whole-sprite finish: outline + contact shadow, applied uniformly so no
        # prop looks pasted on the floor
        image = finish_prop(builder())
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
    apply_exposure(sheet, KIT_GAMMA).save(os.path.join(ART, "crucible_props.png"))
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
