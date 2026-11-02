#!/usr/bin/env python3
"""Art-quality measurements for the overworld atlas, with thresholds that fail.

Every number here came out of a defect that was only found by looking at a
render. The point of the script is that the next pass finds them without a
human:

    static     adjacent-pixel luma jumps on a surface assembled the way the game
               assembles one (different variants on the 3-tile lattice, each tile
               mirrored by the per-tile hash). A surface made of one high-contrast
               tone pair scores high and reads as television snow at the camera's
               2x zoom. The path dither was 42 %; the road verge was 13 %.
    lattice    how strongly a family repeats on the same 3-tile lattice. 100 %
               means a perfect lattice, i.e. the variants are near-identical.
    line       the longest straight run inside one tile, from 0 to 100 % of its
               columns. This is the defect that shipped twice - two planks in
               `solid_cliff`, stratified `ground_rock` - and it is invisible in a
               16x16 swatch: tile it up and the world grows a terrace or a field
               of parallel scratches.
    value      median luminance of the ground band against the landmark props.
               Front props must sit *above* the ground or a destination stops
               reading as a destination - which is what the measurement found
               in the painted exteriors, at 0.315 against a 0.356 ground.

Thresholds are calibrated against the atlas as it stands, with headroom, so this
catches a regression of the kind the last pass shipped rather than judging a
deliberate restyle.

    python3 tools/overworld/art_quality.py            # report + gate
    python3 tools/overworld/art_quality.py --report   # report only
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ART = os.path.join(ROOT, "assets", "environment", "overworld")
DATA = os.path.join(ROOT, "data", "overworld")

TILE_FAMILIES = (
    "dirt", "grass", "moor", "gravel", "rock", "ash", "mud", "water", "shallow",
    "cliff_top", "bog",
)
OVERLAY_FAMILIES = ("road_dirt", "road_stone", "path")
SOLID_FAMILIES = ("cliff", "wall", "canopy", "blocker", "rubble")

# Worst current family in each layer: ground 15.9 % (rock, a genuinely broken
# stone field), overlay 20.6 % (road_stone), solid 32.5 % (the cliff face, which
# has to carry a lit rim). The gate sits just above the worst and well below the
# values that were actually wrong.
MAX_STATIC = {"ground": 18.0, "overlay": 23.0, "solid": 34.0}

# Worst current: ground 91 % (cliff_top), overlay 84 % (path), solid 71 %
# (canopy). Anything near 100 % on a multi-variant family means the variants are
# near-identical and the 3-tile lattice is visible.
MAX_LATTICE = {"ground": 92.0, "overlay": 92.0, "solid": 92.0}

# Loose textured ground lands at 0-50 %; a drawn line lands at 70-100 %.
MAX_SHELF = {"ground": 60.0, "overlay": 60.0, "solid": 100.0}

# Families that are straight on purpose: a road is a strip with a cross-section,
# a masonry course is level by construction, and the cliff's edge variants must
# carry a lit rim - that rim is what makes a drop readable. Measured and reported
# anyway, just not gated.
LINE_ALLOWED = {"road_dirt": 100.0, "road_stone": 100.0, "wall": 100.0,
                "cliff": 100.0}

MIN_PROP_OVER_GROUND = 0.01


def _load():
    sheet = Image.open(os.path.join(ART, "overworld_tiles.png")).convert("RGBA")
    meta = json.load(open(os.path.join(DATA, "overworld_tiles.json")))
    props = Image.open(os.path.join(ART, "overworld_props.png")).convert("RGBA")
    props_meta = json.load(open(os.path.join(DATA, "overworld_props.json")))["frames"]
    return sheet, meta, props, props_meta


def _frames_of(index, family):
    """Frames of one family: `dirt0..dirt4`, `road_dirt#3`, `cliff#15`."""
    out = []
    for name, rect in index.items():
        if name == family or name.startswith(family + "#"):
            out.append((name, rect))
        elif name.startswith(family) and name[len(family):].isdigit():
            out.append((name, rect))
    return out


def _static_share(img):
    """Share of horizontally adjacent pixel pairs differing by >18 luma."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    total = 0
    hot = 0
    for y in range(h):
        prev = None
        for x in range(w):
            r, g, b = px[x, y]
            lum = (r * 299 + g * 587 + b * 114) // 1000
            if prev is not None:
                total += 1
                if abs(lum - prev) > 18:
                    hot += 1
            prev = lum
    return 100.0 * hot / max(1, total)


