#!/usr/bin/env python3
"""Landmark, camp and vegetation sprites for the Hollow Marches.

Every sprite is drawn at the project's real pixel scale and shares one palette
with `art.py`, so the ten dungeon approaches read as one material culture:
grey-violet stone with rusted iron, dried cloth and the cold cyan of the Soul
Relay. Each landmark gets a different *silhouette* first and detail second, so a
player recognises the place before reading its label.

Outputs:
  assets/environment/overworld/overworld_props.png
  data/overworld/overworld_props.json
"""

from __future__ import annotations

import json
import os

from PIL import Image

from art import (  # same directory
    C, T, arch, bevel_block, courses, contact_shadow, dither, frame_box, glow_disc,
    grain, h01, hline, mix, new, px, rect, shade, speck, vline,
)

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ART_DIR = os.path.join(ROOT, "assets", "environment", "overworld")
DATA_DIR = os.path.join(ROOT, "data", "overworld")

OUT = (12, 10, 16, 255)


def outline_alpha(img):
    """Give every opaque pixel a dark bottom/right rim (chunky pixel outline)."""
    w, h = img.size
    src = img.copy()
    for y in range(h):
        for x in range(w):
            a = src.getpixel((x, y))[3]
            if a == 0:
                continue
            if x + 1 < w and src.getpixel((x + 1, y))[3] == 0:
                img.putpixel((x, y), mix(src.getpixel((x, y)), OUT, 0.55))
            if y + 1 < h and src.getpixel((x, y + 1))[3] == 0:
                img.putpixel((x, y), mix(src.getpixel((x, y)), OUT, 0.6))
    return img


def stone_back(img, x, y, w, h, tone=1.0, seed=1):
    base = shade(C("stone"), tone)
    courses(img, x, y, w, h, base, row_h=6, seed=seed, mortar=shade(base, 0.5),
            light=shade(base, 1.22), dark=shade(base, 0.62))


def tower(img, x, y, w, h, tone=1.0, seed=1, cap=True):
    stone_back(img, x, y + 4, w, h - 4, tone, seed)
    # lit face + shadow side
    rect(img, x, y + 4, 2, h - 4, shade(C("stone"), tone * 1.3))
    rect(img, x + w - 2, y + 4, 2, h - 4, shade(C("stone"), tone * 0.7))
    if cap:
        rect(img, x - 2, y, w + 4, 5, shade(C("stone"), tone * 0.95))
        hline(img, x - 2, y, w + 4, shade(C("stone"), tone * 1.35))
        for i in range(x - 2, x + w + 2, 4):
            rect(img, i, y - 2, 2, 3, shade(C("stone"), tone * 0.9))


