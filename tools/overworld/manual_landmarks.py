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


def archive():
    """L03 Crossfire Archive — a broken basilica with its bell tower standing.

    The silhouette is asymmetric on purpose: tower on the left, a gable roof with
    its right third caved in, so it is never mistaken for the gate (symmetric) or
    the ossuary (low and wide). The door is the only warm pixel cluster, and the
    collapse is stepped rather than a clean rectangle — a hole with straight sides
    reads as a missing texture, a stair-stepped one reads as masonry that fell.
    """
    img = new(112, 72)
    stone = C("stone")

    # --- ground: two shallow steps, wider than the building -------------------
    rect(img, 0, 64, 112, 8, shade(stone, 0.52))
    rect(img, 4, 60, 104, 5, shade(stone, 0.66))
    hline(img, 4, 60, 104, shade(stone, 1.18))

    # --- nave wall, then a solid gable with a collapsed right third ----------
    rect(img, 20, 12, 74, 50, shade(stone, 0.88))
    courses(img, 20, 12, 74, 50, shade(stone, 0.88), row_h=6, seed=7,
            mortar=shade(stone, 0.46), light=shade(stone, 1.14), dark=shade(stone, 0.6))
    # Filled gable: peak at x=52, eaves at y=30, drawn row by row so the mass is
    # solid. Two planes (sunlit left, roof right) give it a ridge rather than an
    # outline - a one-pixel roof line reads as a stray mark at 2x zoom.
    for y in range(12, 31):
        spread = (y - 12) * 2
        left = 52 - spread
        rect(img, left, y, spread, 1, shade(stone, 0.8))
        rect(img, 52, y, spread, 1, shade(stone, 0.7))
    rect(img, 12, 30, 80, 3, shade(stone, 0.95))         # eave beam
    hline(img, 12, 33, 80, shade(stone, 1.2))
    for i in range(0, 80, 8):                            # roof tiles
        vline(img, 12 + i, 34, 3, shade(stone, 0.62))

    # --- the collapse: one stepped tear from the ridge down to the ground ----
    # A hole with vertical sides reads as a missing texture. This tears from the
    # ridge at x=76 in steps of two pixels, so the standing wall ends in a
    # staircase of masonry — which is what a collapsed bay looks like.
    for i in range(28):
        top = 16 + (i // 2) * 2 + int(2 * P.h01(11, i))
        rect(img, 76 + i, 12, 1, max(2, top - 12), (0, 0, 0, 0))
    # exposed rubble core along the broken edge
    for i in range(6):
        rect(img, 74 + i // 2, 20 + i * 4, 4, 4, shade(stone, 0.6))
    rect(img, 72, 16, 5, 46, shade(stone, 0.66))
    vline(img, 72, 16, 46, shade(stone, 1.12))
    # fallen blocks on the step, outside the wall
    for i in range(9):
        rect(img, 84 + i * 3, 56 + int(3 * P.h01(12, i)), 3, 3, shade(stone, 0.68))

    # --- bell tower: the tallest thing, left of the door ---------------------
    tower(img, 12, 8, 20, 56, 1.04, seed=3)
    rect(img, 13, 2, 18, 8, shade(stone, 0.82))          # belfry cap
    hline(img, 13, 2, 18, shade(stone, 1.15))
    for bx in (16, 21, 26):
        rect(img, bx, 4, 3, 5, C("void"))                # louvres
    rect(img, 18, 14, 8, 9, shade(stone, 0.5))           # clock recess
    px(img, 21, 17, C("bone")); px(img, 21, 18, C("bone")); px(img, 22, 18, C("bone"))

    # --- door: the one warm light in the frame ------------------------------
    door(img, 44, 40, 22, 22, glow=C("fire"))
    rect(img, 46, 42, 18, 2, shade(stone, 1.3))         # lit lintel
    rect(img, 46, 58, 18, 2, shade(C("fire"), 0.55))     # light spilling onto the step
    for i in range(9):
        px(img, 40 + i, 60 + int(2 * P.h01(13, i)), mix(C("fire"), shade(stone, 0.66), 0.55))

    # --- shelves inside the broken end, and the banner above the door --------
    for sy in (40, 50):
        rect(img, 86, sy, 16, 2, C("wood_dk"))
        for sx in range(87, 100, 3):
            rect(img, sx, sy - 3, 1, 3, C("bone_dk"))
    for i in range(2):
        rect(img, 96, 56 + i * 4, 9, 3, C("wood"))
        px(img, 98, 57 + i * 4, C("gold"))
    banner(img, 26, 34, 8, 14, C("cloth"))

    speck(img, 20, 30, 52, 32, shade(stone, 0.5), 16, seed=5)
    contact_shadow(img)
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
    """L04 Spiral Reliquary — a mound of terraces with a soul-light in its crown.

    Read from the top out: a lit monolith, three terraces stepping down and out,
    then standing stones on the lowest one. Every tier is darker than the one above
    it, and each carries a visible lit ledge, which is what makes a squat shape
    read as a mound rather than as a wall of stripes.
    """
    img = new(112, 80)
    stone = C("stone")
    cx = 56

    # --- the mound: three terraces, widest and darkest at the bottom --------
    for top, half, height, tone in ((56, 46, 24, 0.70), (36, 34, 20, 0.84), (20, 22, 16, 0.96)):
        _terrace(img, cx, top, half, height, tone, stone)
        # spiral inlay following each ledge: the relic route, read as a walk
        for step in range(-half + 6, half - 6, 11):
            px(img, cx + step, top + 2, C("bone_dk"))

    # --- the stair, climbing the face of each terrace to the crown ----------
    for top, half, height, tone in ((56, 46, 24, 0.70), (36, 34, 20, 0.84), (20, 22, 16, 0.96)):
        rect(img, cx - 5, top + 5, 10, height - 5, shade(stone, tone * 0.86))
        for step_y in range(top + 6, top + height, 3):
            hline(img, cx - 5, step_y, 10, shade(stone, tone * 1.22))

    # --- the crown: a squat monolith, not a floating obelisk ----------------
    rect(img, cx - 9, 8, 18, 13, shade(stone, 1.1))
    rect(img, cx - 7, 3, 14, 6, shade(stone, 1.18))
    hline(img, cx - 7, 3, 14, shade(stone, 1.5))
    vline(img, cx - 9, 8, 13, shade(stone, 1.44))
    vline(img, cx + 8, 8, 13, shade(stone, 0.64))
    rect(img, cx - 9, 21, 18, 4, shade(stone, 0.7))      # base step
    # the soul-light burning in the crown
    rect(img, cx - 1, 7, 3, 15, mix(C("soul_glow"), C("void"), 0.4))
    rect(img, cx, 7, 1, 15, C("soul_glow"))
    for i in range(4):
        px(img, cx - 3 - (i % 2), 10 + i * 3, mix(C("soul_glow"), C("void"), 0.7))
        px(img, cx + 3 + (i % 2), 11 + i * 3, mix(C("soul_glow"), C("void"), 0.78))

    # --- standing stones ringing the lowest terrace -------------------------
    for sx, tone, height in ((10, 0.8, 18), (20, 0.74, 13), (86, 0.74, 13), (96, 0.8, 18)):
        rect(img, sx, 66 - height, 6, height, shade(stone, tone))
        hline(img, sx, 66 - height, 6, shade(stone, tone * 1.34))
        px(img, sx + 2, 68 - height, C("bone_dk"))

    # --- offerings on the flights ------------------------------------------
    for i in range(5):
        px(img, 44 + i * 2, 72 + (i % 2), C("bone"))
    px(img, 64, 60, C("gold"))
    px(img, 34, 52, C("cloth"))

    speck(img, 4, 56, 104, 22, shade(stone, 0.42), 22, seed=9)
    speck(img, 24, 22, 64, 12, shade(stone, 0.52), 12, seed=10)
    contact_shadow(img)
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