def _luma(img):
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    total = 0
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            total += (r * 299 + g * 587 + b * 114) // 1000
            n += 1
    return total / max(1, n) / 255.0


def _lattice(img, period=48):
    """How strongly the surface repeats on the variant lattice, as a percentage.

    `period` is three tiles, because `OverworldTiles.variant_index` picks a
    variant per 3x3 block: unless something decorrelates inside the block, the
    same tile is drawn nine times and the surface matches itself exactly at that
    offset. 100 % means a perfect lattice (the worst case), 0 % means the shifted
    copy is as different as any two unrelated pixels.
    """
    gray = img.convert("L")
    w, h = gray.size
    px = gray.load()
    diffs = []
    for y in range(h):
        for x in range(w - period):
            diffs.append(abs(px[x, y] - px[x + period, y]))
    if not diffs:
        return 0.0
    mean = sum(diffs) / len(diffs)
    return max(0.0, 100.0 * (1.0 - mean / 40.0))


def _line_share(img, jump=26):
    """Longest straight run inside one tile, as the share of pixels that jump.

    Counted in both axes, because a full-height lit crack is the vertical twin of
    a full-width shelf. Rows and columns within two of the tile edge are skipped
    (a masked family's alpha boundary is not a line), and so are pixels that
    touch transparency.
    """
    gray = img.convert("L")
    alpha = img.convert("RGBA")
    w, h = gray.size
    gx = gray.load()
    ap = alpha.load()

    def opaque(x, y):
        return ap[x, y][3] > 250

    best = 0.0
    for axis in (0, 1):
        span = h if axis == 0 else w
        run = w if axis == 0 else h
        for pos in range(2, max(3, span - 2)):
            hot = 0
            counted = 0
            for k in range(run):
                x, y = (k, pos) if axis == 0 else (pos, k)
                x0, y0 = (k, pos - 1) if axis == 0 else (pos - 1, k)
                if not (opaque(x, y) and opaque(x0, y0)):
                    continue
                counted += 1
                if abs(gx[x, y] - gx[x0, y0]) > jump:
                    hot += 1
            if counted >= run // 2:
                best = max(best, hot / counted)
    return best * 100.0


