#!/usr/bin/env python3
"""Two landmark exteriors painted by hand, not by the shared generator.

`art_props.py` draws all ten landmarks from one vocabulary, which is why the
world reads as one place — and why two of them came out abstract: the Crossfire
Archive was four columns and a grey box, the Spiral Reliquary a squat terrace.
Both were the plainest frames in the set, and both are on the critical path.

These two frames are painted here instead, per building, and then live as
**manual overrides** (`assets/environment/overworld/overrides/props/`). The
generator keeps producing its version underneath them; the override wins at
build time. That is the hybrid pipeline's whole point: bespoke art where it
earns its cost, generated art everywhere else, and no regeneration destroying
either.

What is different about them, concretely:

* **Silhouette first.** Both are drawn as a single readable shape against the
  sky — a broken basilica with a bell tower, and a tiered reliquary mound — so
  the player recognises the destination from across the screen at 2x zoom.
* **One warm light per building**, at the door, in the darkest part of the
  silhouette. The eye goes to the entrance, which is also the interactable.
* **Depth by value, not by line.** Each tier steps 12–18 % in value, so the form
  reads without a drawn outline (the outline pass only keeps the frame off the
  background).
* **Bespoke detail that names the place**: the archive's shelves and hanging
  banner, the reliquary's spiral inlay and the soul-light burning in its
  monolith.

    python3 tools/overworld/manual_landmarks.py   # writes the override PNGs
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import art_props as P  # noqa: E402  (palette + primitives)
from art_props import (  # noqa: E402
    C, arch, banner, contact_shadow, courses, door, frame_box, hline, mix, new,
    outline_alpha, px, rect, shade, speck, tower, vline,
)

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "assets", "environment", "overworld", "overrides", "props")


def footprint_shadow(img, x0=0, x1=None, alpha=96):
    """Contact shadow that only darkens pixels the building actually covers.

    The shared `contact_shadow()` paints a strip across the whole frame, which is
    right for a tile-sized prop and wrong for a building with air beside it: in
    the scene it drew a black shelf along the ground to the right of the archive,
    and the building read as floating on it.
    """
    width, height = img.size
    x1 = width if x1 is None else x1
    for x in range(max(0, x0), min(width, x1)):
        for y in (height - 1, height - 2):
            r, g, b, a = img.getpixel((x, y))
            if a == 0:
                continue
            fade = alpha if y == height - 1 else max(0, alpha - 34)
            px(img, x, y, mix((r, g, b, a), (10, 8, 14, 255), fade / 255.0))


## Every landmark is lifted to this median luminance. Measured (see
## `tools/overworld/art_quality.py`) the painted exteriors sat at 0.315 while the
## ground they stand on sits at 0.356: stone on stone, so a destination did not
## read as a destination. The art direction wants front props in a band clearly
## above the ground; 0.46 is that band, and the lift is computed per frame from
## its own median, so a dark basalt wall and a pale sand facade both land in it
## without being flattened to the same tone.
VALUE_TARGET = 0.46


def value_to_target(img, target=VALUE_TARGET, tint=(255, 246, 228)):
    """Mix a frame toward warm light until its *opaque* median hits `target`.

    Mixing keeps the relative steps between courses, niches and shadows; a
    brightness multiply would flatten them, and a lift applied per building with
    hand-tuned constants would drift the moment a frame is repainted.
    """
    opaque = [(x, y) for y in range(img.height) for x in range(img.width)
              if img.getpixel((x, y))[3] > 128]
    if not opaque:
        return img
    lumas = sorted((img.getpixel(p)[0] * 299 + img.getpixel(p)[1] * 587
                    + img.getpixel(p)[2] * 114) // 1000 for p in opaque)
    median = lumas[len(lumas) // 2] / 255.0
    if median >= target:
        return img
    amount = min(0.55, (target - median) / max(0.05, 1.0 - median) * 1.05)
    for x, y in opaque:
        r, g, b, a = img.getpixel((x, y))
        img.putpixel((x, y), (int(r + (tint[0] - r) * amount),
                              int(g + (tint[1] - g) * amount),
                              int(b + (tint[2] - b) * amount), a))
    return img


def value_lift(img, amount=0.18, tint=(255, 244, 226)):
    """Lift the building into the front-prop value band, keeping its structure.

    Measured against the plaza they stand on, both hand-painted exteriors came out
    at delta -0.03 / +0.01 - the same value as the ground, which is exactly what
    the art rules forbid for a destination (front props live in 0.62-0.85, ground
    in 0.30-0.42). Mixing toward a warm light lifts the whole building while
    keeping the relative steps between its courses, which a brightness multiply
    would flatten.
    """
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            if a == 0:
                continue
            nr = int(r + (tint[0] - r) * amount)
            ng = int(g + (tint[1] - g) * amount)
            nb = int(b + (tint[2] - b) * amount)
            img.putpixel((x, y), (nr, ng, nb, a))


def paving_apron(img):
    """The flagstone apron the archive stands on.

    Sanity-checked by value, not by eye: measured against the plaza it sits on, the
    apron has to be within a couple of hundredths, or it reads as a plinth the
    building floats on. It is drawn AFTER the building's value lift for that
    reason - lifting it along with the walls turned it into a white shelf.
    """
    paving = C("gravel")
    rect(img, 2, 64, 108, 8, shade(paving, 1.04))
    for row, (y0, h) in enumerate(((64, 4), (68, 4))):
        rect(img, 2, y0 + h - 1, 108, 1, shade(paving, 0.84))
        offset = 0 if row == 0 else 5
        for x in range(2 + offset, 108, 14):
            rect(img, x, y0, 1, h - 1, shade(paving, 0.88))
            rect(img, x + 1, y0, 13, 1, shade(paving, 1.16))
    hline(img, 2, 64, 108, shade(paving, 1.28))


def archive():
    """L03 Crossfire Archive — a two-tower gatehouse with a broken centre span.

    Rebuilt after looking at it at 5x: the first version had a large featureless
    gable plate in the middle (the one thing the art rules forbid), and a shelf
    against its broken end that read as loose sticks rather than furniture. What
    survives is the idea - a symmetric building with an asymmetric wound - and
    what changes is that every surface is now coursed, the centre span is a solid
    wall of stacked books behind an arch, and the collapse is confined to one
    tower's crown so the silhouette still reads as a gatehouse from across a
    screen.
    """
    img = new(112, 72)
    stone = C("stone")

    # --- ground: two worn steps, wider than the building ---------------------
    # The first version used a near-black plinth, which in the scene read as a
    # shelf floating under the building instead of as the steps in front of it:
    # the ground it stands on is a mid-value brown, so the steps have to sit in
    # that band and carry their own coursing.
    paving_apron(img)

    # --- the two towers ------------------------------------------------------
    # Left tower: intact, battlements, narrow lit window. Right tower: its crown
    # has fallen in, so its top ends in stairs of masonry instead of merlons.
    for tx, top, width in ((10, 6, 22), (80, 12, 22)):
        rect(img, tx, top, width, 64 - top, shade(stone, 0.92))
        courses(img, tx, top, width, 64 - top, shade(stone, 0.92), row_h=6, seed=tx,
                mortar=shade(stone, 0.44), light=shade(stone, 1.16), dark=shade(stone, 0.62))
        # corner quoins: two-pixel alternating blocks, the cheapest way to make a
        # 22-pixel tower read as masonry rather than as a grey bar
        for qy in range(top + 2, 62, 8):
            rect(img, tx, qy, 3, 4, shade(stone, 1.2))
            rect(img, tx + width - 3, qy + 4, 3, 4, shade(stone, 1.08))
        # window: a tall slit with a warm sill, one per tower
        rect(img, tx + width // 2 - 2, top + 14, 4, 12, C("void"))
        rect(img, tx + width // 2 - 3, top + 26, 6, 2, shade(stone, 1.3))
        px(img, tx + width // 2, top + 25, C("fire"))

    # left tower crown: merlons
    rect(img, 8, 2, 26, 5, shade(stone, 0.8))
    hline(img, 8, 2, 26, shade(stone, 1.3))
    for mx in range(9, 33, 6):
        rect(img, mx, 0, 4, 3, shade(stone, 0.86))
        hline(img, mx, 0, 4, shade(stone, 1.34))

    # right tower crown: caved in. The break is a *profile* across the tower - the
    # wall survives to a stepped line that falls away to the right - rather than a
    # shape cut out of it. Cutting a notch left the tower's right edge floating in
    # the air, disconnected from the building, which read as two buildings.
    # Starts at x=92 so the tower's own window survives: a break that eats the
    # window leaves a black bar at the silhouette's edge, which reads as damage to
    # the *drawing*, not to the building.
    for x in range(92, 103):
        crown = 12 + ((x - 92) // 3) * 6
        rect(img, x, 12, 1, crown - 12, (0, 0, 0, 0))
        rect(img, x, crown, 1, 2, shade(stone, 1.26))     # lit top of the stub
        rect(img, x, crown + 2, 1, 2, shade(stone, 0.5))  # and its shadow
    # rubble that fell out of it, on the step below
    for i in range(7):
        rect(img, 92 + i * 2, 56 + int(3 * P.h01(21, i)), 3, 2, shade(stone, 0.66))

    # --- centre span: an arched reading hall behind the door -----------------
    rect(img, 32, 22, 48, 42, shade(stone, 0.84))
    courses(img, 32, 22, 48, 42, shade(stone, 0.84), row_h=6, seed=11,
            mortar=shade(stone, 0.42), light=shade(stone, 1.12), dark=shade(stone, 0.58))
    # parapet along the top of the span, broken above the door
    rect(img, 32, 20, 48, 3, shade(stone, 1.0))
    hline(img, 32, 20, 48, shade(stone, 1.32))
    for i in range(4):
        rect(img, 46 + i * 6, 17, 4, 3, shade(stone, 0.9))

    # --- the gateway: a recessed portal, a tympanum, and the door's light ----
    # A full-height void read as a hole punched through the building. The doorway
    # is now a recess: dark stone at the sides, a carved tympanum above the lintel
    # and the door itself filling most of the opening, so the eye lands on the
    # warm rectangle rather than on an absence.
    rect(img, 42, 38, 28, 26, shade(stone, 0.42))         # recess shadow
    rect(img, 40, 36, 32, 3, shade(stone, 1.26))          # lintel
    hline(img, 40, 36, 32, shade(stone, 1.5))
    rect(img, 44, 40, 24, 6, shade(stone, 1.06))          # tympanum panel
    for i in range(4):                                    # book emblem on it
        rect(img, 50 + i * 3, 42, 2, 2, C("bone_dk"))
    door(img, 46, 46, 20, 18, glow=C("fire"))
    rect(img, 47, 62, 18, 2, shade(C("fire"), 0.5))       # spill onto the step
    for i in range(10):
        px(img, 44 + i, 63 + int(2 * P.h01(22, i)), mix(C("fire"), shade(stone, 0.6), 0.5))

    # --- what the archive is for: shelves of books, seen through the arch ----
    # Stacked as blocks with a spine colour per shelf, not as scattered sticks:
    # at 2x a row of one-pixel spines reads as noise, a solid band of books with
    # gaps reads as a shelf.
    # a low shelf against the right tower's base, clear of the doorway
    for sy in (54, 58):
        rect(img, 74, sy, 12, 2, C("wood_dk"))
        for bx in range(75, 85, 2):
            tone = (C("cloth"), C("bone_dk"), C("wood"))[bx % 3]
            rect(img, bx, sy - 2, 1, 2, tone)
    # banner on a pole, hung from the parapet clear of the portal
    vline(img, 64, 20, 14, C("wood_dk"))
    banner(img, 66, 21, 8, 12, C("cloth"))
    px(img, 69, 26, C("gold")); px(img, 70, 27, C("gold"))

    value_lift(img, 0.2)
    paving_apron(img)
    speck(img, 20, 30, 52, 30, shade(stone, 0.5), 14, seed=5)
    speck(img, 10, 40, 22, 20, shade(stone, 1.16), 10, seed=6)
    footprint_shadow(img, 6, 106)
    return outline_alpha(img)


def _terrace(img, cx, top, half_width, height, tone, stone):
    """One tier of the mound: a lit ledge on top, a darker face below.

    A stepped pyramid is only legible if each horizontal surface is *visible*. A
    two-line highlight is not enough at 2x zoom, so each tier gets a 5 px lit
    ledge with the face below it two steps darker. Three of these stacked read as
    a mound from across the screen; without the ledge they read as stripes.
    """
    left = cx - half_width
    width = half_width * 2
    # face
    rect(img, left, top, width, height, shade(stone, tone))
    # lit top ledge, with a front lip so the ledge has thickness
    rect(img, left, top, width, 5, shade(stone, tone * 1.34))
    hline(img, left, top, width, shade(stone, tone * 1.55))
    hline(img, left, top + 4, width, shade(stone, tone * 1.12))
    # the front face of the ledge, then the shadow it casts on the tier below
    hline(img, left, top + height - 1, width, shade(stone, tone * 0.55))
    # corner posts: what makes a stepped silhouette read as built, not stacked
    rect(img, left, top, 2, height, shade(stone, tone * 1.2))
    rect(img, left + width - 2, top, 2, height, shade(stone, tone * 0.68))
    return left, width


def reliquary():
    """L04 Spiral Reliquary — a stepped mound with a soul-light at its crown.

    Rewritten after seeing it in the scene: three bare slabs stacked read as a
    wedding cake, not as a building. What makes a tier read as *built* at 2x is
    coursing on its face, a pilaster at each end, and a ledge with visible
    thickness - so every tier here carries all three, its face is half as tall as
    before, and the whole mound sits five pixels lower so the crown fits under the
    camera's top edge.
    """
    img = new(112, 80)
    stone = C("stone")
    cx = 56

    # --- three tiers, each one lighter than the one below it ------------------
    # (y_top, half_width, face_height, tone). The faces are 10-12 px: a 20 px face
    # is a plate at this scale, and no amount of texture fixes a plate.
    tiers = ((60, 46, 12, 0.82), (48, 38, 11, 0.94), (37, 30, 10, 1.04), (27, 22, 9, 1.14))
    for top, half, height, tone in tiers:
        left = cx - half
        width = half * 2
        # face with masonry coursing, so the slab has scale
        rect(img, left, top, width, height, shade(stone, tone))
        courses(img, left, top, width, height, shade(stone, tone), row_h=4, seed=top,
                mortar=shade(stone, tone * 0.72), light=shade(stone, tone * 1.16),
                dark=shade(stone, tone * 0.88))
        # the ledge: 4 px of lit top surface plus its shadow on the face below
        rect(img, left, top, width, 4, shade(stone, tone * 1.3))
        hline(img, left, top, width, shade(stone, tone * 1.5))
        hline(img, left, top + 3, width, shade(stone, tone * 1.1))
        rect(img, left, top + 4, width, 1, shade(stone, tone * 0.6))
        # pilasters: two pixels of vertical stone at each end, catching the light
        for px_x in (left, left + width - 3):
            rect(img, px_x, top, 3, height, shade(stone, tone * 1.1))
            vline(img, px_x, top, height, shade(stone, tone * 1.28))
        # a lit niche on the face, one per tier, alternating sides
        nx = left + (7 if (top // 4) % 2 == 0 else width - 11)
        rect(img, nx, top + 6, 4, 4, shade(stone, tone * 0.5))
        px(img, nx + 1, top + 7, C("fire"))

    # --- the spiral stair: a wide central flight cut into every tier ----------
    for top, half, height, tone in tiers:
        rect(img, cx - 7, top + 4, 14, height, shade(stone, tone * 0.88))
        for step_y in range(top + 5, top + height + 4, 2):
            hline(img, cx - 7, step_y, 14, shade(stone, tone * 1.24))
        vline(img, cx - 8, top + 4, height, shade(stone, tone * 0.62))
    # the flight continues over the lowest tier's ledge, onto the plaza
    for i in range(4):
        rect(img, cx - 9 - i, 72 - i, 18 + i * 2, 2, shade(stone, 0.9))
        hline(img, cx - 9 - i, 72 - i, 18 + i * 2, shade(stone, 1.3))

    # --- the crown: a monolith with the soul-light burning in its seam --------
    rect(img, cx - 11, 15, 22, 12, shade(stone, 1.16))
    rect(img, cx - 9, 8, 18, 8, shade(stone, 1.24))
    rect(img, cx - 6, 3, 12, 6, shade(stone, 1.32))
    hline(img, cx - 6, 3, 12, shade(stone, 1.6))
    vline(img, cx - 11, 15, 12, shade(stone, 1.34))
    vline(img, cx + 10, 15, 12, shade(stone, 0.72))
    vline(img, cx - 9, 8, 8, shade(stone, 1.4))
    vline(img, cx + 8, 8, 8, shade(stone, 0.76))
    rect(img, cx - 2, 5, 4, 22, mix(C("soul_dk"), C("void"), 0.35))
    rect(img, cx - 1, 5, 2, 22, C("soul_glow"))
    for i in range(6):  # the light it throws
        px(img, cx - 4 - (i % 2), 7 + i * 3, mix(C("soul_glow"), C("void"), 0.55))
        px(img, cx + 3 + (i % 2), 8 + i * 3, mix(C("soul_glow"), C("void"), 0.65))

    # --- offerings, and the standing stones that ring the base ---------------
    rect(img, cx - 16, 63, 7, 5, shade(stone, 0.9))      # altar
    hline(img, cx - 16, 63, 7, shade(stone, 1.3))
    px(img, cx - 13, 62, C("soul_glow"))
    for sx, tone, height in ((8, 0.86, 20), (17, 0.8, 13), (88, 0.8, 13), (97, 0.86, 20)):
        rect(img, sx, 72 - height, 6, height, shade(stone, tone))
        hline(img, sx, 72 - height, 6, shade(stone, tone * 1.3))
        vline(img, sx, 72 - height, height, shade(stone, tone * 1.16))
        px(img, sx + 3, 74 - height, C("bone_dk"))

    value_lift(img, 0.2)
    speck(img, 6, 58, 100, 18, shade(stone, 0.5), 18, seed=9)
    speck(img, 26, 26, 60, 12, shade(stone, 0.6), 10, seed=10)
    footprint_shadow(img, 8, 104)
    return outline_alpha(img)



def crucible():
    """L05 Blood Crucible — a furnace set into a sunken wall.

    The generated frame was a grey slab with a dark red rectangle on it and four
    rust posts: at 2x it read as a bench, which is the wrong first impression for
    the level where the chapter's blood rites happen. Same building, drawn as
    what it is: a coursed wall with a furnace throat burning in the middle, two
    iron fire-bowls flanking it, chains across the mouth, and the blood channel
    running out of the throat and down the steps toward the player.
    """
    img = new(112, 72)
    stone = C("stone")

    # --- steps: the crucible sits below the approach, so the ground rises -----
    paving = C("gravel")
    rect(img, 0, 64, 112, 8, shade(paving, 0.92))
    for row, (y0, h) in enumerate(((64, 4), (68, 4))):
        rect(img, 0, y0 + h - 1, 112, 1, shade(paving, 0.72))
        for x in range(2 + (0 if row == 0 else 6), 112, 14):
            rect(img, x, y0, 1, h - 1, shade(paving, 0.78))
            rect(img, x + 1, y0, 13, 1, shade(paving, 1.12))

    # --- the sunken wall: warm-grey, coursed, visibly thick -------------------
    body = shade(stone, 0.86)
    rect(img, 6, 14, 100, 50, body)
    courses(img, 6, 14, 100, 50, body, row_h=6, seed=41,
            mortar=shade(stone, 0.48), light=shade(stone, 1.08), dark=shade(stone, 0.62))
    speck(img, 8, 16, 96, 46, shade(stone, 0.55), 20, seed=17)
    speck(img, 8, 16, 96, 46, shade(stone, 1.12), 10, seed=18)
    # a lit interior floor strip, so the wall is not one flat value
    rect(img, 8, 56, 96, 3, shade(stone, 0.7))

    # --- the furnace throat: a black arch with fire at its floor -------------
    arch(img, 34, 24, 44, 40, C("void"))
    # heat gradient: deep blood at the top of the throat, orange at the coals
    for i, y in enumerate(range(30, 58)):
        t = (y - 30) / 27.0
        if t > 0.62:
            col = mix(C("blood_dk"), C("blood"), (t - 0.62) / 0.38)
            rect(img, 36, y, 40, 1, col)
    # coal bed
    rect(img, 36, 52, 40, 8, mix(C("blood"), C("void"), 0.25))
    for i in range(20):
        x = 37 + i * 2
        y = 53 + int(4 * P.h01(51, i))
        px(img, x, y, C("fire") if i % 3 else C("fire_hi"))
        if i % 5 == 0:
            px(img, x, y - 1, C("fire_hi"))
    # flames climbing the throat, denser at the centre and leaning right
    for i in range(9):
        x = 39 + i * 4
        height = 4 + (3 if 2 <= i <= 6 else 0) + int(2 * P.h01(52, i))
        for step in range(height):
            col = C("fire_hi") if step < height * 0.4 else C("fire")
            if step > height * 0.7:
                col = mix(C("fire"), C("blood_hi"), 0.55)
            px(img, x + (step % 3 == 2), 52 - step * 2, col)
    # iron arch frame, proud of the wall
    rect(img, 30, 20, 52, 5, C("iron_dk"))
    hline(img, 30, 20, 52, C("iron_hi"))
    hline(img, 30, 24, 52, C("iron"))
    for x in range(32, 80, 6):
        px(img, x, 22, C("iron_hi"))
    for y in range(26, 62, 2):
        rect(img, 32, y, 3, 2, C("iron_dk"))
        rect(img, 77, y, 3, 2, C("iron_dk"))
    vline(img, 32, 26, 36, C("iron"))
    vline(img, 79, 26, 36, C("iron"))

    # --- one blade hung from the lintel, the only thing over the fire --------
    # Chains here were tested and dropped: at 112 px across they resolve as
    # scattered grey dots, which reads as noise over the fire, not as ironwork.
    rect(img, 55, 28, 2, 16, C("iron_hi"))
    rect(img, 53, 43, 6, 1, C("iron"))
    rect(img, 55, 44, 2, 6, C("iron_dk"))
    px(img, 56, 50, C("bone"))

    # --- two iron fire-bowls flanking the throat, in front of the wall ------
    for post_x in (10, 86):
        # cast shadow on the wall behind, so the post stands off the surface
        rect(img, post_x + 8, 22, 3, 42, shade(stone, 0.5))
        rect(img, post_x, 22, 8, 42, C("iron_dk"))
        vline(img, post_x, 22, 42, C("iron"))
        vline(img, post_x + 1, 22, 42, C("iron_hi"))
        vline(img, post_x + 7, 22, 42, C("iron_dk"))
        for ry in range(28, 62, 9):
            rect(img, post_x - 1, ry, 10, 1, C("iron"))
        # bowl
        rect(img, post_x - 3, 15, 14, 7, C("iron_dk"))
        hline(img, post_x - 3, 15, 14, C("iron_hi"))
        hline(img, post_x - 2, 21, 12, C("iron"))
        rect(img, post_x - 1, 12, 10, 3, mix(C("fire"), C("blood_hi"), 0.5))
        for fx in range(0, 9, 2):
            px(img, post_x + fx, 11 - (fx % 3), C("fire_hi") if fx % 4 else C("fire"))
            if fx % 4 == 2:
                px(img, post_x + fx, 9, mix(C("fire_hi"), C("bone"), 0.45))

    # --- the blood channel: out of the throat, over the steps, to the player -
    # It has to survive being read at 1x, so it is a solid ribbon of colour with
    # a highlight edge rather than a scatter of separate droplets.
    rect(img, 42, 58, 30, 4, C("blood"))
    hline(img, 42, 58, 30, C("blood_hi"))
    rect(img, 46, 62, 22, 3, mix(C("blood"), C("blood_dk"), 0.3))
    hline(img, 46, 62, 22, C("blood_hi"))
    rect(img, 49, 65, 16, 3, mix(C("blood"), C("blood_dk"), 0.55))
    hline(img, 49, 65, 16, C("blood"))
    rect(img, 51, 68, 12, 4, mix(C("blood_dk"), C("void"), 0.2))
    hline(img, 51, 68, 12, mix(C("blood"), C("blood_dk"), 0.4))
    for i in range(4):  # drips pooling off the channel edge
        px(img, 50 + i * 4, 71, C("blood_dk"))
        px(img, 52 + i * 4, 70, C("blood"))

    # --- offerings at the base ----------------------------------------------
    for sx in (22, 88):
        rect(img, sx, 60, 5, 4, shade(stone, 0.94))
        px(img, sx + 2, 59, C("bone"))
    footprint_shadow(img, 4, 108)
    return outline_alpha(img)


def relay():
    """L08 The Relay — a signal mast on a stone footing, not three grey pillars.

    The generated frame was three tapered pillars with teal caps and a slack wire
    between them: correct as a diagram of a relay, wrong as a place. It had no
    base, no way in, and nothing at ground level, so in the scene it read as
    three bollards. Rebuilt around a timber-and-iron vocabulary that belongs to
    no other landmark: a keeper's hut, a braced lattice mast with a soul lamp at
    its head, guy-wires, and rust streaks running down from every joint.
    """
    img = new(96, 104)
    stone = C("stone")
    iron = C("iron")
    wood = C("wood")

    # --- stone footing, one course proud of the ground -----------------------
    rect(img, 6, 90, 84, 14, shade(stone, 0.8))
    courses(img, 6, 90, 84, 14, shade(stone, 0.8), row_h=5, seed=63,
            mortar=shade(stone, 0.42), light=shade(stone, 1.1), dark=shade(stone, 0.56))
    hline(img, 6, 90, 84, shade(stone, 1.24))
    # a slot of steps up into the platform, off-centre so it is not a monument
    for i in range(4):
        rect(img, 12 + i * 2, 88 - i * 2, 20 - i * 2, 2, shade(stone, 0.94 - i * 0.04))
        hline(img, 12 + i * 2, 88 - i * 2, 20 - i * 2, shade(stone, 1.2))

    # --- keeper's hut, left: timber, pitched roof, one lit window -----------
    rect(img, 10, 56, 30, 34, shade(wood, 0.72))
    for y in range(58, 90, 4):                      # horizontal planking
        hline(img, 10, y, 30, shade(wood, 0.52))
        hline(img, 10, y + 1, 30, shade(wood, 0.92))
    rect(img, 10, 56, 3, 34, shade(wood, 0.58))      # corner posts
    rect(img, 37, 56, 3, 34, shade(wood, 0.58))
    # roof: two slopes with a ridge, overhanging on both sides
    for i in range(11):
        half = 17 - i
        rect(img, 26 - half, 55 - i, half * 2, 1, shade(wood, 0.9 - i * 0.02))
        hline(img, 26 - half, 55 - i, half * 2, shade(wood, 1.16))
    rect(img, 8, 55, 36, 2, shade(wood, 0.46))
    # window and door
    rect(img, 18, 64, 8, 9, C("void"))
    rect(img, 18, 63, 8, 1, shade(wood, 1.2))
    px(img, 21, 69, C("fire"))
    px(img, 22, 68, C("fire_hi"))
    rect(img, 28, 72, 9, 18, shade(wood, 0.42))
    rect(img, 29, 73, 7, 16, shade(wood, 0.66))
    px(img, 34, 81, C("gold"))

    # --- the mast: a solid tapered lattice ----------------------------------
    # First pass drew the legs as two 2px lines and the braces as scattered
    # dashes; at 3x it read as a pencil sketch of a tower rather than as iron.
    # The bays are filled dark, the legs are 3px, and every second bay carries a
    # full X, which is what makes a lattice read as a rigid structure.
    def half_at(y):
        t = (y - 16) / 74.0
        return 3 + int(11 * t)

    for y in range(16, 90):
        half = half_at(y)
        rect(img, 66 - half, y, half * 2, 1, C("iron_dk"))   # bay fill
    for y in range(16, 90):
        half = half_at(y)
        rect(img, 66 - half, y, 2, 1, shade(iron, 0.9))      # lit leg
        rect(img, 66 + half - 2, y, 2, 1, shade(iron, 1.05))  # shadow leg
        px(img, 66 - half, y, C("iron_hi"))
    # horizontal ties every 9px, and an X inside every other bay
    for bay, y in enumerate(range(22, 90, 9)):
        half = half_at(y)
        rect(img, 66 - half, y, half * 2, 1, shade(iron, 0.82))
        pint = 66 - half_at(y + 9)
        if bay % 2 == 0 and y + 8 < 90:
            for k in range(half * 2 - 1):
                px(img, 66 - half + k, y + 1 + k * 8 // max(1, half * 2), shade(iron, 0.74))
            for k in range(half * 2 - 1):
                px(img, 66 - half + k, y + 8 - k * 8 // max(1, half * 2), shade(iron, 0.74))
    # head: a lamp cage on a small platform
    rect(img, 56, 12, 20, 3, shade(iron, 0.9))
    rect(img, 58, 4, 16, 9, C("iron_dk"))
    rect(img, 60, 5, 12, 7, mix(C("soul"), C("soul_glow"), 0.5))
    rect(img, 62, 6, 8, 5, C("soul_glow"))
    px(img, 66, 8, C("bone"))
    for x in range(58, 74, 4):
        vline(img, x, 4, 9, C("iron"))
    rect(img, 57, 0, 18, 4, C("iron_dk"))
    hline(img, 57, 0, 18, C("iron"))
    # --- guy-wires: both on the open side, both anchored in the footing -----
    # Dotted wires read as cracks; a wire that crosses the hut reads as a rope
    # lying on the roof. Both run down-right, from the head to the footing edge.
    for ax, ay in ((88, 88), (80, 90)):
        for i in range(50):
            t = i / 49.0
            x = int(66 + (ax - 66) * t)
            y = int(22 + (ay - 22) * t)
            px(img, x, y, shade(iron, 0.7))
        rect(img, ax - 1, ay - 1, 3, 2, shade(stone, 0.72))

    # --- rust: a streak that follows the leg, never floats beside it --------
    for start_y, length in ((26, 9), (40, 6)):
        for i in range(length):
            y = start_y + i
            x = 66 + half_at(y) - 2
            px(img, x, y, C("blood_dk") if i % 3 else mix(C("blood_dk"), C("iron_dk"), 0.45))

    footprint_shadow(img, 6, 90)
    return outline_alpha(img)


def crypt():
    """L04 The Crypt — a barrow mound with a stone door, not a wall with a hole.

    The generated frame was a stone wall with an arch in it and a pale slab under
    it; the pale slab was the largest, brightest shape in the picture and the eye
    went to it instead of to the entrance. This is a burial mound: the wall is
    only what the door is framed in, the mound's turf runs over and around it, and
    the entrance is under a leaning lintel with a lantern beside it.
    """
    img = new(96, 64)
    stone = C("stone")
    grass = C("grass")

    # --- the mound: turf shoulders rising toward the door -------------------
    # The first version was a mathematically smooth dome across the full width
    # of the sprite, and in the approach frame it read as a green hill with a
    # door in it - no scale, no material, nothing that said "built". Three
    # changes fix that: the crest wanders instead of following a parabola, the
    # mound is narrower than the sprite so it has edges against the world, and a
    # drystone revetment rings its foot, which is what actually makes a barrow
    # read as a raised *tomb* rather than as a lump of ground.
    crest = {}
    for x in range(8, 88):
        d = abs(x - 48) / 40.0
        crest[x] = int(21 + 25 * d * d + (P.h01(x // 3, 3) - 0.5) * 3.5)
    for x in range(8, 88):
        top = crest[x]
        rect(img, x, top, 1, 62 - top, shade(grass, 0.74 - 0.14 * abs(x - 48) / 40.0))
        # lit crest, so the mound has a top edge against the world behind it
        rect(img, x, top, 1, 2, shade(grass, 1.10))
        # turf texture: tufts and worn patches, denser than before so the fill
        # does not read as flat paint
        for i in range(6):
            ty = top + 3 + int(28 * P.h01(x, i, 11))
            if ty < 60 and P.h01(x + i, 7) > 0.42:
                px(img, x, ty, shade(grass, 0.88 if i % 2 else 1.05))
        if P.h01(x, 12) > 0.86:
            px(img, x, min(61, top + 4 + int(P.h01(x, 13) * 20)), shade(grass, 0.62))
    # a stone crown at the crest: the one place a barrow shows its build, and
    # without it the mound is only ever turf
    for x in range(43, 54):
        d = abs(x - 48) / 6.0
        y = int(24 + 2 * d * d)
        rect(img, x, y, 1, 3, shade(stone, 0.82))
        rect(img, x, y, 1, 1, shade(stone, 1.06))

    # the revetment: a ring of coursed drystone at the mound's foot
    for x in range(8, 88):
        d = abs(x - 48) / 40.0
        base = int(52 + 6 * d * d)
        rect(img, x, base, 1, 2, shade(stone, 0.60))
        if x % 5 != 0:
            px(img, x, base, shade(stone, 0.86))
        if P.h01(x, 14) > 0.72:
            px(img, x, base - 1, shade(stone, 0.74))
    # a worn track of bare earth coming down the mound to the entrance
    for y in range(34, 64):
        half = 4 + (y - 34) // 6
        rect(img, 48 - half, y, half * 2, 1, shade(C("dirt"), 0.82))
    for i in range(10):
        px(img, 44 + int(8 * P.h01(3, i)), 36 + i * 2, shade(C("dirt"), 1.02))

    # --- the portal: a stone surround with a recessed, timber door ----------
    rect(img, 34, 34, 28, 30, shade(stone, 0.72))
    courses(img, 34, 34, 28, 30, shade(stone, 0.72), row_h=6, seed=88,
            mortar=shade(stone, 0.4), light=shade(stone, 1.12), dark=shade(stone, 0.54))
    # moss creeping over the stones from the mound side
    for i in range(26):
        mx = 34 + int(28 * P.h01(91, i))
        my = 34 + int(30 * P.h01(92, i))
        if P.h01(93, i) > 0.45:
            px(img, mx, my, shade(grass, 0.84))
    # the lintel, tilted: it has shifted and nobody has put it back
    for i in range(32):
        rect(img, 32 + i, 31 + int(i * 0.12), 1, 4, shade(stone, 0.96))
        px(img, 32 + i, 31 + int(i * 0.12), shade(stone, 1.3))
    # the door: timber leaves, iron banded, standing ajar so the dark shows
    rect(img, 39, 39, 18, 25, C("void"))
    rect(img, 40, 40, 7, 24, shade(C("wood"), 0.66))
    rect(img, 48, 40, 8, 24, shade(C("wood"), 0.5))
    for y in range(43, 64, 6):
        hline(img, 40, y, 7, C("iron_dk"))
        hline(img, 48, y, 8, C("iron_dk"))
    rect(img, 47, 40, 1, 24, C("void"))       # the gap between the leaves
    px(img, 45, 52, C("gold"))                # ring handle
    px(img, 46, 55, shade(C("wood"), 1.2))
    # a warm strip of light on the threshold stone
    rect(img, 40, 62, 16, 2, mix(C("gold"), C("stone"), 0.45))

    # --- a lantern bracketed to the door surround ---------------------------
    # A bare glow off to one side read as a lit window floating on the turf;
    # the bracket and the hood are what make it furniture.
    rect(img, 64, 46, 6, 2, C("iron_dk"))
    px(img, 69, 46, C("iron"))
    vline(img, 64, 46, 3, C("iron"))
    rect(img, 63, 49, 7, 2, C("iron"))
    rect(img, 64, 51, 5, 6, C("iron_dk"))
    rect(img, 65, 52, 3, 4, mix(C("fire"), C("gold"), 0.6))
    px(img, 66, 54, C("fire_hi"))
    px(img, 66, 58, mix(C("gold"), C("stone"), 0.5))
    px(img, 66, 59, mix(C("gold"), C("stone"), 0.35))

    # --- the mound's skirt: fallen stones and a leaning grave slab ----------
    for i in range(8):
        sx = 4 + i * 11 + int(4 * P.h01(71, i))
        rect(img, sx, 56 + (i % 3), 5, 3, shade(stone, 0.62))
        hline(img, sx, 56 + (i % 3), 5, shade(stone, 1.0))
    rect(img, 6, 44, 7, 18, shade(stone, 0.8))
    rect(img, 5, 42, 9, 3, shade(stone, 1.05))
    hline(img, 5, 42, 9, shade(stone, 1.26))
    for y in range(46, 58, 4):
        hline(img, 7, y, 5, shade(stone, 0.5))
    rect(img, 84, 48, 6, 14, shade(stone, 0.74))
    rect(img, 83, 46, 8, 3, shade(stone, 1.0))

    footprint_shadow(img, 4, 92)
    return outline_alpha(img)


def divided():
    """L10 The Divided — one great wall sheared in two, not two buildings.

    The generated frame put a pale classical colonnade on the left and a dark
    ruined block on the right, meeting at a clean vertical seam. Two buildings
    side by side was the opposite of the level's idea: the seam read as the edge
    of a sprite. Here the wall is a single mass whose two faces were built in
    different eras, and what separates them is a ragged shear with rubble at the
    foot and an arch fragment wedged in it.
    """
    img = new(128, 88)
    stone = C("stone")

    # --- right half: heavy basalt, dark, still roofed -----------------------
    rect(img, 62, 26, 62, 54, shade(stone, 0.6))
    courses(img, 62, 26, 62, 54, shade(stone, 0.6), row_h=7, seed=17,
            mortar=shade(stone, 0.34), light=shade(stone, 0.86), dark=shade(stone, 0.44))
    rect(img, 62, 26, 62, 3, shade(stone, 0.74))
    hline(img, 62, 26, 62, shade(stone, 0.96))
    for i in range(0, 62, 12):  # a squat buttress rhythm
        rect(img, 64 + i, 31, 4, 45, shade(stone, 0.48))
        hline(img, 64 + i, 31, 4, shade(stone, 0.7))
    # its opening: a soul-lit arch, the one warm-cool accent
    arch(img, 82, 40, 28, 40, C("void"))
    rect(img, 88, 52, 16, 28, mix(C("soul_dk"), C("void"), 0.4))
    rect(img, 90, 60, 12, 20, mix(C("soul"), C("soul_dk"), 0.5))
    for i in range(6):
        px(img, 92 + i * 2, 62 + int(4 * P.h01(31, i)), C("soul_glow"))
    vline(img, 82, 40, 40, shade(stone, 0.9))
    vline(img, 109, 40, 40, shade(stone, 0.34))

    # --- left half: pale classical face, half-collapsed --------------------
    pale = mix(C("stone"), C("bone"), 0.35)
    rect(img, 4, 26, 56, 54, pale)
    courses(img, 4, 26, 56, 54, pale, row_h=8, seed=5,
            mortar=shade(pale, 0.66), light=shade(pale, 1.12), dark=shade(pale, 0.82))
    # pediment fragment at the top left, broken off toward the seam
    for i in range(11):
        half = 13 - i
        rect(img, 10 - half // 2 + 12, 26 - i, half * 2, 1, shade(pale, 1.04))
        hline(img, 10 - half // 2 + 12, 26 - i, half * 2, shade(pale, 1.2))
    rect(img, 6, 26, 52, 3, shade(pale, 1.1))
    hline(img, 6, 26, 52, shade(pale, 1.28))
    # four pilasters, the outer two still full height
    for i, px_x in enumerate((8, 20, 34, 46)):
        h = 50 if i in (0, 1) else 34 - i * 2
        rect(img, px_x, 80 - h, 6, h, shade(pale, 1.06))
        vline(img, px_x, 80 - h, h, shade(pale, 1.22))
        vline(img, px_x + 5, 80 - h, h, shade(pale, 0.84))
        rect(img, px_x - 1, 78, 8, 3, shade(pale, 1.14))
    # the left face is a portico, not a second arch: two big black openings side
    # by side in the same sprite read as the same building drawn twice, which is
    # the opposite of "the divided".
    rect(img, 8, 40, 52, 40, shade(pale, 0.5))          # recessed interior
    rect(img, 8, 40, 52, 3, shade(pale, 0.72))
    for i, col_x in enumerate((10, 24, 38, 50)):
        h = 38 if i in (1, 2) else 34                     # outer pair broken
        rect(img, col_x, 78 - h, 5, h, shade(pale, 1.08))
        vline(img, col_x, 78 - h, h, shade(pale, 1.26))
        vline(img, col_x + 4, 78 - h, h, shade(pale, 0.8))
        rect(img, col_x - 1, 76, 7, 3, shade(pale, 1.16))   # base
        hline(img, col_x - 1, 76, 7, shade(pale, 1.3))
        rect(img, col_x - 1, 78 - h, 7, 2, shade(pale, 1.2))  # capital
        hline(img, col_x - 1, 78 - h, 7, shade(pale, 1.32))
    # entablature over the colonnade, and the broken pediment above it
    rect(img, 6, 33, 54, 6, shade(pale, 1.12))
    hline(img, 6, 33, 54, shade(pale, 1.3))
    hline(img, 6, 38, 54, shade(pale, 0.8))
    for i in range(9):                                    # broken pediment
        half = 9 - i
        rect(img, 33 - half, 32 - i, half * 2, 1, shade(pale, 1.0))
        hline(img, 33 - half, 32 - i, half * 2, shade(pale, 1.18))
    # the dark behind the columns, deepest in the middle bay
    rect(img, 15, 44, 8, 32, shade(pale, 0.22))
    rect(img, 29, 44, 8, 32, shade(pale, 0.16))
    rect(img, 43, 44, 6, 32, shade(pale, 0.24))
    for i in range(3):                                    # a step up to it
        rect(img, 26, 74 + i * 2, 14, 2, shade(pale, 0.9 - i * 0.1))
    # a red banner hung on the surviving pilaster, one only
    banner(img, 12, 50, 9, 24, C("cloth"))

    # --- the shear: one clean gap, wider at the top where the wall fell -----
    # A ragged edge in two colours read as a scratch down the sprite, not as a
    # break. A straight-ish gap with a lit lip on each face, and the two halves
    # visibly out of register (the right half is 4px higher at the seam), is what
    # says "this was one wall".
    for y in range(25, 84):
        t = (y - 25) / 59.0
        centre = 60 + int(2 * t)
        half = 3 + int(3 * (1.0 - t))
        for x in range(centre - half, centre + half + 1):
            if 0 <= x < 128:
                px(img, x, y, (0, 0, 0, 0))
        if centre - half - 1 >= 0 and y >= 26:
            px(img, centre - half - 1, y, shade(pale, 1.26))
        if centre + half + 1 < 128 and y >= 26:
            # inside face of the dark half: only a hint of light, or the gap
            # reads as a drawn line between two sprites
            px(img, centre + half + 1, y, shade(stone, 0.7))

    # --- a fallen lintel wedged across the gap, tilted --------------------
    # It has to cross onto the dark half or it disappears into the pale one:
    # the contrast of the two materials is what draws the eye to the break.
    lintel = shade(pale, 0.78)
    for i in range(13):
        bx = 56 + i * 2
        by = 60 - i * 2
        rect(img, bx, by, 3, 4, lintel)
        hline(img, bx, by, 3, shade(pale, 1.16))
        hline(img, bx, by + 3, 3, shade(pale, 0.5))
    rect(img, 54, 60, 3, 3, shade(pale, 0.6))   # where it broke off the ledge

    # --- rubble at the foot: chunks, not chips ----------------------------
    chunks = ((42, 78, 7), (50, 82, 9), (58, 79, 6), (64, 83, 8), (72, 80, 5),
              (36, 82, 5), (46, 84, 6), (56, 85, 7), (68, 85, 4), (28, 84, 4))
    for cx, cy, w in chunks:
        col = pale if (cx + cy) % 3 else shade(stone, 0.62)
        rect(img, cx, cy, w, 3, shade(col, 0.9))
        hline(img, cx, cy, w, shade(col, 1.16))
        hline(img, cx, cy + 2, w, shade(col, 0.62))
    # a low drift of dust where the chunks have settled
    for i in range(10):
        dx = 30 + i * 5
        rect(img, dx, 84, 4, 1, shade(stone, 0.58))

    footprint_shadow(img, 4, 124)
    return outline_alpha(img)


def camp_tent():
    """The refuge tent: a lean-to someone pitched, not a red triangle.

    At 2x the generated tent read as a red triangle with a black arch cut in it -
    a shape, not a shelter. This keeps the same footprint and gives it a ridge
    pole, a slanted canvas with visible seams, a dark opening at the front with
    the bedding inside, and two guy ropes staked out.
    """
    img = new(46, 36)
    canvas = C("cloth")
    dk = shade(canvas, 0.62)
    hi = shade(canvas, 1.18)

    # ground sheet, so the tent sits on something
    rect(img, 3, 32, 40, 3, shade(C("dirt"), 0.86))
    hline(img, 3, 32, 40, shade(C("dirt"), 1.06))

    # the canvas: an A-frame seen from the front-left, widening to the ground.
    # The first pass tapered the *wrong way* (narrow at the bottom), so it read as
    # a bucket with a hole in it; a tent has to get wider as it comes down.
    for i in range(29):
        y = 6 + i
        t = i / 28.0
        left = 10 - int(7 * t)
        right = 10 + int(31 * t)
        rect(img, left, y, right - left, 1, shade(canvas, 0.98 - 0.10 * t))
        px(img, left, y, hi)                                      # lit left edge
        px(img, right - 1, y, shade(canvas, 0.66))                # shaded right edge
    # seams following the slope, and a fold along the ridge
    for sx in (18, 26, 33):
        for i in range(29):
            if sx < 10 + int(31 * i / 28.0):
                px(img, sx, 6 + i, shade(canvas, 0.78))
    # the opening: a dark wedge at the front, with a pale bedroll just inside
    for i in range(13):
        w = 5 + i // 2
        rect(img, 21 - i // 3, 21 + i, w, 1, C("void"))
    rect(img, 18, 30, 8, 3, mix(C("cloth"), C("bone"), 0.4))
    hline(img, 18, 30, 8, C("bone_dk"))
    # ridge pole sticking out at the peak, and two guy ropes staked out
    rect(img, 6, 5, 12, 2, shade(C("wood"), 0.9))
    px(img, 7, 5, shade(C("wood"), 1.2))
    for i in range(9):
        px(img, 40 + i // 3, 12 + i * 2, shade(C("wood"), 0.7))
    rect(img, 42, 30, 3, 2, shade(C("wood"), 0.8))
    for i in range(8):
        px(img, 4 - 0 + i // 4, 12 + i * 2, shade(C("wood"), 0.7))
    rect(img, 2, 30, 3, 2, shade(C("wood"), 0.8))
    return outline_alpha(img)


def camp_fire():
    """A camp fire: a ring of stones, two crossed logs, three tongues of flame.

    The generated version was a red box with an orange square on top, which in a
    dark clearing read as a lit crate. Stone ring first, then fire, keeps the
    silhouette low and wide, which is what makes it read as a fire at 1x.
    """
    img = new(28, 24)
    stone = C("stone")

    # stone ring
    for i in range(12):
        ang = i / 12.0 * 6.28318
        sx = 14 + int(9 * math.cos(ang))
        sy = 17 + int(5 * math.sin(ang))
        w = 3 + (i % 2)
        rect(img, sx - 1, sy - 1, w, 3, shade(stone, 0.7 + 0.1 * (i % 3)))
        px(img, sx - 1, sy - 1, shade(stone, 1.1))
    # ash bed and two logs
    rect(img, 8, 15, 12, 4, C("ash_dk"))
    for i in range(9):
        px(img, 9 + i, 17 - i // 3, C("wood_dk"))
    for i in range(9):
        px(img, 18 - i, 17 - i // 3, shade(C("wood_dk"), 1.1))

    # flame: one hot core with two side tongues, leaning right
    for i in range(9):
        w = max(1, 6 - i * 2 // 3)
        rect(img, 14 - w // 2 + (i // 4), 15 - i, w, 1,
             C("fire_hi") if i > 5 else C("fire"))
    for i in range(6):
        rect(img, 11 - i // 3, 15 - i, 2, 1, C("fire") if i < 4 else mix(C("fire"), C("blood_hi"), 0.4))
        rect(img, 16 + i // 3, 15 - i, 2, 1, C("fire") if i < 4 else mix(C("fire"), C("blood_hi"), 0.4))
    px(img, 14, 6, C("fire_hi"))
    px(img, 13, 7, C("gold"))
    # glow on the ring
    for gx in (6, 7, 21, 22):
        px(img, gx, 18, mix(C("gold"), C("stone"), 0.5))
    footprint_shadow(img, 4, 24, alpha=64)
    return outline_alpha(img)


def camp_bedroll():
    """A bedroll: a rolled blanket with a strap and a pillow end.

    The generated version was a flat red bar with one white end - at 2x it read as
    a bar of soap. This is a roll: a cylinder with a lit top edge, an iron-grey
    strap around it, and the blanket tied off at one end.
    """
    img = new(24, 14)
    cloth = C("cloth")
    rect(img, 3, 7, 18, 5, shade(cloth, 0.8))          # the body of the roll
    hline(img, 3, 7, 18, shade(cloth, 1.16))
    hline(img, 3, 11, 18, shade(cloth, 0.56))
    # round ends: a cap two pixels tall at each end, lit on top and closed below
    for ex, tone in ((2, 0.66), (21, 0.74)):
        rect(img, ex, 8, 2, 3, shade(cloth, tone))
        px(img, ex + (0 if ex == 2 else 1), 7, shade(cloth, tone + 0.2))
        px(img, ex + (1 if ex == 2 else 0), 10, shade(cloth, tone - 0.2))
    for sx in (9, 15):                                  # two straps
        rect(img, sx, 7, 2, 5, C("iron_dk"))
        px(img, sx, 7, C("iron"))
    rect(img, 3, 5, 7, 3, shade(cloth, 1.04))           # pillow end, folded over
    hline(img, 3, 5, 7, shade(cloth, 1.26))
    px(img, 4, 9, shade(cloth, 0.5))
    footprint_shadow(img, 2, 22, alpha=70)
    return outline_alpha(img)


def camp_banner():
    """A camp banner on its own pole, so the cloth is not glued to nothing."""
    img = new(16, 34)
    rect(img, 5, 2, 2, 30, shade(C("wood"), 0.9))
    vline(img, 5, 2, 30, shade(C("wood"), 1.2))
    px(img, 5, 0, C("gold"))
    banner(img, 7, 3, 7, 18, C("cloth"))
    rect(img, 4, 31, 4, 2, shade(C("wood"), 0.7))
    footprint_shadow(img, 3, 11, alpha=80)
    return outline_alpha(img)


def ossuary():
    """L02 The Ossuary — bone courses, not another grey wall with a hole in it.

    The generated frame was a grey facade with a black arch and two grids of
    small niches: correct, and indistinguishable from the gate and the throne at
    a glance. The ossuary gets its own material: sandstone quarried pale, banded
    with stacked femurs, and a portal framed in jawbones.
    """
    img = new(96, 72)
    sand = mix(C("stone"), C("bone"), 0.34)
    bone = C("bone_dk")

    # --- plinth, two courses of pale stone -----------------------------------
    rect(img, 2, 64, 92, 8, shade(sand, 0.86))
    courses(img, 2, 64, 92, 8, shade(sand, 0.86), row_h=4, seed=71,
            mortar=shade(sand, 0.6), light=shade(sand, 1.16), dark=shade(sand, 0.7))

    # --- facade -------------------------------------------------------------
    body = shade(sand, 0.94)
    rect(img, 8, 14, 80, 52, body)
    courses(img, 8, 14, 80, 52, body, row_h=6, seed=12,
            mortar=shade(sand, 0.66), light=shade(sand, 1.14), dark=shade(sand, 0.78))
    # cornice: a pale cap with merlon stubs
    rect(img, 6, 11, 84, 4, shade(sand, 1.06))
    hline(img, 6, 11, 84, shade(sand, 1.3))
    hline(img, 6, 14, 84, shade(sand, 0.72))
    for i in range(0, 84, 12):
        rect(img, 8 + i, 8, 7, 4, shade(sand, 0.98))
        hline(img, 8 + i, 8, 7, shade(sand, 1.26))

    # --- bone banding: two courses of stacked femurs ------------------------
    for row_y in (20, 26):
        for i in range(14):
            bx = 10 + i * 5
            rect(img, bx, row_y, 4, 3, shade(bone, 0.94 + 0.05 * (i % 3)))
            px(img, bx, row_y, C("bone"))
            px(img, bx + 3, row_y + 2, shade(bone, 0.7))
    for i in range(10):  # loose ones at the base
        bx = 10 + i * 8 + (i % 3)
        rect(img, bx, 62, 5, 2, shade(bone, 0.9))
        px(img, bx, 62, C("bone"))

    # --- the portal: jawbone jambs, a deep recess, warm light inside -------
    rect(img, 34, 34, 28, 30, shade(sand, 0.5))
    arch(img, 36, 36, 24, 28, C("void"))
    # the interior is not a hole: a floor, a bier, and skulls on it
    rect(img, 38, 56, 20, 8, shade(sand, 0.34))
    rect(img, 42, 52, 12, 3, shade(C("wood"), 0.6))
    for i in range(4):
        rect(img, 42 + i * 3, 51, 2, 1, C("bone"))
    for i in range(3):
        px(img, 45 + i * 3, 50, C("bone"))
        px(img, 45 + i * 3, 49, shade(C("bone_dk"), 1.1))
    rect(img, 40, 58, 16, 2, mix(C("gold"), C("void"), 0.55))
    # jawbone jambs: two columns of teeth
    for side_x in (32, 60):
        rect(img, side_x, 38, 4, 26, shade(bone, 0.86))
        for t in range(0, 26, 3):
            px(img, side_x + (0 if side_x == 32 else 3), 38 + t, C("bone"))
        rect(img, side_x, 62, 4, 2, shade(bone, 0.66))
    # lintel of stacked long bones
    for i in range(12):
        rect(img, 34 + i * 2, 32, 2, 3, shade(bone, 0.9 + 0.06 * (i % 3)))
        px(img, 34 + i * 2, 32, C("bone"))

    # --- niches: four rows of small dark cells with a skull in each --------
    for nx in (14, 70):
        for row in range(4):
            ny = 36 + row * 7
            rect(img, nx, ny, 12, 6, shade(sand, 0.58))
            rect(img, nx + 1, ny + 1, 10, 4, C("void"))
            px(img, nx + 3 + (row % 2), ny + 2, C("bone"))
            px(img, nx + 6, ny + 3, shade(C("bone_dk"), 0.8))
            hline(img, nx, ny + 5, 12, shade(sand, 0.8))

    # --- two braziers on the plinth, so the entrance has a hearth ----------
    for bx in (14, 78):
        rect(img, bx, 60, 5, 4, shade(C("iron_dk"), 0.9))
        rect(img, bx - 1, 58, 7, 2, C("iron"))
        px(img, bx + 2, 57, C("fire"))
        px(img, bx + 2, 56, C("fire_hi"))

    footprint_shadow(img, 4, 92)
    return outline_alpha(img)


def beacon():
    """L07 The Beacon — a sea-worn tower with a real fire at the top.

    The generated frame was a squat tower with a red box on top; the "fire" read
    as a lit window. This one is taller and thinner, so it is recognisable from
    across a screen: salt-bleached stone, a keeper's door at the base, a timber
    ladder up the lee side (flat rungs against the wall, not pegs sticking out),
    and an iron fire-basket whose flame is wider than the tower's gallery.
    """
    img = new(64, 120)
    pale = mix(C("stone"), C("bone"), 0.16)
    timber = shade(C("wood"), 0.98)

    # --- the tower: tapered, coursed, lit on the left, shadowed on the right -
    for y in range(20, 112):
        t = (y - 20) / 92.0
        half = 11 + int(7 * t)
        rect(img, 32 - half, y, half * 2, 1, shade(pale, 1.0 - 0.05 * t))
        px(img, 32 - half, y, shade(pale, 1.24))
        px(img, 32 + half - 1, y, shade(pale, 0.72))
    # course lines, drawn tapered so they follow the wall instead of overhanging
    for cy in range(26, 112, 6):
        t = (cy - 20) / 92.0
        half = 11 + int(7 * t)
        hline(img, 32 - half, cy, half * 2, shade(pale, 0.74))
        hline(img, 32 - half, cy + 1, half * 2, shade(pale, 1.12))
        for vx in range(32 - half + (cy % 12), 32 + half, 11):
            vline(img, vx, cy, 5, shade(pale, 0.84))
    # salt streaks down the windward face
    for i in range(8):
        sx = 23 + i * 2
        for y in range(30 + (i % 5), 58 + (i % 7) * 4, 2):
            px(img, sx, y, shade(pale, 0.86))
    # a mossy tide line at the base
    for i in range(18):
        px(img, 19 + i * 2, 106 - (i % 3), shade(C("grass_dk"), 0.9))

    # --- gallery, basket and fire ------------------------------------------
    t = (20 - 20) / 92.0
    rect(img, 16, 16, 32, 5, shade(pale, 1.08))          # corbelled gallery
    hline(img, 16, 16, 32, shade(pale, 1.34))
    hline(img, 16, 20, 32, shade(pale, 0.66))
    for i in range(0, 32, 4):
        rect(img, 16 + i, 21, 2, 2, shade(pale, 0.92))
    # iron basket: a wide cage with visible bars, sitting on the gallery
    rect(img, 20, 5, 24, 11, C("iron_dk"))
    for x in range(21, 44, 3):
        vline(img, x, 5, 11, C("iron"))
    hline(img, 20, 5, 24, C("iron_hi"))
    hline(img, 20, 12, 24, C("iron"))
    # coal bed then flame: bright core, two shorter side tongues, all inside
    rect(img, 22, 10, 20, 4, mix(C("blood_dk"), C("void"), 0.3))
    for i in range(20):
        px(img, 22 + i, 10 + (i % 3), C("fire") if i % 3 else C("fire_hi"))
    for i in range(9):
        w = max(1, 10 - i)
        rect(img, 32 - w // 2, 9 - i, w, 1, C("fire_hi") if i > 5 else C("fire"))
    for i in range(6):
        rect(img, 26 - i // 3, 9 - i, 2, 1, C("fire") if i < 4 else mix(C("fire"), C("blood_hi"), 0.4))
        rect(img, 36 + i // 3, 9 - i, 2, 1, C("fire") if i < 4 else mix(C("fire"), C("blood_hi"), 0.4))
    px(img, 32, 1, C("fire_hi"))
    px(img, 31, 2, C("gold"))
    # the fire's light on the gallery below it
    for gx in range(18, 46, 2):
        px(img, gx, 16, mix(C("gold"), pale, 0.55))

    # --- keeper's door, a lit window, and the lee-side ladder --------------
    arch(img, 26, 88, 12, 6, shade(pale, 0.5))
    rect(img, 27, 92, 10, 18, shade(C("wood"), 0.58))
    rect(img, 28, 93, 8, 16, shade(C("wood"), 0.84))
    for y in range(95, 108, 4):
        hline(img, 28, y, 8, C("iron_dk"))
    px(img, 35, 101, C("gold"))
    rect(img, 29, 54, 5, 8, shade(pale, 0.44))
    px(img, 31, 58, C("fire"))
    hline(img, 28, 62, 7, shade(pale, 1.22))
    # ladder: two stringers flat against the wall, rungs between them
    for ly in range(66, 92, 4):
        t = (ly - 20) / 92.0
        half = 11 + int(7 * t)
        vline(img, 32 + half - 7, ly, 4, timber)
        vline(img, 32 + half - 4, ly, 4, timber)
        hline(img, 32 + half - 7, ly + 3, 4, shade(timber, 1.22))
        px(img, 32 + half - 8, ly + 1, shade(timber, 0.6))

    # --- one banner, weathered, hung on the tower face ---------------------
    rect(img, 21, 34, 4, 24, C("cloth"))
    vline(img, 21, 34, 24, shade(C("cloth"), 1.3))
    vline(img, 24, 34, 24, shade(C("cloth"), 0.6))
    for i in range(4):
        px(img, 24, 56 - i, (0, 0, 0, 0))
    px(img, 22, 38, C("gold"))

    # --- the rock it stands on, drawn last so it overlaps the tower's foot -
    rect(img, 6, 112, 52, 8, shade(C("rock"), 0.8))
    for i in range(7):
        rect(img, 8 + i * 7, 110 + (i % 2), 8, 3, shade(C("rock"), 0.92 + 0.05 * (i % 3)))
        hline(img, 8 + i * 7, 110 + (i % 2), 8, shade(C("rock"), 1.14))

    footprint_shadow(img, 10, 56)
    return outline_alpha(img)


def gate():
    """L09 The Crimson Gate — a working gatehouse, with a gate you can read.

    The generated frame had two towers, a black arch and a grid of red bars: the
    bars were the same colour as the banners, so the opening read as a red
    curtain rather than as iron. This is built as a gatehouse that is *in use*:
    a raised portcullis with its chains and windlass visible above the arch, a
    road worn through the threshold, braziers either side, and the Crimson
    banners kept to the towers where they belong.
    """
    img = new(132, 104)
    stone = C("stone")

    # --- road through the gate, drawn first so the walls sit on it ----------
    rect(img, 44, 96, 44, 8, shade(C("dirt"), 0.9))
    for y in range(96, 104):
        for x in range(44, 88):
            if P.h01(x, y) > 0.72:
                px(img, x, y, shade(C("dirt"), 1.04))

    # --- curtain wall between the towers -----------------------------------
    body = shade(stone, 0.86)
    rect(img, 28, 44, 76, 52, body)
    courses(img, 28, 44, 76, 52, body, row_h=6, seed=44,
            mortar=shade(stone, 0.48), light=shade(stone, 1.12), dark=shade(stone, 0.62))
    # wall walk: a darker parapet with merlons along the top
    rect(img, 26, 40, 80, 6, shade(stone, 0.74))
    hline(img, 26, 40, 80, shade(stone, 1.06))
    for mx in range(28, 104, 8):
        rect(img, mx, 35, 5, 5, shade(stone, 0.92))
        hline(img, mx, 35, 5, shade(stone, 1.26))
        px(img, mx + 4, 39, shade(stone, 0.6))

    # --- the two drum towers ----------------------------------------------
    for tx, top in ((0, 20), (102, 26)):
        rect(img, tx, top, 30, 76, shade(stone, 0.94))
        courses(img, tx, top, 30, 76, shade(stone, 0.94), row_h=6, seed=tx + 7,
                mortar=shade(stone, 0.46), light=shade(stone, 1.16), dark=shade(stone, 0.6))
        # quoins on the outer edge
        for qy in range(top + 2, 94, 8):
            rect(img, tx, qy, 3, 4, shade(stone, 1.22))
            rect(img, tx + 27, qy + 4, 3, 4, shade(stone, 1.02))
        # corbelled crown with merlons
        rect(img, tx - 2, top - 6, 34, 7, shade(stone, 0.8))
        hline(img, tx - 2, top - 6, 34, shade(stone, 1.3))
        for mx in range(tx - 1, tx + 31, 6):
            rect(img, mx, top - 11, 4, 5, shade(stone, 0.9))
            hline(img, mx, top - 11, 4, shade(stone, 1.34))
        # arrow loops: tall narrow slits, two per tower
        for ax in (tx + 9, tx + 19):
            rect(img, ax, top + 16, 2, 12, C("void"))
            px(img, ax, top + 28, shade(stone, 1.24))
        # banner hung from the crown, cinched at the middle
        rect(img, tx + 12, top + 2, 6, 26, shade(C("cloth"), 0.94))
        vline(img, tx + 12, top + 2, 26, shade(C("cloth"), 1.26))
        vline(img, tx + 17, top + 2, 26, shade(C("cloth"), 0.62))
        hline(img, tx + 12, top + 15, 6, C("gold"))
        for i in range(3):                       # swallowtail
            px(img, tx + 13 + i, top + 27, (0, 0, 0, 0))
            px(img, tx + 16 - i, top + 26, (0, 0, 0, 0))

    # --- the gate: a deep arch, a raised portcullis, chains and windlass ---
    arch(img, 46, 52, 40, 52, C("void"))
    # the tunnel's inside walls, so it is a passage and not a hole
    rect(img, 48, 66, 36, 38, shade(stone, 0.32))
    for y in range(66, 100, 6):
        hline(img, 48, y, 36, shade(stone, 0.24))
    # Portcullis, half raised. Every bar is clipped to the arch's own opening:
    # drawn as a rectangle it stuck out past the curve into the wall, which read
    # as a grid hanging on the outside of the gate.
    arch_r = 20
    arch_cy = 52 + arch_r
    for bx in range(50, 84, 4):
        for yy in range(54, 79):
            if yy < arch_cy:
                dy = arch_cy - yy
                half = int((arch_r * arch_r - dy * dy) ** 0.5)
                if not (66 - half <= bx < 66 + half):
                    continue
            px(img, bx, yy, C("iron") if bx % 8 else C("iron_hi"))
    for by in range(58, 80, 6):
        for yy in (by, by + 1):
            if yy < arch_cy:
                dy = arch_cy - yy
                half = int((arch_r * arch_r - dy * dy) ** 0.5)
                hline(img, 66 - half + 1, yy, half * 2 - 2, C("iron_dk") if yy == by else C("iron"))
            else:
                hline(img, 48, yy, 36, C("iron_dk") if yy == by else C("iron"))
    # spikes on the bottom rail: the thing that says "portcullis"
    for bx in range(50, 84, 4):
        px(img, bx, 79, C("iron_hi"))
        px(img, bx, 80, C("iron_dk"))
    # chains up to the windlass, and the windlass itself above the arch
    for cx in (54, 82):
        for i in range(9):
            px(img, cx + (i % 2), 46 - i, C("iron") if i % 2 else C("iron_hi"))
    # windlass, bolted into a recess above the arch instead of floating on the
    # battlements
    rect(img, 54, 30, 28, 10, shade(stone, 0.34))
    rect(img, 56, 32, 24, 6, shade(C("wood"), 0.72))
    hline(img, 56, 32, 24, shade(C("wood"), 1.1))
    for wx in range(58, 80, 4):
        vline(img, wx, 32, 6, shade(C("wood"), 0.5))
    for bx in (56, 79):
        rect(img, bx, 30, 1, 10, C("iron_dk"))
    px(img, 68, 35, C("gold"))
    rect(img, 53, 30, 30, 1, shade(stone, 1.16))
    # voussoirs round the arch, and a keystone
    for i in range(11):
        ang = math.pi * (i / 10.0)
        vx = int(66 + 20 * math.cos(ang))
        vy = int(70 - 20 * math.sin(ang))
        rect(img, vx - 2, vy - 2, 5, 4, shade(stone, 1.02))
        hline(img, vx - 2, vy - 2, 5, shade(stone, 1.28))
    rect(img, 63, 48, 6, 5, shade(stone, 1.14))
    hline(img, 63, 48, 6, shade(stone, 1.4))

    # --- braziers flanking the gate, and the banner over the arch ---------
    # Fire stands flanking the road, on the ground in front of the wall: mounted
    # on the wall they read as brackets, which is not where a guard's fire goes.
    # The only warm light at this landmark, and it belongs inside the gate: two
    # fires on the threshold of the passage, in front of the raised portcullis.
    # Mounted on the outer wall they read as glowing boxes sunk into the stone,
    # which is what three earlier passes produced.
    for bx in (50, 78):
        rect(img, bx - 4, 98, 12, 6, shade(stone, 0.5))      # threshold slab
        hline(img, bx - 4, 98, 12, shade(stone, 0.72))
        rect(img, bx + 1, 90, 2, 8, C("iron_dk"))
        vline(img, bx + 1, 90, 8, shade(C("iron_dk"), 0.8))
        rect(img, bx - 4, 86, 11, 5, C("iron_dk"))
        hline(img, bx - 4, 86, 11, C("iron_hi"))
        hline(img, bx - 4, 90, 11, C("iron"))
        for fx in range(9):
            px(img, bx - 3 + fx, 89 - (fx % 3), C("fire_hi") if fx % 3 else C("fire"))
        for fx in (1, 4, 7):
            px(img, bx - 3 + fx, 84, C("fire"))
            px(img, bx - 3 + fx, 83, C("fire_hi"))
        px(img, bx + 1, 82, C("gold"))
        hline(img, bx - 5, 96, 13, mix(C("gold"), shade(stone, 0.5), 0.4))

    banner(img, 62, 24, 8, 14, C("cloth"))

    footprint_shadow(img, 2, 130)
    return outline_alpha(img)


def throne():
    """L10 The Castellan's Throne — a hall you can see into, not a wide facade.

    The generated frame was three towers and a green door, symmetric and closed:
    it read as a castle icon, and the level it belongs to is a *throne room*. The
    rebuild keeps the fortification but opens the centre into a lit hall, so the
    destination of the whole chapter is a place with a seat in it.
    """
    img = new(152, 128)
    stone = C("stone")

    # --- plinth and the four steps up to the hall -------------------------
    rect(img, 4, 116, 144, 12, shade(stone, 0.78))
    courses(img, 4, 116, 144, 12, shade(stone, 0.78), row_h=4, seed=61,
            mortar=shade(stone, 0.44), light=shade(stone, 1.1), dark=shade(stone, 0.56))
    for i in range(5):
        rect(img, 46 + i * 3, 114 - i * 3, 60 - i * 6, 3, shade(stone, 0.9 + i * 0.03))
        hline(img, 46 + i * 3, 114 - i * 3, 60 - i * 6, shade(stone, 1.16))

    # --- curtain wall, with the hall opened through its middle ------------
    body = shade(stone, 0.84)
    rect(img, 22, 46, 108, 70, body)
    courses(img, 22, 46, 108, 70, body, row_h=7, seed=23,
            mortar=shade(stone, 0.46), light=shade(stone, 1.12), dark=shade(stone, 0.6))
    # battlements across the top
    rect(img, 20, 42, 112, 6, shade(stone, 0.72))
    hline(img, 20, 42, 112, shade(stone, 1.04))
    for mx in range(22, 130, 9):
        rect(img, mx, 36, 6, 6, shade(stone, 0.92))
        hline(img, mx, 36, 6, shade(stone, 1.3))
        px(img, mx + 5, 41, shade(stone, 0.58))

    # --- the two outer towers ---------------------------------------------
    for tx in (2, 122):
        rect(img, tx, 24, 28, 92, shade(stone, 0.96))
        courses(img, tx, 24, 28, 92, shade(stone, 0.96), row_h=7, seed=tx + 3,
                mortar=shade(stone, 0.48), light=shade(stone, 1.16), dark=shade(stone, 0.62))
        rect(img, tx - 2, 18, 32, 8, shade(stone, 0.82))
        hline(img, tx - 2, 18, 32, shade(stone, 1.3))
        for mx in range(tx - 1, tx + 29, 6):
            rect(img, mx, 12, 4, 6, shade(stone, 0.9))
            hline(img, mx, 12, 4, shade(stone, 1.34))
        # a tall slit window and a red banner
        rect(img, tx + 12, 40, 3, 16, C("void"))
        px(img, tx + 13, 56, shade(stone, 1.22))
        rect(img, tx + 6, 26, 6, 28, shade(C("cloth"), 0.92))
        vline(img, tx + 6, 26, 28, shade(C("cloth"), 1.26))
        hline(img, tx + 6, 40, 6, C("gold"))
        for i in range(3):
            px(img, tx + 7 + i, 54 - i, (0, 0, 0, 0))

    # --- the hall: a lit interior with a dais and the seat ----------------
    # The hall is one dark mass with a *warm floor* and a *warm dais*; an inner
    # arch was tried and read as a second doorway inside the first one, and
    # vertical light shafts read as gold bars. Light is a gradient, not furniture.
    rect(img, 40, 54, 72, 62, shade(stone, 0.26))
    rect(img, 40, 54, 72, 3, shade(stone, 0.4))
    # floor: lit toward the dais, dark at the threshold
    for i in range(14):
        y = 100 + i
        t = i / 13.0
        hline(img, 44, y, 64, mix(shade(stone, 0.6), shade(stone, 0.3), t))
    for i in range(6):                       # flagstone joints on the floor
        hline(img, 44, 101 + i * 2, 64, shade(stone, 0.42))
    # the dais: three steps, then the seat itself
    for i in range(3):
        rect(img, 58 + i * 3, 98 - i * 4, 36 - i * 6, 4, shade(stone, 0.66 + i * 0.06))
        hline(img, 58 + i * 3, 98 - i * 4, 36 - i * 6, shade(stone, 0.94))
    rect(img, 68, 82, 16, 12, shade(stone, 0.84))          # throne block
    rect(img, 69, 83, 14, 4, shade(C("cloth"), 0.92))      # its cushion
    rect(img, 70, 68, 12, 15, shade(stone, 0.94))          # high back
    rect(img, 71, 69, 10, 13, shade(C("cloth"), 0.74))
    vline(img, 76, 69, 13, C("gold"))
    hline(img, 71, 71, 10, C("gold"))
    px(img, 76, 74, C("gold_hi"))
    px(img, 76, 78, C("gold_hi"))
    # A pool of light on the floor in front of the dais, not a wash up the wall:
    # the wall wash came out as a solid yellow shell.
    for i in range(7):
        w = 34 - i * 4
        hline(img, 76 - w // 2, 100 - i, w, mix(C("gold"), shade(stone, 0.44), 0.16 + 0.03 * i))
    for i in range(3):
        hline(img, 74, 97 + i, 4, mix(C("gold"), shade(stone, 0.5), 0.3))
    # a red runner down the steps and out over the threshold
    rect(img, 72, 100, 8, 20, shade(C("cloth"), 0.8))
    vline(img, 72, 100, 20, shade(C("cloth"), 1.1))
    vline(img, 79, 100, 20, shade(C("cloth"), 0.58))
    for y in range(104, 120, 4):
        hline(img, 72, y, 8, C("gold"))

    # --- two braziers on the steps, and the keystone over the arch --------
    for bx in (40, 108):
        rect(img, bx - 4, 110, 13, 8, shade(stone, 0.62))
        hline(img, bx - 4, 110, 13, shade(stone, 0.9))
        hline(img, bx - 4, 117, 13, shade(stone, 0.5))
        rect(img, bx + 1, 102, 3, 8, C("iron_dk"))
        vline(img, bx + 2, 102, 8, C("iron"))
        rect(img, bx - 4, 98, 13, 5, C("iron_dk"))
        hline(img, bx - 4, 98, 13, C("iron_hi"))
        for fx in range(10):
            px(img, bx - 3 + fx, 101 - (fx % 3), C("fire_hi") if fx % 3 else C("fire"))
        for fx in (2, 5, 8):
            px(img, bx - 3 + fx, 96, C("fire"))
            px(img, bx - 3 + fx, 95, C("fire_hi"))
    for i in range(12):
        ang = math.pi * (i / 11.0)
        vx = int(76 + 22 * math.cos(ang))
        vy = int(96 - 24 * math.sin(ang))
        rect(img, vx - 2, vy - 2, 5, 4, shade(stone, 1.04))
        hline(img, vx - 2, vy - 2, 5, shade(stone, 1.3))
    rect(img, 73, 50, 7, 6, shade(stone, 1.16))
    hline(img, 73, 50, 7, shade(stone, 1.42))

    footprint_shadow(img, 4, 148)
    return outline_alpha(img)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for name, painter in (("lm_archive", archive), ("lm_reliquary", reliquary),
                          ("lm_crucible", crucible), ("lm_relay", relay),
                          ("lm_crypt", crypt), ("lm_divided", divided),
                          ("camp_tent", camp_tent), ("camp_fire", camp_fire),
                          ("camp_bedroll", camp_bedroll), ("camp_banner", camp_banner),
                          ("lm_ossuary", ossuary), ("lm_beacon", beacon),
                          ("lm_gate", gate), ("lm_throne", throne)):
        image = painter()
        # Buildings only: the camp props are furniture that sits *in* the ground
        # band by design, and lifting them would make a tent out-read a keep.
        if name.startswith("lm_"):
            image = value_to_target(image)
        path = os.path.join(OUT, "%s.png" % name)
        image.save(path)
        print("wrote %s (%dx%d)" % (os.path.relpath(path, ROOT), image.width, image.height))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