def door(img, x, y, w, h, *, glow=None):
    arch(img, x, y, w, h, C("void"), edge=shade(C("stone"), 1.35))
    if glow:
        rect(img, x + w // 2 - 1, y + h // 3, 2, h - h // 3 - 1, glow)


def banner(img, x, y, w, h, colour=None):
    colour = colour or C("cloth")
    rect(img, x, y, w, h, colour)
    vline(img, x, y, h, shade(colour, 1.35))
    vline(img, x + w - 1, y, h, shade(colour, 0.6))
    # swallowtail
    for i in range(w // 2):
        px(img, x + w // 2 + i, y + h - 1 - i, (0, 0, 0, 0))
        px(img, x + w // 2 + i, y + h - 1, (0, 0, 0, 0))
    frame_box(img, x, y, w, h, shade(colour, 0.55))
    px(img, x + w // 2, y + 3, C("gold"))


def fire(img, cx, cy, scale=1.0):
    for i, (dx, dy, w, h, col) in enumerate((
        (0, 0, 7, 9, C("blood")),
        (0, 1, 5, 7, C("fire")),
        (0, 2, 3, 5, C("fire_hi")),
    )):
        w = max(2, int(w * scale))
        h = max(2, int(h * scale))
        rect(img, int(cx - w / 2), int(cy - h), w, h, col)
    px(img, cx, cy - int(10 * scale), C("fire_hi"))


# ---------------------------------------------------------------------------
# the ten dungeon approaches
# ---------------------------------------------------------------------------
def lm_crypt():
    """L01 — a sunk tomb front: stepped plinth, huge door, twin graves."""
    img = new(96, 64)
    stone_back(img, 8, 18, 80, 40, 0.92, 11)
    rect(img, 4, 54, 88, 8, shade(C("stone"), 0.8))
    hline(img, 4, 54, 88, shade(C("stone"), 1.15))
    # stepped cornice
    rect(img, 6, 12, 84, 8, shade(C("stone"), 0.86))
    hline(img, 6, 12, 84, shade(C("stone"), 1.3))
    rect(img, 14, 6, 68, 7, shade(C("stone"), 0.78))
    hline(img, 14, 6, 68, shade(C("stone"), 1.22))
    for i in range(16, 82, 8):
        rect(img, i, 2, 4, 5, shade(C("stone"), 0.9))
    door(img, 36, 30, 24, 28, glow=None)
    # door leaf shadows + iron studs
    vline(img, 47, 34, 24, shade(C("stone"), 0.5))
    for y in range(36, 56, 6):
        px(img, 40, y, C("iron"))
        px(img, 55, y, C("iron"))
    # flanking sarcophagi
    for bx in (10, 68):
        rect(img, bx, 44, 18, 10, shade(C("stone"), 1.05))
        hline(img, bx, 44, 18, shade(C("stone"), 1.3))
        rect(img, bx + 1, 46, 16, 2, C("bone_dk"))
    # braziers
    for bx in (22, 70):
        rect(img, bx, 36, 4, 8, C("iron_dk"))
        rect(img, bx - 2, 32, 8, 4, C("iron"))
        fire(img, bx + 2, 32, 0.6)
    contact_shadow(img)
    return outline_alpha(img)


def lm_ossuary():
    """L02 — bone galleries: stacked niches, skulls, a leaning broken arch."""
    img = new(96, 72)
    stone_back(img, 6, 22, 84, 44, 0.8, 21)
    rect(img, 2, 62, 92, 8, shade(C("stone"), 0.72))
    # leaning arch
    stone_back(img, 26, 10, 44, 16, 0.9, 22)
    for i in range(44):
        px(img, 26 + i, 10 + int(i * 0.06), shade(C("stone"), 1.25))
    door(img, 30, 22, 36, 34)
    # niches full of bones
    for ny in range(26, 60, 12):
        for nx in range(10, 22, 6):
            rect(img, nx, ny, 5, 9, C("void"))
            rect(img, nx + 1, ny + 5, 3, 3, C("bone"))
            px(img, nx + 2, ny + 4, C("bone_dk"))
        for nx in range(72, 88, 6):
            rect(img, nx, ny, 5, 9, C("void"))
            rect(img, nx + 1, ny + 4, 3, 4, C("bone"))
    # skull course above the door
    for i, sx in enumerate(range(32, 62, 6)):
        rect(img, sx, 16, 4, 4, C("bone"))
        px(img, sx + 1, 17, C("void"))
        px(img, sx + 2, 17, C("void"))
    # scattered femurs
    for i in range(7):
        bx = 8 + int(h01(21, i, 1) * 78)
        by = 58 + int(h01(21, i, 2) * 5)
        hline(img, bx, by, 3, C("bone_dk"))
    speck(img, 6, 22, 84, 44, shade(C("stone"), 0.55), 26, seed=7)
    contact_shadow(img)
    return outline_alpha(img)


def lm_archive():
    """L03 — ruined archive: three columns, a broken pediment, fallen shelves."""
    img = new(112, 72)
    # plinth
    rect(img, 2, 60, 108, 10, shade(C("stone"), 0.78))
    hline(img, 2, 60, 108, shade(C("stone"), 1.2))
    stone_back(img, 10, 40, 92, 22, 0.86, 31)
    door(img, 46, 44, 20, 18)
    # columns
    for cx in (14, 34, 74, 94):
        rect(img, cx, 18, 8, 44, shade(C("stone"), 0.95))
        vline(img, cx, 18, 44, shade(C("stone"), 1.3))
        vline(img, cx + 7, 18, 44, shade(C("stone"), 0.65))
        rect(img, cx - 2, 14, 12, 5, shade(C("stone"), 1.06))
        rect(img, cx - 2, 58, 12, 4, shade(C("stone"), 0.9))
    # broken pediment: left half standing, right half collapsed
    for i in range(40):
        h = 16 - abs(i - 20) // 2
        rect(img, 14 + i, 14 - h, 1, h, shade(C("stone"), 0.9))
    rect(img, 14, 12, 40, 3, shade(C("stone"), 1.15))
    for i in range(14):
        rect(img, 66 + i, 26 - i // 3, 4, 6 + i // 3, shade(C("stone"), 0.8))
    # shelves and scrolls
    for sy in (46, 52):
        rect(img, 16, sy, 26, 2, C("wood_dk"))
        for sx in range(17, 40, 3):
            rect(img, sx, sy - 3, 1, 3, C("bone_dk"))
    for i in range(4):
        rect(img, 86, 44 + i * 5, 10, 3, C("wood"))
        px(img, 88, 45 + i * 5, C("gold"))
    speck(img, 10, 40, 92, 22, shade(C("stone"), 0.55), 20, seed=3)
    contact_shadow(img)
    return outline_alpha(img)


def lm_reliquary():
    """L04 — the Spiral Reliquary: concentric sacred ground and a monolith."""
    img = new(112, 80)
    # terraced circular platform
    for i, (pad, tone) in enumerate(((4, 0.72), (12, 0.82), (20, 0.92))):
        w = 104 - i * 16
        h = 26 - i * 6
        cx = 56
        rect(img, cx - w // 2, 58 + i * 6 - h + 10, w, h, shade(C("stone"), tone))
        hline(img, cx - w // 2, 58 + i * 6 - h + 10, w, shade(C("stone"), tone * 1.3))
        hline(img, cx - w // 2, 58 + i * 6 + 10, w, shade(C("stone"), tone * 0.7))
        # spiral inlay
        for step in range(0, w - 8, 6):
            px(img, cx - w // 2 + 4 + step, 58 + i * 6 - h + 12, C("bone_dk"))
    # monolith
    rect(img, 48, 6, 18, 48, shade(C("stone"), 1.05))
    vline(img, 48, 6, 48, shade(C("stone"), 1.35))
    vline(img, 65, 6, 48, shade(C("stone"), 0.7))
    rect(img, 46, 2, 22, 6, shade(C("stone"), 1.15))
    # carved spiral on the monolith
    for i in range(9):
        px(img, 57 + int(5 * h01(4, i, 1) * 2 - 5), 20 + i * 3, C("soul_glow"))
    rect(img, 55, 44, 4, 10, C("soul_glow"))
    # flanking standing stones
    for sx in (24, 84):
        rect(img, sx, 24, 8, 36, shade(C("stone"), 0.88))
        hline(img, sx, 24, 8, shade(C("stone"), 1.25))
    contact_shadow(img)
    return outline_alpha(img)


def lm_crucible():
    """L05 — the Blood Crucible: a rimmed ritual basin with red light."""
    img = new(112, 72)
    rect(img, 4, 56, 104, 14, shade(C("ritual"), 0.8))
    hline(img, 4, 56, 104, C("ritual_hi"))
    # basin rim
    rect(img, 18, 30, 76, 28, shade(C("stone"), 0.86))
    hline(img, 18, 30, 76, shade(C("stone"), 1.2))
    # the bowl
    rect(img, 28, 34, 56, 20, C("blood_dk"))
    rect(img, 32, 38, 48, 14, C("blood"))
    for i in range(10):
        px(img, 34 + i * 4, 44 + int(h01(5, i, 1) * 4), C("blood_hi"))
    # iron ring over the bowl
    for i in range(24):
        px(img, 26 + i * 2, 32 + (i % 4 == 0), C("iron_dk"))
    # chains
    for cx in (30, 54, 78):
        for y in range(6, 30, 3):
            px(img, cx, y, C("iron_dk"))
            px(img, cx + 1, y + 1, C("iron"))
    # standing ritual stones
    for sx in (10, 92):
        rect(img, sx, 34, 10, 26, shade(C("ritual"), 1.0))
        hline(img, sx, 34, 10, C("ritual_hi"))
        vline(img, sx, 34, 26, C("ritual_hi"))
    glow_disc(img, 56, 44, 22, 10, (170, 40, 38, 255), 90)
    for i in range(5):
        px(img, 40 + i * 6, 30, C("fire"))
    contact_shadow(img)
    return outline_alpha(img)


def lm_relay():
    """L06 — Soul Anchor Relay: pylons and a cold arc of soul light."""
    img = new(96, 104)
    rect(img, 6, 92, 84, 12, shade(C("stone"), 0.72))
    hline(img, 6, 92, 84, shade(C("stone"), 1.1))
    # three pylons, tallest in the middle
    for cx, h, tone in ((16, 56, 0.9), (48, 84, 1.0), (72, 48, 0.86)):
        w = 12
        rect(img, cx, 92 - h, w, h, shade(C("stone"), tone))
        vline(img, cx, 92 - h, h, shade(C("stone"), tone * 1.3))
        vline(img, cx + w - 1, 92 - h, h, shade(C("stone"), tone * 0.65))
        # iron bands
        for y in range(92 - h + 8, 92, 12):
            hline(img, cx, y, w, C("iron_dk"))
        # crystal head
        rect(img, cx + 3, 92 - h - 8, 6, 9, C("soul_dk"))
        rect(img, cx + 4, 92 - h - 7, 4, 6, C("soul_glow"))
        glow_disc(img, cx + w // 2, 92 - h - 4, 8, 7, C("soul_glow"), 110)
    # arcing conduit between heads
    for i in range(30):
        t = i / 29.0
        x = int(22 + t * 62)
        y = int(52 + 10 * (1 - (2 * t - 1) ** 2))
        px(img, x, y, C("soul_glow"))
        if i % 3 == 0:
            px(img, x, y + 1, C("soul"))
    # base conduit ring
    rect(img, 10, 88, 76, 3, C("soul"))
    for i in range(10):
        px(img, 14 + i * 8, 88, C("soul_glow"))
    contact_shadow(img)
    return outline_alpha(img)


def lm_beacon():
    """L07 — the Failing Beacon: a tall watchtower carrying a live fire."""
    img = new(64, 120)
    rect(img, 4, 106, 56, 14, shade(C("stone"), 0.74))
    hline(img, 4, 106, 56, shade(C("stone"), 1.1))
    # tapered tower
    for i in range(70):
        y = 106 - i
        inset = 12 - i // 10
        w = 30 - (i // 12) * 2
        rect(img, 32 - w // 2, y, w, 1, shade(C("stone"), 0.9 + (0.1 if i % 9 == 0 else 0)))
        px(img, 32 - w // 2, y, shade(C("stone"), 1.28))
        px(img, 32 + w // 2 - 1, y, shade(C("stone"), 0.66))
    # arched door and small windows
    arch(img, 26, 88, 12, 18, C("void"), edge=shade(C("stone"), 1.3))
    for wy in (46, 62, 78):
        rect(img, 30, wy, 4, 6, C("void"))
        px(img, 30, wy, C("stone"))
    # brazier gallery
    rect(img, 12, 30, 40, 6, shade(C("stone"), 1.05))
    hline(img, 12, 30, 40, shade(C("stone"), 1.3))
    for bx in (14, 30, 46):
        rect(img, bx, 24, 3, 7, C("iron_dk"))
    # the fire itself
    glow_disc(img, 32, 18, 22, 20, C("fire"), 130)
    fire(img, 32, 26, 2.0)
    for i in range(6):
        px(img, 26 + i * 2, 8 + int(h01(7, i) * 4), C("fire_hi"))
    # banners
    banner(img, 10, 40, 8, 20)
    banner(img, 46, 40, 8, 20, C("cloth"))
    contact_shadow(img)
    return outline_alpha(img)


def lm_divided():
    """L08 — the Divided Reliquary: two wings in contradiction, one door."""
    img = new(128, 88)
    rect(img, 2, 76, 124, 12, shade(C("stone"), 0.7))
    hline(img, 2, 76, 124, shade(C("stone"), 1.08))
    # left wing: pale, ordered, square
    stone_back(img, 6, 30, 52, 46, 1.12, 81)
    rect(img, 2, 24, 60, 8, shade(C("bone"), 0.95))
    hline(img, 2, 24, 60, C("bone"))
    for cx in (12, 30, 48):
        rect(img, cx, 34, 6, 40, shade(C("bone"), 0.92))
        vline(img, cx, 34, 40, C("bone"))
    arch(img, 22, 46, 14, 26, C("void"), edge=C("bone_dk"))
    # right wing: dark, warped, tall
    stone_back(img, 66, 18, 56, 58, 0.62, 82)
    rect(img, 62, 12, 62, 8, shade(C("stone"), 0.7))
    hline(img, 62, 12, 62, shade(C("stone"), 0.9))
    for cx in (72, 88, 104, 116):
        rect(img, cx, 24, 6, 52, shade(C("stone"), 0.58))
        vline(img, cx, 24, 52, shade(C("stone"), 0.8))
    door(img, 86, 40, 18, 36)
    # the seam: a crack running between them
    for y in range(14, 78):
        px(img, 63 + int(h01(8, y) < 0.4), y, C("void"))
    # contrasting banners
    banner(img, 14, 40, 8, 22, C("bone_dk"))
    banner(img, 108, 34, 8, 24, C("blood"))
    glow_disc(img, 95, 60, 10, 14, C("soul_glow"), 70)
    contact_shadow(img)
    return outline_alpha(img)


def lm_gate():
    """L09 — the Crimson Gate: a real territorial threshold, portcullis down."""
    img = new(132, 104)
    rect(img, 2, 92, 128, 12, shade(C("stone"), 0.68))
    # curtain wall
    stone_back(img, 10, 52, 112, 40, 0.86, 91)
    hline(img, 10, 52, 112, shade(C("stone"), 1.2))
    for x in range(10, 122, 8):
        rect(img, x, 48, 4, 5, shade(C("stone"), 0.92))
    # twin towers
    tower(img, 0, 20, 34, 74, 1.0, 92)
    tower(img, 98, 20, 34, 74, 1.0, 93)
    # gate arch and portcullis
    arch(img, 48, 60, 36, 32, C("void"), edge=shade(C("stone"), 1.3))
    for x in range(50, 82, 4):
        vline(img, x, 62, 30, C("iron_dk"))
    for y in range(64, 92, 6):
        hline(img, 48, y, 36, C("iron_dk"))
    # blood-red status braziers on the towers
    for bx in (8, 116):
        rect(img, bx, 40, 10, 6, C("iron"))
        glow_disc(img, bx + 5, 36, 10, 9, C("blood_hi"), 120)
        fire(img, bx + 5, 40, 0.9)
    # banners either side of the arch
    banner(img, 36, 56, 9, 30, C("blood"))
    banner(img, 88, 56, 9, 30, C("blood"))
    speck(img, 10, 52, 112, 40, shade(C("stone"), 0.55), 26, seed=9)
    contact_shadow(img)
    return outline_alpha(img)


def lm_throne():
    """L10 — Castellan's citadel: the inner keep, spires, a great sealed door."""
    img = new(152, 128)
    rect(img, 2, 116, 148, 12, shade(C("stone"), 0.64))
    # outer curtain
    stone_back(img, 8, 72, 136, 44, 0.7, 101)
    for x in range(8, 144, 8):
        rect(img, x, 68, 4, 5, shade(C("stone"), 0.76))
    # corner towers
    tower(img, 0, 44, 26, 72, 0.82, 102)
    tower(img, 126, 44, 26, 72, 0.82, 103)
    # spire roofs
    for tx in (0, 126):
        for i in range(26):
            w = max(2, 26 - i)
            rect(img, tx + 13 - w // 2, 44 - i, w, 1, shade(C("stone"), 0.52))
    # central keep
    stone_back(img, 44, 34, 64, 82, 0.92, 104)
    rect(img, 40, 28, 72, 8, shade(C("stone"), 0.86))
    hline(img, 40, 28, 72, shade(C("stone"), 1.24))
    for i in range(18):
        w = max(2, 20 - i)
        rect(img, 76 - w // 2, 28 - i, w, 1, shade(C("stone"), 0.6))
    # the great door
    arch(img, 62, 68, 28, 48, C("void"), edge=shade(C("stone"), 1.4))
    for y in range(74, 116, 7):
        hline(img, 62, y, 28, C("iron_dk"))
    vline(img, 75, 72, 44, C("iron"))
    glow_disc(img, 76, 96, 14, 24, C("soul_glow"), 60)
    # windows
    for wy in (44, 56):
        for wx in (50, 68, 86, 98):
            rect(img, wx, wy, 4, 7, C("void"))
            px(img, wx + 1, wy + 1, C("blood_dk"))
    banner(img, 46, 40, 8, 26, C("blood"))
    banner(img, 98, 40, 8, 26, C("blood"))
    contact_shadow(img)
    return outline_alpha(img)


# ---------------------------------------------------------------------------
# camps, shortcuts, discoveries
# ---------------------------------------------------------------------------
def camp_tent():
    """A ridge tent seen from three-quarters: two canvas slopes, a dark mouth."""
    img = new(46, 36)
    ridge_x = 23
    top_y = 3
    base_y = 29
    for i in range(base_y - top_y):
        half = 3 + i
        base = mix(C("cloth"), C("wood_dk"), 0.05 + i / 34.0)
        rect(img, ridge_x - half, top_y + i, half * 2, 1, base)
        # lit left slope, shaded right slope
        hline(img, ridge_x - half, top_y + i, half, shade(base, 1.14))
        hline(img, ridge_x, top_y + i, half, shade(base, 0.74))
    # ridge rope and poles
    vline(img, ridge_x - 14, top_y + 12, base_y - top_y - 12, C("wood"))
    vline(img, ridge_x + 13, top_y + 12, base_y - top_y - 12, C("wood"))
    vline(img, ridge_x, top_y - 3, 5, C("wood"))
    px(img, ridge_x, top_y - 4, C("wood_hi"))
    for i in range(6):
        px(img, 2 + i, base_y - 1 - i, C("wood_dk"))
        px(img, 42 - i, base_y - 1 - i, C("wood_dk"))
    # door mouth
    arch(img, ridge_x - 6, base_y - 13, 12, 14, C("void"), edge=shade(C("cloth"), 0.5))
    rect(img, ridge_x - 1, base_y - 13, 2, 13, shade(C("cloth"), 0.45))
    # ground cloth
    rect(img, 6, base_y, 34, 3, shade(C("cloth"), 0.7))
    hline(img, 6, base_y, 34, shade(C("cloth"), 0.95))
    contact_shadow(img)
    return outline_alpha(img)


def camp_fire():
    img = new(28, 24)
    for i in range(9):
        a = i * 0.7
        px(img, int(14 + 8 * h01(1, i, 1) - 4), int(20 + 4 * h01(1, i, 2) - 2), C("gravel_dk"))
    for i in range(6):
        rect(img, 6 + i * 3, 19 + (i % 2), 4, 2, C("wood_dk"))
    glow_disc(img, 14, 12, 13, 12, C("fire"), 120)
    fire(img, 14, 18, 1.3)
    contact_shadow(img)
    return outline_alpha(img)


def camp_bedroll():
    img = new(24, 14)
    rect(img, 1, 5, 22, 8, C("cloth"))
    hline(img, 1, 5, 22, C("cloth_hi"))
    hline(img, 1, 12, 22, shade(C("cloth"), 0.6))
    rect(img, 2, 6, 6, 5, C("bone"))
    contact_shadow(img)
    return outline_alpha(img)


def camp_banner():
    img = new(16, 34)
    vline(img, 6, 2, 30, C("wood"))
    px(img, 6, 2, C("wood_hi"))
    rect(img, 1, 30, 12, 3, C("gravel_dk"))
    banner(img, 8, 4, 7, 20, C("cloth"))
    contact_shadow(img)
    return outline_alpha(img)


def camp_crate():
    img = new(18, 16)
    rect(img, 1, 4, 16, 11, C("wood"))
    hline(img, 1, 4, 16, C("wood_hi"))
    hline(img, 1, 14, 16, C("wood_dk"))
    vline(img, 1, 4, 11, C("wood_hi"))
    vline(img, 16, 4, 11, C("wood_dk"))
    hline(img, 1, 9, 16, C("wood_dk"))
    vline(img, 8, 4, 11, C("wood_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def camp_trophies():
    img = new(20, 20)
    vline(img, 6, 4, 15, C("wood_dk"))
    vline(img, 13, 6, 13, C("wood_dk"))
    for i in range(3):
        rect(img, 3 + i * 5, 6 + i * 3, 6, 4, C("bone"))
        px(img, 4 + i * 5, 7 + i * 3, C("void"))
    rect(img, 2, 18, 16, 3, C("gravel_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def short_bridge(broken=True):
    img = new(80, 40)
    # two stone abutments
    for ax in (0, 64):
        stone_back(img, ax, 16, 16, 24, 0.82, 61)
        hline(img, ax, 16, 16, shade(C("stone"), 1.15))
    if broken:
        # a span that stops mid-air on both sides
        for i in range(10):
            rect(img, 14 + i, 20 + i // 3, 3, 3, C("wood_dk"))
            rect(img, 63 - i, 20 + i // 3, 3, 3, C("wood_dk"))
        for i in range(4):
            px(img, 24 + i, 24 - i, mix(C("wood_dk"), C("void"), 0.4))
            px(img, 56 - i, 24 - i, mix(C("wood_dk"), C("void"), 0.4))
        # gap water glint
        rect(img, 28, 34, 24, 4, mix(C("water_hi"), C("water"), 0.5))
        speck(img, 28, 34, 24, 4, C("water_glint"), 8, seed=5)
    else:
        for i in range(52):
            rect(img, 14 + i, 20 + (i % 7 == 0), 1, 4, C("wood"))
            if i % 6 == 0:
                rect(img, 14 + i, 22, 1, 8, C("wood_dk"))
        hline(img, 14, 19, 52, C("wood_hi"))
        rect(img, 14, 28, 52, 2, C("wood_dk"))
        for i in range(0, 52, 10):
            rect(img, 14 + i, 24, 2, 6, C("iron_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def short_rubble(cleared=False):
    img = new(56, 44)
    if cleared:
        # a cart track cut through the fall, with the broken blocks shouldered aside
        for i in range(14):
            px(img, 4 + i * 3, 30 + (i % 2), C("dirt_hi"))
            px(img, 4 + i * 3, 32 + (i % 2), C("dirt"))
        for side in (0, 1):
            for i in range(7):
                bx = (2 if side == 0 else 40) + int(h01(8, side, i, 1) * 10)
                by = 28 + int(h01(8, side, i, 2) * 12)
                bw = 4 + int(h01(8, side, i, 3) * 5)
                bh = 3 + int(h01(8, side, i, 4) * 4)
                bevel_block(img, bx, by, bw, bh, shade(C("stone"), 0.74),
                            light=C("stone_hi"), dark=C("stone_edge"))
        speck(img, 2, 26, 52, 16, C("gravel_dk"), 16, seed=11)
    else:
        # a mound: big blocks at the bottom, small debris rolling outward
        for i in range(26):
            t = i / 25.0
            bx = int(4 + h01(4, i, 1) * 40)
            by = int(30 - t * 26 + h01(4, i, 2) * 8)
            bw = 6 + int(h01(4, i, 3) * 8)
            bh = 4 + int(h01(4, i, 4) * 6)
            bevel_block(img, bx, by, bw, bh, shade(C("stone"), 0.62 + 0.34 * h01(4, i, 5)),
                        light=C("stone_hi"), dark=C("stone_edge"))
        # a fallen lintel across the top
        rect(img, 8, 12, 40, 6, shade(C("stone"), 0.8))
        hline(img, 8, 12, 40, C("stone_hi"))
        hline(img, 8, 17, 40, C("stone_edge"))
        for i in range(12):
            px(img, 2 + int(h01(5, i) * 52), 38 + int(h01(6, i) * 4), C("gravel_hi"))
        speck(img, 0, 20, 56, 22, C("gravel_dk"), 22, seed=6)
        dither(img, 0, 34, 56, 8, C("gravel"), 0.14, seed=7)
    contact_shadow(img)
    return outline_alpha(img)


def short_conduit(powered=False):
    img = new(40, 60)
    rect(img, 4, 48, 32, 10, shade(C("stone"), 0.72))
    hline(img, 4, 48, 32, shade(C("stone"), 1.1))
    # iron frame
    rect(img, 12, 6, 16, 44, C("iron_dk"))
    rect(img, 10, 2, 20, 6, C("iron"))
    rect(img, 10, 48, 20, 5, C("iron"))
    for i in range(14):
        px(img, 14 + i % 12, 10 + i * 3, C("iron"))
    if powered:
        rect(img, 18, 10, 4, 38, C("soul_glow"))
        rect(img, 19, 12, 2, 34, (230, 255, 250, 255))
        glow_disc(img, 20, 28, 18, 26, C("soul_glow"), 120)
        for i in range(4):
            px(img, 8 + i * 8, 4 - i % 2, C("soul_glow"))
    else:
        rect(img, 18, 10, 4, 38, C("soul_dk"))
        dither(img, 12, 6, 16, 44, (0, 0, 0, 0), 0.18, seed=9)
        for i in range(3):
            px(img, 20, 16 + i * 12, mix(C("soul_dk"), C("void"), 0.5))
    contact_shadow(img)
    return outline_alpha(img)


def short_valve(open_=False):
    img = new(48, 52)
    stone_back(img, 2, 4, 44, 44, 0.8, 71)
    rect(img, 0, 48, 48, 4, shade(C("stone"), 0.7))
    arch(img, 12, 14, 24, 34, C("void") if open_ else C("iron_dk"), edge=shade(C("stone"), 1.3))
    if not open_:
        for y in range(18, 48, 6):
            hline(img, 13, y, 22, C("iron"))
        vline(img, 24, 16, 32, C("iron"))
        # the valve wheel: a compact iron ring on the gate
        cx, cy, r = 24, 30, 7
        for a in range(0, 360, 12):
            import math
            px(img, cx + int(r * math.cos(math.radians(a))), cy + int(r * math.sin(math.radians(a))), C("iron_hi"))
            px(img, cx + int((r - 1) * math.cos(math.radians(a))), cy + int((r - 1) * math.sin(math.radians(a))), C("iron"))
        for a in range(0, 360, 90):
            import math
            for s in range(1, r):
                px(img, cx + int(s * math.cos(math.radians(a))), cy + int(s * math.sin(math.radians(a))), C("iron_hi"))
        rect(img, cx - 2, cy - 2, 4, 4, C("blood_dk"))
        px(img, cx, cy, C("blood_hi"))
    else:
        for y in range(20, 48, 7):
            hline(img, 13, y, 22, C("iron_dk"))
        rect(img, 13, 20, 22, 4, C("iron"))
    contact_shadow(img)
    return outline_alpha(img)


def disc_shrine():
    img = new(28, 32)
    rect(img, 2, 26, 24, 5, C("stone"))
    hline(img, 2, 26, 24, C("stone_hi"))
    rect(img, 8, 12, 12, 14, C("stone"))
    hline(img, 8, 12, 12, C("stone_hi"))
    for i in range(6):
        px(img, 10 + i, 16 + i, C("soul_glow"))
    rect(img, 13, 4, 2, 8, C("iron"))
    rect(img, 10, 2, 8, 3, C("iron_hi"))
    contact_shadow(img)
    return outline_alpha(img)


def disc_cache():
    img = new(24, 20)
    rect(img, 1, 8, 22, 10, C("wood"))
    hline(img, 1, 8, 22, C("wood_hi"))
    hline(img, 1, 17, 22, C("wood_dk"))
    rect(img, 8, 4, 8, 5, C("wood_dk"))
    px(img, 12, 2, C("gold"))
    contact_shadow(img)
    return outline_alpha(img)


def disc_lore():
    img = new(20, 34)
    rect(img, 4, 6, 12, 26, C("stone"))
    vline(img, 4, 6, 26, C("stone_hi"))
    vline(img, 15, 6, 26, C("stone_edge"))
    rect(img, 2, 30, 16, 4, shade(C("stone"), 0.8))
    for i in range(5):
        hline(img, 7, 11 + i * 4, 6, C("stone_edge"))
    px(img, 10, 8, C("gold"))
    contact_shadow(img)
    return outline_alpha(img)


def disc_bones():
    img = new(28, 18)
    rect(img, 2, 10, 24, 6, mix(C("gravel"), C("bone_dk"), 0.4))
    for i in range(4):
        px(img, 4 + i * 6, 12, C("bone"))
        px(img, 5 + i * 6, 11, C("bone_dk"))
    rect(img, 10, 5, 6, 6, C("bone"))
    px(img, 11, 7, C("void"))
    px(img, 14, 7, C("void"))
    contact_shadow(img)
    return outline_alpha(img)


def disc_sigils():
    img = new(24, 28)
    rect(img, 8, 12, 8, 12, C("stone"))
    rect(img, 4, 4, 16, 12, C("stone_dk"))
    hline(img, 4, 4, 16, C("stone_hi"))
    for i in range(3):
        px(img, 8 + i * 4, 8, C("soul_glow"))
    glow_disc(img, 12, 10, 10, 8, C("soul_glow"), 70)
    contact_shadow(img)
    return outline_alpha(img)


# ---------------------------------------------------------------------------
# vegetation and scattered furniture
# ---------------------------------------------------------------------------
def tree_dead():
    img = new(40, 58)
    for i in range(34):
        w = max(2, 8 - i // 6)
        rect(img, 19 - w // 2, 56 - i, w, 1, mix(C("wood_dk"), C("void"), 0.25))
    # branches
    for i, (bx, by, dx, ln) in enumerate(((18, 40, -1, 12), (22, 34, 1, 13), (20, 26, -1, 9), (21, 20, 1, 8))):
        for s in range(ln):
            px(img, bx + dx * s, by - s // 2, mix(C("wood_dk"), C("void"), 0.3))
            if s % 4 == 0:
                px(img, bx + dx * s, by - s // 2 - 1, mix(C("wood_dk"), C("void"), 0.15))
    hline(img, 15, 55, 10, C("wood_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def tree_pine():
    img = new(34, 58)
    for i in range(12):
        w = 6 + i * 2
        rect(img, 17 - w // 2, 20 + i * 3, w, 3, mix(C("moor_dk"), C("void"), 0.15 + 0.02 * i))
        hline(img, 17 - w // 2, 20 + i * 3, w, mix(C("moor"), C("void"), 0.1))
    rect(img, 16, 48, 3, 10, C("wood_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def bush():
    img = new(26, 22)
    rect(img, 3, 8, 20, 12, mix(C("moor_dk"), C("void"), 0.1))
    rect(img, 6, 5, 14, 8, mix(C("moor"), C("void"), 0.15))
    hline(img, 7, 5, 12, C("moor_hi"))
    speck(img, 4, 6, 18, 13, C("grass_hi"), 8, seed=3)
    contact_shadow(img)
    return outline_alpha(img)


def rock(seed=1, w=26, h=20):
    """A boulder: a chipped, asymmetric crown on a flat footprint.

    It used to be two stacked rectangles with a full-width bright line across the
    top, which at the camera's 2x zoom read as a concrete block or a low bench -
    about four hundred of them are scattered across the map, so the world was
    littered with furniture. The silhouette is now a per-column height profile
    that leans, with a notch cut out of one shoulder, and the lit crown follows
    the profile instead of ruling a line. The first rewrite made a symmetrical
    dome, which read as a haystack; the lean and the notch are what stop that.
    """
    img = new(w, h)
    body = mix(C("rock"), C("rock_dk"), 0.34)
    hi = mix(C("rock"), C("rock_hi"), 0.60)
    lo = mix(C("rock_dk"), C("void"), 0.30)

    base_y = h - 4
    cx = w * 0.52
    rx = w / 2.0 - 1.5
    ry = base_y - 2.0
    notch_x = 4 + int(h01(seed, 1) * (w - 10))
    notch_w = 2 + int(h01(seed, 2) * 2)
    notch_d = 1 + int(h01(seed, 3) * 2)
    top = {}
    for x in range(w):
        dx = (x - cx) / rx
        if abs(dx) > 1.0:
            continue
        span = (1.0 - dx ** 2) ** 0.5
        wob = (h01(seed, x, 4) - 0.5) * 2.0
        ty = int(round(base_y - 1 - span * ry + wob))
        if notch_x <= x < notch_x + notch_w:
            ty += notch_d
        top[x] = max(2, min(base_y - 1, ty))
    if not top:
        return img
    for x, ty in sorted(top.items()):
        for y in range(ty, base_y):
            px(img, x, y, body)
        # lit crown: the top two rows, warmest on the light side (upper left)
        px(img, x, ty, hi if x < cx else mix(hi, body, 0.55))
        if ty + 1 < base_y:
            px(img, x, ty + 1, mix(hi, body, 0.35))
        px(img, x, base_y - 1, lo if x > cx else mix(lo, body, 0.5))
    # facets: short, angled, and never touching either edge of the mass
    for i in range(4):
        fx = 4 + int(h01(seed, i, 5) * (w - 9))
        fy = top.get(fx, base_y - 6) + 3
        if fy >= base_y:
            continue
        for k in range(1 + int(h01(seed, i, 6) * 3)):
            if fx + k < w and fy + (k % 2) < base_y:
                px(img, fx + k, fy + (k % 2), mix(body, C("rock_dk"), 0.45))
    contact_shadow(img)
    return img


def cliff_ledge(seed=1):
    """A shelf of broken ledge standing out of a cliff face.

    The cliff interior tile is deliberately featureless (see `solid_cliff` in
    `art.py`): every feature drawn inside a 16 px tile repeats on the variant
    lattice and prints a grid across a band hundreds of tiles wide. So all the
    structure of a cliff face lives out here, in world space, where it can be
    irregular. A first version was a rectangle with a lit top line and a dark
    bottom line, and at 2x that read as a floating label rather than as stone.
    """
    img = new(34, 26)
    face = mix(C("rock"), C("rock_dk"), 0.20)
    lit = mix(C("rock"), C("rock_hi"), 0.50)
    rect(img, 2, 11, 27, 6, face)
    rect(img, 6, 7, 18, 4, mix(face, lit, 0.55))
    rect(img, 11, 15, 14, 3, mix(face, C("rock_dk"), 0.35))
    hline(img, 7, 7, 16, lit)
    hline(img, 12, 4, 8, mix(lit, face, 0.4))
    for i in range(5):
        x = 2 + int(h01(seed, i, 1) * 27)
        y = 16 + int(h01(seed, i, 2) * 3)
        px(img, x, y, (0, 0, 0, 0))
    for x in range(3, 30):
        if img.getpixel((x, 17))[3]:
            px(img, x, 17, mix(face, C("void"), 0.55))
            px(img, x, 18, mix(face, C("void"), 0.30))
    for i in range(6):
        x = 3 + int(h01(seed, i, 3) * 25)
        px(img, x, 11 + int(h01(seed, i, 4) * 5), mix(face, C("rock_dk"), 0.5))
    return img


def cliff_buttress(seed=1):
    """A rock buttress standing out of a cliff face, two to three tiles tall.

    The cliff mass is 380 tiles wide; a face made only of 16 px tiles reads as a
    flat slab however good the tile is, because the eye has nothing at the scale
    in between. This is that middle scale: a pillar lit down its left flank and
    dropping into shadow on the right, with a stepped silhouette.

    Value is the whole trick. Against the face it sits on, the body is two steps
    lighter and the shadow side three steps darker - enough to read at 2x without
    an outline, because an outline on a decal repeated across a wall is exactly
    the grid this project already had to remove twice.
    """
    w, h = 26, 40
    img = new(w, h)
    face = mix(C("rock"), C("rock_dk"), 0.25)
    lit = mix(C("rock"), C("rock_hi"), 0.55)
    dark = mix(C("rock_dk"), C("void"), 0.25)
    # (y, x, width): stacked slabs, each shorter than the one below
    rows = [(2, 6, 16), (7, 3, 20), (13, 1, 22), (19, 4, 19), (26, 2, 21), (32, 5, 17)]
    for y, x0, width in rows:
        rect(img, x0, y, width, 6, face)
        hline(img, x0, y, width, mix(face, lit, 0.55))
        px(img, x0, y + 1, lit)
        px(img, x0 + width - 1, y + 1, dark)
        px(img, x0 + width - 1, y + 2, mix(dark, face, 0.4))
    cx = 10 + int(h01(seed, 1) * 5)
    for k in range(8, 30):
        if h01(seed, k, 2) < 0.3:
            continue
        px(img, cx + (1 if k % 7 == 0 else 0), k, mix(face, C("void"), 0.35))
    for i in range(5):
        x = 4 + int(h01(seed, i, 3) * 16)
        px(img, x, 33 + int(h01(seed, i, 4) * 4), (0, 0, 0, 0))
    for y in range(36, h):
        for x in range(w):
            if img.getpixel((x, y))[3]:
                px(img, x, y, mix(face, C("void"), 0.45))
    return img


def cliff_crack(seed=1):
    """A crack in a cliff face: shadow only, no fill.

    A broken line of dark pixels that wanders, because a straight one would
    re-create the shelf problem at decal scale.
    """
    img = new(18, 22)
    x = 4 + int(h01(seed, 1) * 8)
    for y in range(2, 20):
        if h01(seed, y, 2) < 0.15:
            continue
        px(img, x, y, mix(C("rock_dk"), C("void"), 0.45))
        if h01(seed, y, 3) < 0.4:
            px(img, x + 1, y, mix(C("rock_dk"), C("void"), 0.15))
        if h01(seed, y, 4) < 0.3:
            x += 1 if h01(seed, y, 5) < 0.5 else -1
            x = max(1, min(16, x))
    return img


def gravestone(kind="slab"):
    img = new(18, 26)
    if kind == "cross":
        rect(img, 2, 20, 14, 5, mix(C("gravel_dk"), C("stone_edge"), 0.5))
        rect(img, 7, 2, 4, 20, C("stone"))
        rect(img, 3, 7, 12, 4, C("stone"))
        vline(img, 7, 2, 20, C("stone_hi"))
    else:
        rect(img, 2, 22, 14, 4, mix(C("gravel_dk"), C("stone_edge"), 0.5))
        rect(img, 4, 6, 10, 18, C("stone"))
        rect(img, 5, 4, 8, 3, C("stone"))
        vline(img, 4, 6, 18, C("stone_hi"))
        for i in range(3):
            hline(img, 6, 10 + i * 4, 6, C("stone_edge"))
    contact_shadow(img)
    return outline_alpha(img)


def sarcophagus():
    img = new(34, 22)
    rect(img, 1, 6, 32, 14, C("stone"))
    hline(img, 1, 6, 32, C("stone_hi"))
    hline(img, 1, 19, 32, C("stone_edge"))
    rect(img, 4, 9, 26, 7, shade(C("stone"), 1.08))
    hline(img, 4, 9, 26, C("bone_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def column(broken=False):
    h = 22 if broken else 46
    img = new(20, h)
    rect(img, 5, 2, 10, h - 6, C("stone"))
    vline(img, 5, 2, h - 6, C("stone_hi"))
    vline(img, 14, 2, h - 6, C("stone_edge"))
    rect(img, 3, h - 5, 14, 5, shade(C("stone"), 0.9))
    hline(img, 3, h - 5, 14, C("stone_hi"))
    if not broken:
        rect(img, 3, 0, 14, 4, shade(C("stone"), 1.1))
        hline(img, 3, 0, 14, C("stone_hi"))
    else:
        for x in range(5, 15):
            px(img, x, 1 + int(h01(9, x) * 3), (0, 0, 0, 0))
    contact_shadow(img)
    return outline_alpha(img)


def wall_stub():
    img = new(36, 22)
    stone_back(img, 0, 6, 36, 14, 0.86, 41)
    for x in range(0, 36):
        drop = 1 + int(h01(41, x) * 4)
        for y in range(drop):
            px(img, x, y, (0, 0, 0, 0))
        px(img, x, drop, C("stone_hi"))
    hline(img, 0, 20, 36, C("stone_edge"))
    contact_shadow(img)
    return outline_alpha(img)


def statue():
    img = new(24, 42)
    rect(img, 2, 36, 20, 6, shade(C("stone"), 0.86))
    rect(img, 6, 26, 12, 11, C("stone"))
    rect(img, 8, 12, 8, 15, C("stone"))
    rect(img, 9, 6, 6, 7, C("bone_dk"))
    hline(img, 6, 26, 12, C("stone_hi"))
    vline(img, 8, 12, 15, C("stone_hi"))
    px(img, 11, 9, C("soul_glow"))
    contact_shadow(img)
    return outline_alpha(img)


def lamp():
    img = new(16, 40)
    vline(img, 7, 8, 28, C("iron_dk"))
    rect(img, 5, 34, 6, 4, C("iron"))
    rect(img, 3, 4, 10, 10, C("iron_dk"))
    rect(img, 4, 5, 8, 8, C("fire_hi"))
    glow_disc(img, 8, 9, 10, 10, C("fire"), 120)
    rect(img, 2, 2, 12, 3, C("iron"))
    contact_shadow(img)
    return outline_alpha(img)


def brazier():
    img = new(22, 28)
    rect(img, 4, 18, 14, 8, C("iron_dk"))
    hline(img, 4, 18, 14, C("iron"))
    rect(img, 2, 12, 18, 7, C("iron"))
    hline(img, 2, 12, 18, C("iron_hi"))
    glow_disc(img, 11, 10, 11, 10, C("fire"), 130)
    fire(img, 11, 14, 1.2)
    contact_shadow(img)
    return outline_alpha(img)


def cart():
    img = new(38, 26)
    rect(img, 2, 8, 30, 12, C("wood"))
    hline(img, 2, 8, 30, C("wood_hi"))
    hline(img, 2, 19, 30, C("wood_dk"))
    for wx in (8, 26):
        rect(img, wx, 18, 9, 7, C("wood_dk"))
        rect(img, wx + 2, 20, 5, 3, C("void"))
    px(img, 32, 12, C("iron"))
    contact_shadow(img)
    return outline_alpha(img)


def barrel():
    img = new(16, 20)
    rect(img, 2, 4, 12, 14, C("wood"))
    hline(img, 2, 4, 12, C("wood_hi"))
    hline(img, 2, 9, 12, C("iron_dk"))
    hline(img, 2, 16, 12, C("iron_dk"))
    contact_shadow(img)
    return outline_alpha(img)


def fence():
    img = new(34, 18)
    for x in (2, 16, 30):
        rect(img, x, 2, 3, 14, C("wood_dk"))
    hline(img, 1, 6, 32, C("wood"))
    hline(img, 1, 11, 32, C("wood"))
    contact_shadow(img)
    return outline_alpha(img)


def signpost():
    img = new(26, 26)
    rect(img, 12, 6, 3, 18, C("wood_dk"))
    rect(img, 2, 6, 18, 7, C("wood"))
    hline(img, 2, 6, 18, C("wood_hi"))
    for i in range(3):
        hline(img, 4, 8 + i * 2, 12, C("wood_dk"))
    contact_shadow(img)
    return outline_alpha(img)


PROPS = {
    # landmarks
    "lm_crypt": lm_crypt,
    "lm_ossuary": lm_ossuary,
    "lm_archive": lm_archive,
    "lm_reliquary": lm_reliquary,
    "lm_crucible": lm_crucible,
    "lm_relay": lm_relay,
    "lm_beacon": lm_beacon,
    "lm_divided": lm_divided,
    "lm_gate": lm_gate,
    "lm_throne": lm_throne,
    # camps
    "camp_tent": camp_tent,
    "camp_fire": camp_fire,
    "camp_bedroll": camp_bedroll,
    "camp_banner": camp_banner,
    "camp_crate": camp_crate,
    "camp_trophies": camp_trophies,
    # shortcuts
    "short_bridge_broken": lambda: short_bridge(True),
    "short_bridge_fixed": lambda: short_bridge(False),
    "short_rubble_block": lambda: short_rubble(False),
    "short_rubble_cleared": lambda: short_rubble(True),
    "short_conduit_off": lambda: short_conduit(False),
    "short_conduit_on": lambda: short_conduit(True),
    "short_valve_closed": lambda: short_valve(False),
    "short_valve_open": lambda: short_valve(True),
    # discoveries
    "disc_shrine": disc_shrine,
    "disc_cache": disc_cache,
    "disc_lore": disc_lore,
    "disc_bones": disc_bones,
    "disc_sigils": disc_sigils,
    # vegetation / furniture
    "tree_dead": tree_dead,
    "tree_pine": tree_pine,
    "bush": bush,
    "rock_a": lambda: rock(1, 26, 20),
    "rock_b": lambda: rock(2, 34, 26),
    "cliff_ledge_a": lambda: cliff_ledge(1),
    "cliff_ledge_b": lambda: cliff_ledge(2),
    "cliff_buttress_a": lambda: cliff_buttress(1),
    "cliff_buttress_b": lambda: cliff_buttress(2),
    "cliff_crack_a": lambda: cliff_crack(1),
    "cliff_crack_b": lambda: cliff_crack(2),
    "gravestone": lambda: gravestone("slab"),
    "grave_cross": lambda: gravestone("cross"),
    "sarcophagus": sarcophagus,
    "column": lambda: column(False),
    "column_broken": lambda: column(True),
    "wall_stub": wall_stub,
    "statue": statue,
    "lamp": lamp,
    "brazier": brazier,
    "cart": cart,
    "barrel": barrel,
    "fence": fence,
    "signpost": signpost,
}


def pack():
    images = {name: fn() for name, fn in PROPS.items()}
    # simple shelf packing: sort by height, fill rows
    order = sorted(images, key=lambda n: -images[n].height)
    pad = 2
    max_w = 512
    rows = []
    cur_row = []
    cur_w = 0
    cur_h = 0
    for name in order:
        img = images[name]
        if cur_w + img.width + pad > max_w and cur_row:
            rows.append((cur_row, cur_h))
            cur_row, cur_w, cur_h = [], 0, 0
        cur_row.append(name)
        cur_w += img.width + pad
        cur_h = max(cur_h, img.height)
    if cur_row:
        rows.append((cur_row, cur_h))

    sheet_h = sum(h + pad for _, h in rows) + pad
    sheet = new(max_w, sheet_h)
    frames = {}
    y = pad
    for row, h in rows:
        x = pad
        for name in row:
            img = images[name]
            sheet.alpha_composite(img, (x, y + h - img.height))
            frames[name] = {"x": x, "y": y + h - img.height, "w": img.width, "h": img.height}
            x += img.width + pad
        y += h + pad
    return sheet, frames


def main():
    os.makedirs(ART_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    sheet, frames = pack()
    sheet.save(os.path.join(ART_DIR, "overworld_props.png"))
    with open(os.path.join(DATA_DIR, "overworld_props.json"), "w") as f:
        json.dump({"tile_size": T, "frames": frames}, f, indent=1, sort_keys=True)
    print("props: %d frames, sheet %dx%d" % (len(frames), sheet.width, sheet.height))
    # Hand-painted overrides last, exactly like art.py: a manual prop survives
    # every regeneration. See tools/overworld/overrides.py.
    try:
        import overrides as _overrides
        _overrides.compose("props")
    except Exception as error:  # pragma: no cover - the generator must not die over art
        print("override pass skipped: %s" % error)


if __name__ == "__main__":
    main()
