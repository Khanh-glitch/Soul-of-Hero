#!/usr/bin/env python3
"""Level 6 — The Relay House. Kit art.

Material identity, deliberately not the Crucible's: pale limestone ashlar in a
cool green-grey, aged verdigris copper as the only metal, and cold mint soul-light
carried in open channels on the floor. Where the Crucible is a hot furnace of red
basalt and brass, this is a cold signal-house of pale stone and oxidised copper.

The kit also carries the thing this level is *about*: relay. Signal paths are
authored as copper conduit cut into the paving, joined at a large inlaid medallion
under each Soul Anchor. The conduit is drawn as floor tiles, so it can follow the
map's real rooms and lanes and never invents ground.

Run: python3 tools/level6/art_relay.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chapter1_env"))

from kitlib import (  # noqa: E402
    ROOT, T, _h01, block, courses, dither, finish, flag_quadrant, frame_box, glow, hline,
    mix, new, px, rect, rock_tile, shade, shadow_tile, vline, wall_cap_tile,
    wall_cornice_tile, wall_field_tile, wall_plinth_tile, write_kit,
)

ART = os.path.join(ROOT, "assets", "environment", "chapter1", "relay")
KIT = "relay"

# --- palette ---------------------------------------------------------------
# Cool limestone: a green-grey stone, not the warm bone of the Crypt or the red
# basalt of the Crucible. Value bands stay tight (0.62 / 0.86 / 1.00 / 1.16) so
# the kit reads as one material under one light.
STONE_DARK = (52, 58, 62)
STONE_BASE = (84, 90, 94)
STONE_LIGHT = (120, 127, 130)
STONE_PALE = (152, 158, 158)
JOINT = (40, 45, 49)
BEDROCK_DARK = (44, 50, 54)
BEDROCK_BASE = (62, 69, 74)
BEDROCK_LIGHT = (86, 94, 98)

VERD_DARK = (38, 82, 74)
VERD = (66, 132, 112)
VERD_LIGHT = (108, 186, 158)
VERD_PALE = (150, 214, 186)

COPPER_DARK = (104, 64, 38)
COPPER = (156, 102, 54)
COPPER_LIGHT = (206, 148, 88)
COPPER_PALE = (238, 196, 136)

SOUL = (168, 250, 216)
SOUL_MID = (86, 198, 166)
SOUL_DEEP = (30, 108, 92)

IRON_DARK = (40, 44, 48)
IRON = (66, 72, 76)
IRON_LIGHT = (104, 112, 116)

LINEN = (186, 182, 166)
LINEN_DARK = (150, 148, 132)


# --- helper: arcs and rays -------------------------------------------------
def arc(img, cx: float, cy: float, r: float, a0: float, a1: float, colour,
        thickness: float = 1.0) -> None:
    steps = max(8, int(abs(a1 - a0) * r))
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        for k in range(max(1, int(thickness))):
            px(img, int(cx + math.cos(a) * (r + k)), int(cy + math.sin(a) * (r + k)), colour)


def ray(img, x: float, y: float, angle: float, length: float, colour,
        thickness: float = 1.0) -> None:
    a = math.radians(angle)
    for i in range(int(length)):
        for k in range(max(1, int(thickness))):
            px(img, int(x + math.cos(a) * i + k), int(y + math.sin(a) * i), colour)


# --- tiles -----------------------------------------------------------------
def bedrock(seed: int):
    """Unexcavated rock. Has to read as stone, not as a hole in the floor.

    A hollow wall ring with rock inside it is a normal shape in these maps; if the
    rock is nearly black, the ring reads as a pit and the room loses its centre.
    """
    img = rock_tile(seed, BEDROCK_DARK, BEDROCK_BASE, BEDROCK_LIGHT)
    # strata: three broken bedding lines, always horizontal, so the mass has grain
    for i in range(3):
        y = 2 + i * 5 + int(_h01(seed, 3, i) * 3) % 3
        x0 = int(_h01(seed, 7, i) * 8)
        hline(img, x0, y, 6 + int(_h01(seed, 9, i) * 8), shade(BEDROCK_DARK, 1.18))
        hline(img, x0 + 1, y + 1, 4 + int(_h01(seed, 11, i) * 6), shade(BEDROCK_LIGHT, 0.92))
    return img


def flag(seed: int, quad: int, *, tone: float = 1.0, crack: bool = False):
    img = flag_quadrant(seed, quad, STONE_BASE, JOINT, tone=tone, crack=crack)
    # a faint verdigris bloom in the stone: this place runs on copper, and copper
    # leaves a stain.
    if seed % 7 == 0:
        dither(img, 2, 3, 12, 10, shade(STONE_BASE, 0.88), 0.10, seed=seed)
    return img


def worn(seed: int):
    img = flag(seed, 0, tone=0.88)
    for i in range(5):
        x = 2 + int((seed * 13 + i * 29) % 12)
        y = 2 + int((seed * 7 + i * 17) % 12)
        px(img, x, y, shade(STONE_BASE, 1.18))
    hline(img, 1, T - 1, T - 2, shade(STONE_BASE, 0.80))
    return img


def broken(seed: int):
    img = flag(seed, 1, tone=0.94, crack=True)
    rect(img, 9, 8, 6, 5, shade(STONE_BASE, 0.70))
    hline(img, 9, 8, 6, shade(STONE_BASE, 1.20))
    px(img, 10, 10, STONE_PALE)
    return img


def terrace(seed: int):
    """A raised terrace slab. Deliberately quiet: the risers do the talking.

    A slab with a lit edge on all four sides looks like a louvre the moment it is
    tiled across a room; only step_lip* carries an edge.
    """
    img = flag(seed, 2, tone=1.05)
    for y in range(T):
        for x in range(T):
            r = ((x * 7 + y * 13 + seed * 5) % 17) / 17.0
            if r < 0.30:
                px(img, x, y, shade(STONE_BASE, 0.98 + r * 0.18))
    # a shallow joint along the south side only, so the terrace cadence is legible
    hline(img, 0, T - 1, T, shade(STONE_DARK, 0.86))
    return img


def step_lip(seed: int):
    """The riser of a terrace step seen edge-on from above."""
    img = flag(seed, 3, tone=1.02)
    rect(img, 0, 0, T, 6, shade(STONE_BASE, 1.02))
    hline(img, 0, 0, T, STONE_PALE)
    hline(img, 0, 1, T, STONE_LIGHT)
    rect(img, 0, 6, T, 4, shade(STONE_DARK, 1.02))
    hline(img, 0, 9, T, shade(JOINT, 1.1))
    rect(img, 0, 10, T, 6, shade(STONE_BASE, 0.86))
    return img


def step_lip_v(seed: int):
    """The riser of a terrace step running north-south, for eastward climbs."""
    img = flag(seed, 2, tone=1.02)
    rect(img, 0, 0, 6, T, shade(STONE_BASE, 1.04))
    vline(img, 0, 0, T, STONE_PALE)
    vline(img, 1, 0, T, STONE_LIGHT)
    rect(img, 6, 0, 4, T, shade(STONE_DARK, 1.02))
    vline(img, 9, 0, T, shade(JOINT, 1.1))
    rect(img, 10, 0, 6, T, shade(STONE_BASE, 0.86))
    return img


def conduit(name_dir: str, seed: int):
    """A copper signal channel cut into the paving, with mint light in it.

    A channel is a *recess*, not a printed rule. The first version drew one dark
    pixel, two soul pixels and one bright pixel across a tile: at gameplay scale
    that is a hairline of four flat colours with nothing in it, and the review read
    it as unfinished line art rather than as masonry. What a cut channel actually
    has is a bed that is darker than the floor around it, a far lip that is
    copper-dark where the floor's own shadow falls on it, and a near lip that
    catches the light - so the channel has a bottom, a far side and a near side,
    and the light inside it sits in the bed rather than floating on the surface.

    The copper edges are two pixels wide because one pixel of copper on pale stone
    at 640 x 360 reads as a scratch; two reads as a lip.
    """
    img = flag(seed, 0, tone=0.98)
    bed = shade(STONE_DARK, 0.78)
    if name_dir == "h":
        # far lip (top), the bed, the near lip (bottom)
        hline(img, 0, 5, T, shade(STONE_DARK, 0.94))
        hline(img, 0, 6, T, COPPER_DARK)
        hline(img, 0, 7, T, COPPER)
        for y in (8, 9, 10):
            depth = (y - 7) / 3.0
            hline(img, 0, y, T, shade(bed, 0.86 + 0.28 * depth))
        hline(img, 0, 11, T, SOUL_DEEP)
        hline(img, 0, 12, T, SOUL_MID)
        hline(img, 0, 13, T, COPPER_LIGHT)
        hline(img, 0, 14, T, COPPER_PALE)
        # the light inside the channel, and a rivet where the channel is joined
        px(img, 4, 11, SOUL)
        px(img, 11, 12, SOUL)
        px(img, 3, 13, COPPER_PALE)
        px(img, 12, 13, COPPER_PALE)
    elif name_dir == "v":
        vline(img, 5, 0, T, shade(STONE_DARK, 0.94))
        vline(img, 6, 0, T, COPPER_DARK)
        vline(img, 7, 0, T, COPPER)
        for x in (8, 9, 10):
            depth = (x - 7) / 3.0
            vline(img, x, 0, T, shade(bed, 0.86 + 0.28 * depth))
        vline(img, 11, 0, T, SOUL_DEEP)
        vline(img, 12, 0, T, SOUL_MID)
        vline(img, 13, 0, T, COPPER_LIGHT)
        vline(img, 14, 0, T, COPPER_PALE)
        px(img, 11, 4, SOUL)
        px(img, 12, 11, SOUL)
        px(img, 13, 3, COPPER_PALE)
        px(img, 13, 12, COPPER_PALE)
    else:
        # the junction: the two channels meet and the medallion is cast over them
        rect(img, 0, 5, T, 10, shade(bed, 0.90))
        rect(img, 5, 0, 10, T, shade(bed, 0.90))
        hline(img, 0, 5, T, COPPER_DARK)
        vline(img, 5, 0, T, COPPER_DARK)
        hline(img, 0, 14, T, COPPER_PALE)
        vline(img, 14, 0, T, COPPER_PALE)
        for y in range(T):
            for x in range(T):
                d = math.hypot(x - 7.5, y - 7.5)
                if d < 4.2:
                    px(img, x, y, SOUL_DEEP if d > 2.6 else SOUL_MID)
                elif d < 5.8:
                    px(img, x, y, COPPER)
        # the medallion's own rim, so it is a casting and not a painted disc
        for y in range(T):
            for x in range(T):
                d = math.hypot(x - 7.5, y - 7.5)
                if 5.8 <= d < 6.6:
                    px(img, x, y, COPPER_LIGHT if d > 6.1 else COPPER_DARK)
    return img


def aisle(direction: str, seed: int):
    """A processional slab: two copper rails with a paler stone between them."""
    img = flag(seed, 0, tone=1.10)
    if direction == "h":
        hline(img, 0, 2, T, COPPER_DARK)
        hline(img, 0, 3, T, COPPER)
        hline(img, 0, 12, T, COPPER)
        hline(img, 0, 13, T, COPPER_DARK)
        rect(img, 0, 5, T, 6, shade(STONE_LIGHT, 1.02))
    else:
        vline(img, 2, 0, T, COPPER_DARK)
        vline(img, 3, 0, T, COPPER)
        vline(img, 12, 0, T, COPPER)
        vline(img, 13, 0, T, COPPER_DARK)
        rect(img, 5, 0, 6, T, shade(STONE_LIGHT, 1.02))
    return img


def chevron(direction: str, seed: int):
    """Inlaid direction mark: which way the relay flows along this lane."""
    img = flag(seed, 1, tone=1.02)
    # three nested chevrons pointing along the direction
    if direction == "e":
        for k in range(3):
            x = 5 + k * 3
            for i in range(4):
                px(img, x + i, 7 - i, COPPER_LIGHT)
                px(img, x + i, 8 + i, COPPER_LIGHT)
                px(img, x + i + 1, 7 - i, COPPER)
                px(img, x + i + 1, 8 + i, COPPER)
    elif direction == "w":
        for k in range(3):
            x = 10 - k * 3
            for i in range(4):
                px(img, x - i, 7 - i, COPPER_LIGHT)
                px(img, x - i, 8 + i, COPPER_LIGHT)
                px(img, x - i - 1, 7 - i, COPPER)
                px(img, x - i - 1, 8 + i, COPPER)
    elif direction == "s":
        for k in range(3):
            y = 5 + k * 3
            for i in range(4):
                px(img, 7 - i, y + i, COPPER_LIGHT)
                px(img, 8 + i, y + i, COPPER_LIGHT)
    else:
        for k in range(3):
            y = 10 - k * 3
            for i in range(4):
                px(img, 7 - i, y - i, COPPER_LIGHT)
                px(img, 8 + i, y - i, COPPER_LIGHT)
    return img


def medallion_sheet(radius: int = 4):
    """The inlaid relay disc under a Soul Anchor, cut into 16 px floor tiles.

    One drawing, sliced — not a pile of edge cases — so the ring, the ticks and the
    star stay concentric across tile borders.
    """
    span = 2 * radius + 1
    size = span * T
    canvas = new(size, size)
    cx = cy = size / 2 - 0.5
    r_out = radius * T - 3
    # 0. the plate the medallion is cut into. Every tile of the square has to be
    #    opaque: a transparent corner in an overlay tile punches a hole straight
    #    through the floor and shows the void behind the level.
    for y in range(size):
        for x in range(size):
            n = ((x * 29 + y * 17) % 13) / 13.0
            px(canvas, x, y, shade(mix(STONE_DARK, VERD_DARK, 0.22), 0.94 + n * 0.10))
    # a copper hairline just inside the plate edge, so the square reads as inlaid
    for i in range(size):
        for edge in (2, 3, size - 4, size - 3):
            px(canvas, i, edge, COPPER_DARK)
            px(canvas, edge, i, COPPER_DARK)
    # 1. the inlaid disc: concentric stone bands, so it reads as a cut medallion
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d > r_out + 1:
                continue
            edge = r_out + 1 - d
            if edge < 1.6:
                px(canvas, x, y, shade(STONE_DARK, 0.82))
                continue
            band = int((r_out - d) // 9)
            base = mix(STONE_BASE, VERD_DARK, 0.34)
            tone = 1.06 if band % 2 == 0 else 0.88
            if (r_out - d) > 34:
                tone *= 0.82
            n = ((x * 13 + y * 7) % 11) / 11.0
            px(canvas, x, y, shade(base, tone * (0.97 + n * 0.07)))
    # radial joints at the compass points break the disc into eight quarries
    for i in range(8):
        a = math.radians(i * 45 + 22.5)
        for r in range(10, int(r_out) - 1):
            px(canvas, int(cx + math.cos(a) * r), int(cy + math.sin(a) * r),
               shade(STONE_DARK, 0.86))
    # 2. copper outer ring and a verdigris inner ring
    arc(canvas, cx, cy, r_out - 7, 0, 360, COPPER_DARK, 2)
    arc(canvas, cx, cy, r_out - 9, 0, 360, COPPER, 1)
    arc(canvas, cx, cy, r_out - 26, 0, 360, VERD_DARK, 3)
    arc(canvas, cx, cy, r_out - 27, 0, 360, VERD_LIGHT, 1)
    # 3. eight ticks across the band between the rings, at the compass points
    for i in range(8):
        a = math.radians(i * 45)
        x0 = cx + math.cos(a) * (r_out - 26)
        y0 = cy + math.sin(a) * (r_out - 26)
        x1 = cx + math.cos(a) * (r_out - 8)
        y1 = cy + math.sin(a) * (r_out - 8)
        steps = int(max(abs(x1 - x0), abs(y1 - y0)))
        for s in range(steps + 1):
            px(canvas, int(x0 + (x1 - x0) * s / max(1, steps)),
               int(y0 + (y1 - y0) * s / max(1, steps)), VERD_LIGHT)
    # 4. the two-souls mark at the centre: two opposed diamonds and a lamp core
    for k in range(22):
        half = 22 - k
        if half <= 0:
            continue
        for x in range(int(cx - half), int(cx + half + 1)):
            px(canvas, x, int(cy - k), VERD)
            px(canvas, x, int(cy + k), VERD)
    for k in range(14):
        half = 14 - k
        for x in range(int(cx - half), int(cx + half + 1)):
            px(canvas, x, int(cy - k), VERD_LIGHT)
            px(canvas, x, int(cy + k), VERD_LIGHT)
    glow(canvas, cx, cy, 7, 7, SOUL, 55, steps=3)
    glow(canvas, cx, cy, 3, 3, SOUL, 80, steps=2)
    # 5. slice into tiles
    frames = {}
    for ty in range(span):
        for tx in range(span):
            frames["medallion_%d_%d" % (tx - radius, ty - radius)] = \
                canvas.crop((tx * T, ty * T, tx * T + T, ty * T + T))
    return frames


def medallion_offsets(radius: int = 4):
    return {(dx, dy): "medallion_%d_%d" % (dx, dy)
            for dy in range(-radius, radius + 1)
            for dx in range(-radius, radius + 1)}


# --- props -----------------------------------------------------------------
def _plinth(img, cx: int, y: int, w: int, base=STONE_BASE, trim=VERD) -> None:
    block(img, cx - w // 2, y - 12, w, 12, base)
    rect(img, cx - w // 2 + 2, y - 14, w - 4, 3, trim)
    hline(img, cx - w // 2 + 2, y - 14, w - 4, shade(trim, 1.3))
    block(img, cx - w // 2 + 4, y - 18, w - 8, 5, shade(base, 0.9))


def prop_pylon(seed: int, *, tall: bool = False):
    w, h = (36, 126) if tall else (30, 94)
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    _plinth(img, cx, base_y, w - 2)
    shaft_h = h - 46
    bot_w = w - 8
    top_w = 9 if tall else 8
    for i in range(shaft_h):
        y = base_y - 18 - i
        t = i / max(1, shaft_h)
        half = int(bot_w / 2 + (top_w / 2 - bot_w / 2) * t)
        x0 = cx - half
        rect(img, x0, y, half * 2, 1, STONE_BASE)
        px(img, x0, y, STONE_PALE)
        px(img, x0 + 1, y, STONE_LIGHT)
        px(img, x0 + 2, y, shade(STONE_LIGHT, 1.02))
        px(img, x0 + half * 2 - 1, y, shade(STONE_DARK, 0.9))
        px(img, x0 + half * 2 - 2, y, shade(STONE_BASE, 0.86))
        # verdigris flush line up the shaft
        px(img, cx, y, VERD_DARK if i % 2 else VERD)
        # bracketed copper collar every 18 px
        if i % 18 == 0 and i:
            rect(img, x0 - 1, y, half * 2 + 2, 3, COPPER_DARK)
            hline(img, x0 - 1, y, half * 2 + 2, COPPER_LIGHT)
            rect(img, x0 + 1, y + 3, half * 2 - 2, 1, shade(STONE_DARK, 0.92))
    # capital
    cap_y = base_y - 18 - shaft_h
    block(img, cx - 9, cap_y, 18, 7, STONE_PALE, right=shade(STONE_DARK, 0.9))
    hline(img, cx - 9, cap_y - 1, 18, VERD_LIGHT)
    rect(img, cx - 7, cap_y + 2, 14, 2, VERD_DARK)
    # lantern head: a copper cage holding cold light
    head_y = cap_y - 20
    block(img, cx - 11, head_y, 22, 20, VERD_DARK)
    rect(img, cx - 8, head_y + 2, 16, 16, SOUL_DEEP)
    for yy in range(head_y + 3, head_y + 17):
        for xx in range(cx - 7, cx + 8):
            d = abs(xx - cx) / 7.0 + abs(yy - head_y - 10) / 7.0
            px(img, xx, yy, SOUL if d < 0.55 else SOUL_MID)
    vline(img, cx - 8, head_y, 20, COPPER)
    vline(img, cx + 8, head_y, 20, COPPER_LIGHT)
    hline(img, cx - 8, head_y + 10, 17, COPPER_DARK)
    vline(img, cx, head_y + 1, 18, VERD)
    glow(img, cx, head_y + 10, 17, 14, SOUL, 130, steps=4)
    if tall:
        for i in range(10):
            px(img, cx - 3, head_y - 1 - i, VERD_LIGHT if i % 3 else SOUL)
            px(img, cx + 3, head_y - 1 - i, VERD_LIGHT if i % 3 else SOUL)
        px(img, cx, head_y - 12, SOUL)
        glow(img, cx, head_y - 8, 12, 10, VERD_LIGHT, 110, steps=3)
    return finish(img)


def prop_crystal(seed: int, *, scale: float = 1.0):
    w, h = int(72 * scale), int(112 * scale)
    img = new(w, h)
    cx = w // 2
    base_y = h - 4
    _plinth(img, cx, base_y, w - 4)
    # collar
    block(img, cx - 22, base_y - 26, 44, 10, VERD_DARK, right=VERD)
    rect(img, cx - 18, base_y - 24, 36, 4, VERD)
    # three faceted crystals growing from the collar
    spikes = [(0, 74, 16), (-19, 48, 12), (19, 52, 12)]
    for offset, height, half in spikes:
        top = base_y - 26 - height
        for i in range(height):
            y = base_y - 26 - i
            t = i / height
            hw = max(1, int(half * (1.0 - t ** 1.5)))
            x0 = cx + offset - hw
            for x in range(x0, x0 + hw * 2):
                lit = (x - (cx + offset)) / max(1, hw)
                if lit < -0.35:
                    colour = mix(VERD, SOUL_MID, 0.55 - t * 0.2)
                elif lit < 0.2:
                    colour = mix(SOUL_MID, SOUL, 0.8 - t * 0.35)
                else:
                    colour = mix(VERD_DARK, SOUL_DEEP, 0.5)
                if ((x + y) % 17) == 0:
                    colour = SOUL
                px(img, x, y, colour)
    # a bright core so the crystals read as lit from inside
    for i in range(60):
        y = base_y - 30 - i
        px(img, cx, y, SOUL)
    glow(img, cx, base_y - 62, 30, 40, SOUL, 120, steps=5)
    glow(img, cx, base_y - 40, 20, 20, SOUL, 90, steps=3)
    # verdigris drip stains down the plinth
    for i in range(5):
        x = cx - 20 + i * 9
        vline(img, x, base_y - 16, 6 + (i % 3) * 4, VERD_DARK)
    return finish(img)


def prop_shard(seed: int, *, broken: bool = False):
    w, h = 22, 30 if broken else 40
    img = new(w, h)
    cx = w // 2
    base_y = h - 3
    for i in range(h - 8):
        t = i / max(1, h - 8)
        hw = max(1, int(7 * (1 - t)))
        for x in range(cx - hw, cx + hw):
            px(img, x, base_y - i, SOUL if x < cx else mix(VERD, SOUL_MID, 0.6))
    rect(img, cx - 8, base_y - 5, 16, 5, VERD_DARK)
    hline(img, cx - 8, base_y - 5, 16, VERD_LIGHT)
    if broken:
        for x in range(cx - 5, cx + 5):
            px(img, x, base_y - h + 6 + int(abs(x - cx) * 0.7), SOUL_MID)
    glow(img, cx, base_y - 18, 10, 14, SOUL, 80, steps=3)
    return finish(img)


def prop_pedestal(seed: int):
    img = new(32, 48)
    cx = 16
    base_y = 44
    block(img, 4, base_y - 10, 24, 10, STONE_BASE)
    block(img, 8, base_y - 26, 16, 16, STONE_LIGHT)
    rect(img, 10, base_y - 24, 3, 12, VERD)
    block(img, 5, base_y - 30, 22, 5, STONE_PALE)
    hline(img, 5, base_y - 31, 22, COPPER_LIGHT)
    # dial
    for x in range(10, 22):
        for y in range(base_y - 36, base_y - 30):
            px(img, x, y, SOUL_DEEP)
    glow(img, cx, base_y - 33, 9, 5, SOUL, 150, steps=3)
    vline(img, cx, base_y - 36, 6, COPPER_LIGHT)
    return finish(img)


def prop_conduit_post(seed: int):
    img = new(20, 58)
    cx = 10
    base_y = 54
    block(img, 3, base_y - 7, 14, 7, STONE_BASE)
    rect(img, cx - 2, base_y - 44, 4, 38, VERD_DARK)
    vline(img, cx - 2, base_y - 44, 38, VERD)
    vline(img, cx + 1, base_y - 44, 38, VERD_DARK)
    for i in range(3):
        y = base_y - 12 - i * 12
        rect(img, cx - 6, y, 12, 2, COPPER)
        px(img, cx - 6, y, COPPER_LIGHT)
        px(img, cx + 5, y, COPPER_DARK)
        rect(img, cx - 5, y - 3, 3, 3, STONE_PALE)
        rect(img, cx + 3, y - 3, 3, 3, STONE_PALE)
    glow(img, cx, base_y - 48, 10, 9, SOUL, 130, steps=3)
    block(img, cx - 5, base_y - 52, 10, 6, SOUL_DEEP)
    rect(img, cx - 3, base_y - 50, 6, 3, SOUL)
    return finish(img)


def prop_signal_wheel(seed: int):
    img = new(66, 66)
    cx = cy = 33
    arc(img, cx, cy, 26, 0, 360, IRON, 5)
    arc(img, cx, cy, 26, 0, 360, IRON_LIGHT, 1)
    arc(img, cx, cy, 21, 0, 360, IRON_DARK, 2)
    for i in range(8):
        a = math.radians(i * 45 + 22)
        ray(img, cx + math.cos(a) * 6, cy + math.sin(a) * 6, i * 45 + 22, 20, IRON, 2)
    # two opposed copper needles: the relay runs both ways through this dial
    for direction, colour in ((0, COPPER_LIGHT), (180, VERD_LIGHT)):
        a = math.radians(direction)
        for i in range(6, 26):
            x = int(cx + math.cos(a) * i)
            y = int(cy + math.sin(a) * i)
            px(img, x, y, colour)
            px(img, x, y + 1, shade(colour, 0.7))
        tip_x = int(cx + math.cos(a) * 27)
        tip_y = int(cy + math.sin(a) * 27)
        for k in range(4):
            px(img, tip_x - k, tip_y - k, colour)
            px(img, tip_x - k, tip_y + k, colour)
    block(img, cx - 5, cy - 5, 10, 10, COPPER)
    rect(img, cx - 2, cy - 2, 4, 4, SOUL)
    glow(img, cx, cy, 12, 12, SOUL, 90, steps=3)
    return finish(img)


def prop_horn(seed: int):
    img = new(54, 40)
    # bracket
    block(img, 2, 20, 10, 12, STONE_BASE)
    # cone
    for i in range(34):
        t = i / 34
        hh = int(3 + t * 12)
        y = 26 - hh // 2
        for x in range(12 + i, 13 + i):
            for yy in range(y, y + hh):
                edge = yy in (y, y + hh - 1)
                px(img, x, yy, COPPER_LIGHT if edge else COPPER)
    arc(img, 46, 26, 7, -90, 90, COPPER_PALE, 2)
    arc(img, 46, 26, 7, 90, 270, COPPER_DARK, 2)
    rect(img, 8, 22, 6, 4, VERD)
    return finish(img)


def prop_lamp(seed: int, *, standing: bool = False):
    h = 62 if standing else 46
    img = new(22, h)
    cx = 11
    base_y = h - 3
    if standing:
        block(img, 5, base_y - 8, 12, 8, STONE_BASE)
        vline(img, cx, base_y - 46, 40, IRON)
        vline(img, cx - 1, base_y - 46, 40, IRON_LIGHT)
        top = base_y - 52
    else:
        top = 4
        for i in range(12):
            px(img, cx + (i % 2), 2 + i, COPPER_DARK if i % 2 else COPPER)
    block(img, cx - 6, top, 12, 4, VERD_DARK)
    rect(img, cx - 5, top + 4, 10, 10, SOUL_DEEP)
    for y in range(top + 5, top + 13):
        for x in range(cx - 4, cx + 5):
            px(img, x, y, SOUL if abs(x - cx) + abs(y - top - 9) < 5 else SOUL_MID)
    block(img, cx - 6, top + 14, 12, 3, VERD_DARK)
    vline(img, cx - 6, top, 17, COPPER)
    vline(img, cx + 5, top, 17, COPPER_LIGHT)
    block(img, cx - 4, top - 5, 8, 5, VERD_DARK)
    glow(img, cx, top + 9, 13, 12, (255, 226, 168), 120, steps=3)
    return finish(img)


def prop_banner(seed: int):
    img = new(34, 96)
    cx = 17
    block(img, cx - 1, 2, 3, 8, COPPER)
    hline(img, 3, 8, 28, COPPER_LIGHT)
    # cloth, gently tapered and with a split tail
    for y in range(10, 88):
        t = (y - 10) / 78
        half = int(13 - t * 2)
        for x in range(cx - half, cx + half):
            worn = ((x * 37 + y * 91) % 211) < 1
            colour = LINEN_DARK if worn else LINEN
            if x in (cx - half, cx + half - 1):
                colour = shade(LINEN, 0.78)
            if y > 70 and abs(x - cx) < 2:
                continue  # split tail
            px(img, x, y, colour)
    # verdigris emblem: two interlocking rings, the two souls of the level
    arc(img, cx, 38, 8, 0, 360, VERD, 2)
    arc(img, cx, 46, 8, 0, 360, VERD, 2)
    arc(img, cx, 38, 8, 200, 340, VERD_LIGHT, 1)
    arc(img, cx, 46, 8, 20, 160, VERD_LIGHT, 1)
    for i in range(2):
        hline(img, cx - 9, 58 + i * 6, 18, VERD_DARK)
    hline(img, 3, 10, 28, shade(LINEN, 1.06))
    return finish(img)


def prop_plaque(seed: int):
    img = new(54, 28)
    block(img, 1, 3, 52, 22, STONE_LIGHT)
    frame_box(img, 3, 5, 48, 18, VERD)
    frame_box(img, 5, 7, 44, 14, VERD_DARK)
    for i in range(5):
        x = 8 + i * 9
        vline(img, x, 11, 6, STONE_DARK)
        px(img, x, 12 + (i % 2), VERD_LIGHT)
    hline(img, 6, 20, 42, shade(STONE_DARK, 0.9))
    return finish(img, shadow=False)


def prop_bench(seed: int):
    img = new(46, 26)
    block(img, 2, 8, 42, 8, STONE_LIGHT)
    hline(img, 2, 7, 42, STONE_PALE)
    rect(img, 4, 16, 6, 8, shade(STONE_BASE, 0.86))
    rect(img, 36, 16, 6, 8, shade(STONE_BASE, 0.86))
    rect(img, 8, 11, 30, 2, VERD_DARK)
    return finish(img)


def prop_coil(seed: int):
    img = new(30, 24)
    for i in range(3):
        y = 6 + i * 5
        for x in range(4, 26):
            for yy in range(y, y + 4):
                d = abs(x - 15) / 11.0
                px(img, x, yy, COPPER_LIGHT if d < 0.5 else COPPER)
        hline(img, 4, y, 22, COPPER_DARK)
    vline(img, 15, 4, 18, COPPER_DARK)
    rect(img, 12, 0, 6, 5, VERD)
    return finish(img)


def prop_rubble(seed: int):
    img = new(42, 28)
    chunks = [(4, 20, 12, 8), (16, 22, 10, 6), (24, 18, 12, 10), (10, 14, 8, 7)]
    for (x, y, w, h) in chunks:
        block(img, x, y, w, h, STONE_BASE, right=shade(STONE_DARK, 0.9))
    px(img, 20, 12, VERD_LIGHT)
    px(img, 30, 15, SOUL_MID)
    return finish(img)


def prop_urn(seed: int):
    img = new(26, 42)
    cx = 13
    block(img, 8, 34, 10, 6, STONE_BASE)
    for i in range(20):
        y = 34 - i
        t = i / 20
        hw = int(5 + math.sin(t * 3.1) * 5)
        for x in range(cx - hw, cx + hw):
            px(img, x, y, COPPER_LIGHT if x < cx - 1 else (COPPER if x < cx + hw - 2 else COPPER_DARK))
    rect(img, cx - 6, 10, 12, 3, VERD)
    rect(img, cx - 4, 8, 8, 3, VERD_DARK)
    return finish(img)


def prop_soul_figure(seed: int):
    """A veiled figure in a wall niche: the soul the Anchor holds."""
    img = new(32, 62)
    cx = 16
    base_y = 58
    # plinth
    block(img, cx - 10, base_y - 5, 20, 5, shade(STONE_BASE, 0.94))
    # robe: a bell of stone falling to the plinth
    for i in range(42):
        y = base_y - 5 - i
        t = i / 42
        hw = int(4 + t * 7)
        for x in range(cx - hw, cx + hw):
            lit = 1.0 - (x - cx) / max(1, hw) * 0.30
            px(img, x, y, shade(mix(STONE_LIGHT, VERD_DARK, 0.14), lit))
        if i % 7 == 0:
            vline(img, cx - hw + 1, y, 1, shade(STONE_DARK, 0.94))
            vline(img, cx + hw - 2, y, 1, shade(STONE_DARK, 0.94))
    # the fold of the veil over the shoulders
    for i in range(8):
        hw = int(9 - abs(4 - i) * 0.9)
        for x in range(cx - hw, cx + hw):
            px(img, x, base_y - 47 - i, mix(STONE_PALE, VERD_LIGHT, 0.18 + i / 22))
    # head, bowed
    for y in range(8):
        for x in range(-4, 5):
            if x * x + (y - 3.5) ** 2 < 15:
                px(img, cx + x, base_y - 56 + y, mix(STONE_PALE, STONE_LIGHT, 0.3))
    # the lamp it carries, and two hands cupping it
    rect(img, cx - 2, base_y - 36, 5, 5, SOUL_DEEP)
    px(img, cx, base_y - 34, SOUL)
    px(img, cx + 1, base_y - 34, SOUL)
    glow(img, cx + 1, base_y - 34, 8, 8, SOUL, 110, steps=3)
    rect(img, cx - 4, base_y - 30, 4, 2, mix(STONE_LIGHT, VERD, 0.3))
    rect(img, cx + 3, base_y - 30, 4, 2, mix(STONE_LIGHT, VERD, 0.3))
    return finish(img)


def prop_door_frame(seed: int):
    img = new(48, 70)
    block(img, 2, 12, 8, 54, STONE_LIGHT)
    block(img, 38, 12, 8, 54, STONE_LIGHT, right=shade(STONE_DARK, 0.92))
    block(img, 2, 4, 44, 10, STONE_PALE)
    hline(img, 2, 3, 44, VERD_LIGHT)
    rect(img, 6, 14, 3, 50, VERD)
    rect(img, 39, 14, 3, 50, VERD_DARK)
    arc(img, 24, 46, 9, 180, 360, COPPER, 2)
    arc(img, 24, 50, 9, 0, 180, COPPER, 2)
    glow(img, 24, 48, 10, 8, SOUL, 70, steps=3)
    return finish(img, shadow=False)


def prop_arch(seed: int):
    """The exit arch: two souls, one path, cut through a verdigris archivolt.

    Geometry, in screen space: a semicircular arch centred on (cx, spring) of
    radius `inner` sits above two straight jambs. The opening is the union of the
    half disc and the jamb rectangle; the masonry is everything else. Drawing it in
    that order means the dressing follows the curve instead of guessing at it.
    """
    img = new(116, 148)
    cx = 58
    base_y = 144
    inner = 30
    spring = 52
    pier_outer = 52

    def opening(x: int, y: int) -> bool:
        if y >= spring:
            return abs(x - cx) < inner
        dy = spring - y
        return (x - cx) ** 2 + dy * dy < inner * inner

    # 1. the dark passage
    for y in range(spring - inner, base_y):
        for x in range(cx - inner, cx + inner + 1):
            if not opening(x, y):
                continue
            depth = 1.0 - abs(x - cx) / (inner + 1)
            vertical = 1.0 - (y - (spring - inner)) / max(1, base_y - spring + inner)
            tone = 0.28 + depth * 0.40 + vertical * 0.18
            px(img, x, y, mix((6, 11, 13), (34, 52, 54), tone))

    # 2. voussoirs: three concentric courses of dressed stone around the head
    for radius, colour, band in ((inner + 1, STONE_PALE, 6),
                                 (inner + 7, STONE_LIGHT, 6),
                                 (inner + 13, STONE_BASE, 7),
                                 (inner + 20, shade(STONE_DARK, 1.04), 7)):
        for i in range(181):
            a = math.radians(180 + i)
            for k in range(band):
                x = int(round(cx + math.cos(a) * (radius + k)))
                y = int(round(spring + math.sin(a) * (radius + k)))
                if y < spring + 1:
                    px(img, x, y, colour)
            if i % 9 == 0:
                x = int(round(cx + math.cos(a) * (radius + 1)))
                y = int(round(spring + math.sin(a) * (radius + 1)))
                px(img, x, y, shade(colour, 0.72))

    # 3. jambs: ashlar piers carrying the archivolt down to the floor
    for side in (-1, 1):
        x0 = cx + side * inner
        left = x0 if side > 0 else x0 - 22
        block(img, left + 1, spring - 1, 21, base_y - spring + 1, STONE_BASE,
              left=STONE_LIGHT, right=shade(STONE_DARK, 0.88))
        for k in range(0, base_y - spring - 10, 20):
            rect(img, left + 3, spring + 8 + k, 17, 3, VERD_DARK)
            hline(img, left + 3, spring + 8 + k, 17, VERD)
            for b in range(3):
                px(img, left + 6 + b * 5, spring + 8 + k, VERD_LIGHT)
        # impost block where the arch springs
        block(img, left, spring - 7, 23, 8, STONE_PALE, right=shade(STONE_DARK, 0.9))
        hline(img, left, spring - 8, 23, VERD_LIGHT)

    # 4. verdigris keylines following both the curve and the jamb faces
    arc(img, cx, spring, inner + 1, 180, 360, VERD_LIGHT, 1)
    arc(img, cx, spring, inner + 6, 180, 360, VERD, 1)
    arc(img, cx, spring, inner + 21, 180, 360, VERD_DARK, 1)
    for side in (-1, 1):
        x = cx + side * (inner + 1)
        vline(img, x, spring, base_y - spring, VERD_DARK)

    # 5. keystone carrying the two-souls mark
    block(img, cx - 11, 0, 22, 26, STONE_PALE, right=shade(STONE_DARK, 0.9))
    arc(img, cx - 5, 12, 6, 0, 360, VERD, 2)
    arc(img, cx + 5, 12, 6, 0, 360, VERD, 2)
    arc(img, cx - 5, 12, 6, 200, 340, VERD_LIGHT, 1)
    arc(img, cx + 5, 12, 6, 20, 160, VERD_LIGHT, 1)
    glow(img, cx, 12, 11, 9, VERD_LIGHT, 90, steps=3)

    # 6. a lantern on each pier, so the exit reads as an invitation
    for side in (-1, 1):
        x = cx + side * (inner + 11)
        block(img, x - 6, 74, 12, 15, VERD_DARK)
        rect(img, x - 4, 76, 8, 11, SOUL_DEEP)
        rect(img, x - 2, 79, 4, 5, SOUL)
        hline(img, x - 6, 74, 12, COPPER_LIGHT)
        glow(img, x, 81, 12, 11, (255, 230, 172), 130, steps=3)
    return finish(img, shadow=False)


def prop_bell(seed: int):
    img = new(40, 66)
    cx = 20
    block(img, 2, 2, 36, 5, COPPER)
    vline(img, 8, 7, 44, COPPER_DARK)
    vline(img, 31, 7, 44, COPPER_DARK)
    block(img, 4, 50, 32, 5, COPPER_DARK)
    for i in range(20):
        y = 10 + i
        hw = int(3 + i * 0.55)
        for x in range(cx - hw, cx + hw):
            px(img, x, y, COPPER_LIGHT if x < cx - hw * 0.3 else COPPER)
    hline(img, cx - 14, 30, 28, VERD)
    rect(img, cx - 2, 8, 4, 3, VERD_DARK)
    rect(img, cx - 1, 30, 2, 8, COPPER_DARK)
    return finish(img, shadow=False)


def prop_sconce(seed: int):
    img = new(24, 32)
    block(img, 6, 20, 12, 8, VERD_DARK)
    arc(img, 12, 20, 9, 180, 360, COPPER, 2)
    rect(img, 8, 8, 8, 10, SOUL_DEEP)
    for y in range(9, 17):
        for x in range(9, 15):
            px(img, x, y, SOUL if abs(x - 11) + abs(y - 13) < 4 else SOUL_MID)
    glow(img, 11, 13, 10, 9, (255, 226, 168), 120, steps=3)
    return finish(img, shadow=False)


# --- build -----------------------------------------------------------------
def build_tiles() -> list:
    tiles = []
    for name, seed in (("bedrock_a", 3), ("bedrock_b", 11)):
        tiles.append((name, lambda s=seed: bedrock(s)))
    for quad, name in enumerate(("floor_a", "floor_b", "floor_c", "floor_d")):
        tiles.append((name, lambda q=quad: flag(17, q)))
    tiles.append(("floor_worn", lambda: worn(23)))
    tiles.append(("floor_broken", lambda: broken(29)))
    tiles.append(("shadow_edge", lambda: shadow_tile(96)))
    tiles.append(("wall_plinth", lambda: wall_plinth_tile(shade(STONE_LIGHT, 0.90), VERD)))
    tiles.append(("wall_field_a", lambda: wall_field_tile(31, shade(STONE_LIGHT, 0.94), JOINT)))
    tiles.append(("wall_field_b", lambda: wall_field_tile(37, shade(STONE_LIGHT, 1.02), JOINT)))
    tiles.append(("wall_dado_a", lambda: wall_field_tile(41, shade(STONE_LIGHT, 1.10), JOINT, dado=True)))
    tiles.append(("wall_pier", lambda: wall_field_tile(43, shade(STONE_LIGHT, 1.04), JOINT, pier=True)))
    tiles.append(("wall_cornice", lambda: wall_cornice_tile(VERD, STONE_BASE)))
    tiles.append(("wall_cap", lambda: wall_cap_tile(shade(STONE_PALE, 0.82), STONE_LIGHT)))
    # authored wall overlays
    tiles.append(("wall_panel", lambda: _wall_panel(1)))
    tiles.append(("wall_panel_b", lambda: _wall_panel(2)))
    tiles.append(("wall_lancet", lambda: _wall_lancet()))
    tiles.append(("wall_relay", lambda: _wall_relay()))
    # composition tiles
    tiles.append(("terrace", lambda: terrace(5)))
    tiles.append(("step_lip", lambda: step_lip(6)))
    tiles.append(("step_lip_v", lambda: step_lip_v(7)))
    for direction in ("h", "v"):
        tiles.append(("aisle_" + direction, lambda d=direction: aisle(d, 21)))
    for direction in ("h", "v", "node"):
        tiles.append(("conduit_" + direction, lambda d=direction: conduit(d, 13)))
    for direction in ("e", "w", "n", "s"):
        tiles.append(("chevron_" + direction, lambda d=direction: chevron(d, 19)))
    for name, image in medallion_sheet(4).items():
        tiles.append((name, lambda i=image: i.copy()))
    return tiles


def _wall_panel(seed: int):
    """One cell of an inlaid verdigris wainscot, designed to tile in a 3-cell bay.

    A framed panel on *every* cell reads as a ladder of bars down a long wall, so
    the frame is drawn once every three cells and the cells between are a plain
    inlay with the copper rail running through.
    """
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(STONE_LIGHT, 0.96))
    block(img, 0, 1, T, T - 2, shade(STONE_BASE, 1.06))
    # continuous copper rails: these align across cells
    hline(img, 0, 3, T, VERD_DARK)
    hline(img, 0, 4, T, VERD)
    hline(img, 0, T - 5, T, VERD)
    hline(img, 0, T - 4, T, VERD_DARK)
    if seed == 1:
        # the framed cell of the bay
        rect(img, 5, 6, T - 10, T - 12, VERD_DARK)
        rect(img, 6, 7, T - 12, T - 14, VERD)
        hline(img, 6, 7, T - 12, VERD_LIGHT)
        px(img, 8, 10, VERD_PALE)
        px(img, 8, 11, VERD_PALE)
    else:
        vline(img, 8, 5, T - 10, shade(STONE_DARK, 0.9))
        px(img, 8, 8, VERD_LIGHT)
    return img


def _wall_lancet():
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(STONE_BASE, 0.98))
    courses(img, 0, 0, T, T, shade(STONE_BASE, 0.98), row_h=8, seed=51, mortar=JOINT)
    rect(img, 5, 0, 6, T, shade(STONE_DARK, 0.92))
    rect(img, 6, 0, 4, T, mix(STONE_DARK, VERD_DARK, 0.45))
    vline(img, 4, 0, T, STONE_PALE)
    vline(img, 11, 0, T, shade(STONE_DARK, 0.8))
    return img


def _wall_relay():
    img = new(T, T)
    rect(img, 0, 0, T, T, shade(STONE_BASE, 1.0))
    courses(img, 0, 0, T, T, shade(STONE_BASE, 1.0), row_h=8, seed=53, mortar=JOINT)
    rect(img, 0, 7, T, 2, VERD_DARK)
    hline(img, 0, 7, T, COPPER)
    for x in (3, 12):
        rect(img, x, 5, 2, 6, COPPER_LIGHT)
        px(img, x, 5, SOUL)
    return img


def build_props() -> list:
    return [
        ("pylon", lambda: prop_pylon(1)),
        ("pylon_tall", lambda: prop_pylon(2, tall=True)),
        ("crystal_anchor", lambda: prop_crystal(3)),
        ("crystal_anchor_small", lambda: prop_crystal(4, scale=0.72)),
        ("crystal_shard", lambda: prop_shard(5)),
        ("crystal_shard_broken", lambda: prop_shard(6, broken=True)),
        ("pedestal", lambda: prop_pedestal(7)),
        ("conduit_post", lambda: prop_conduit_post(8)),
        ("signal_wheel", lambda: prop_signal_wheel(9)),
        ("relay_horn", lambda: prop_horn(10)),
        ("lamp_hanging", lambda: prop_lamp(11)),
        ("lamp_standing", lambda: prop_lamp(12, standing=True)),
        ("banner", lambda: prop_banner(13)),
        ("plaque", lambda: prop_plaque(14)),
        ("bench", lambda: prop_bench(15)),
        ("cable_coil", lambda: prop_coil(16)),
        ("rubble", lambda: prop_rubble(17)),
        ("urn", lambda: prop_urn(18)),
        ("soul_figure", lambda: prop_soul_figure(19)),
        ("door_frame", lambda: prop_door_frame(20)),
        ("arch_relay", lambda: prop_arch(21)),
        ("bell", lambda: prop_bell(22)),
        ("sconce", lambda: prop_sconce(23)),
    ]


def main() -> None:
    write_kit(ART, KIT, build_tiles(), build_props(), light_colour=(212, 255, 236), gamma=0.78)


if __name__ == "__main__":
    main()
