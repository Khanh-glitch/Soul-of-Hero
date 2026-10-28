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

    python3 tools/overworld/manual_landmarks.py   # writes the two override PNGs
"""

from __future__ import annotations

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


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for name, painter in (("lm_archive", archive), ("lm_reliquary", reliquary)):
        image = painter()
        path = os.path.join(OUT, "%s.png" % name)
        image.save(path)
        print("wrote %s (%dx%d)" % (os.path.relpath(path, ROOT), image.width, image.height))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