def _family_surface(frames, crop, size=4):
    """A surface built the way the game builds one: *different variants* of the
    family laid out on the 3x3 variant lattice, each tile also mirrored by the
    per-tile hash. Replicating one tile instead would answer a different and much
    easier question - "does this tile equal itself" - and every family would fail
    it.
    """
    if not frames:
        return None
    tiles = [crop(rect) for _name, rect in frames]
    w, h = tiles[0].size
    out = Image.new("RGBA", (w * size, h * size), (108, 88, 62, 255))
    for j in range(size):
        for i in range(size):
            tile = tiles[(i + j * 2 + (i * j) % len(tiles)) % len(tiles)]
            flip = (i * 374761393 ^ j * 668265263) % 4
            if flip & 1:
                tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
            if flip & 2:
                tile = tile.transpose(Image.FLIP_TOP_BOTTOM)
            out.alpha_composite(tile, (i * w, j * h))
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="print, do not gate")
    args = parser.parse_args()

    sheet, meta, props, props_meta = _load()
    index = meta["index"]
    failures: list[str] = []
    rows: list[tuple[str, str, float, float, float, int]] = []

    def crop(rect):
        x, y, w, h = rect
        return sheet.crop((x, y, x + w, y + h))

    for kind, families in (("ground", TILE_FAMILIES), ("overlay", OVERLAY_FAMILIES),
                           ("solid", SOLID_FAMILIES)):
        for family in families:
            frames = _frames_of(index, family)
            if not frames:
                continue
            surface = _family_surface(frames, crop)
            if surface is None:
                continue
            # Blank frames are deliberate: `blocker` is pure collision, never
            # drawn. There is no art to judge, so it is reported but not gated -
            # its alpha is asserted by the static tile contracts instead.
            blank = all(crop(rect).getextrema()[3][1] == 0 for _n, rect in frames)
            values = [_static_share(surface)]
            lattices = [_lattice(surface)]
            shelves = []
            for name, rect in frames:
                tile = _family_surface([(name, rect)] * len(frames), crop)
                values.append(_static_share(tile))
                lattices.append(_lattice(tile))
                shelves.append(_line_share(crop(rect)))
            worst_static = max(values)
            med_lattice = statistics.median(lattices)
            worst_shelf = max(shelves)
            rows.append((kind, family, worst_static, med_lattice, worst_shelf,
                         len(frames)))
            if blank:
                continue
            if worst_static > MAX_STATIC[kind]:
                failures.append("%s/%s: static %.1f%% > %.1f%%"
                                % (kind, family, worst_static, MAX_STATIC[kind]))
            line_cap = LINE_ALLOWED.get(family, MAX_SHELF[kind])
            if worst_shelf > line_cap:
                failures.append("%s/%s: a straight line spans %.0f%% of the tile "
                                "(> %.0f%%)" % (kind, family, worst_shelf, line_cap))
            if med_lattice > MAX_LATTICE[kind]:
                failures.append("%s/%s: 3-tile lattice %.0f%% > %.0f%%"
                                % (kind, family, med_lattice, MAX_LATTICE[kind]))

    print("%-9s %-12s %8s %9s %7s %6s"
          % ("layer", "family", "static", "lattice", "line", "frames"))
    for kind, family, static, lattice, shelf, count in rows:
        flag = ""
        if static > MAX_STATIC[kind]:
            flag += " STATIC!"
        if shelf > LINE_ALLOWED.get(family, MAX_SHELF[kind]):
            flag += " LINE!"
        if lattice > MAX_LATTICE[kind]:
            flag += " LATTICE!"
        print("%-9s %-12s %7.1f%% %8.0f%% %6.0f%% %6d%s"
              % (kind, family, static, lattice, shelf, count, flag))

    # --- value separation: front props must read above the ground -------------
    ground_lumas = []
    for family in TILE_FAMILIES:
        for _name, rect in _frames_of(index, family):
            ground_lumas.append(_luma(crop(rect)))
    landmark_lumas = []
    for name, rect in props_meta.items():
        if not name.startswith("lm_"):
            continue
        x, y, w, h = rect["x"], rect["y"], rect["w"], rect["h"]
        tile = props.crop((x, y, x + w, y + h))
        px = tile.load()
        vals = []
        for yy in range(tile.height):
            for xx in range(tile.width):
                if px[xx, yy][3] > 128:
                    r, g, b, _a = px[xx, yy]
                    vals.append((r * 299 + g * 587 + b * 114) // 1000)
        if vals:
            landmark_lumas.append(sum(vals) / len(vals) / 255.0)
    # Medians, not means: a landmark's silhouette includes black windows and dark
    # interiors, which drag its mean down below the stone it is built from, and
    # the claim being tested is about the *mass* of the building. The ground side
    # is likewise a median over every ground family.
    ground_med = statistics.median(ground_lumas) if ground_lumas else 0.0
    prop_med = statistics.median(landmark_lumas) if landmark_lumas else 0.0
    delta = prop_med - ground_med
    print("\nvalue: ground median %.3f, landmark props median %.3f, separation %+.3f"
          % (ground_med, prop_med, delta))
    if delta < MIN_PROP_OVER_GROUND:
        failures.append("landmark props read too close to the ground (%+.3f < +%.2f)"
                        % (delta, MIN_PROP_OVER_GROUND))

    if args.report:
        return 0
    if failures:
        print("\nART QUALITY FAILED:")
        for failure in failures:
            print("  " + failure)
        return 1
    print("\nART QUALITY PASSED - %d families inside their bands" % len(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
