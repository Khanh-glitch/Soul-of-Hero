#!/usr/bin/env python3
"""Stitch the Chapter 1 audit sweep back into one native mosaic per level.

The sweep photographs a level on an overlapping grid; this puts the frames back
where they were taken, in world coordinates, so the result is the level as the
game composes it and not a contact sheet of fragments.

Two rules keep the output honest:

  * A frame is placed by the world rectangle the renderer itself reported (the
    inverse canvas transform at draw time), never by the camera's requested
    position. Those two disagree the moment a camera limit clamps the view, and
    a mosaic built from the wrong one invents seams that look like map defects.
  * Where two frames overlap they must agree, pixel for pixel. The worst
    disagreement is written into the metadata. A mosaic whose frames disagree is
    not a picture of the level.

The chapter renders to a 640x360 canvas that the window upscales, so a screenshot
is 2x the world. Frames are reduced by that integer factor with nearest-neighbour
sampling, which is lossless: one mosaic pixel is one art pixel, the resolution the
tiles were drawn at.

Input:  .artifacts/audit/level_<n>/manifest.json + the frames it names
Output: <out>/L<nn>_mosaic.png           the stitched level, 1 mosaic px = 1 art px
        <out>/L<nn>_mosaic.json          frames, coverage, overlap agreement
        <out>/manifests/level_<n>.json   the manifest, for provenance

Usage: python3 tools/chapter1_audit/audit_sheets.py [--artifacts .artifacts/audit]
                                                   [--out docs/chapter1-audit]
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

MIN_OVERLAP = 16
SHIFT_SEARCH = 4


def _rect(entry: dict) -> tuple[float, float, float, float]:
    rect = entry.get("rect")
    if rect and len(rect) == 4:
        return tuple(float(v) for v in rect)  # type: ignore[return-value]
    cx, cy = entry["centre"]  # very old manifests
    w, h = entry["size"]
    return (cx - w / 2.0, cy - h / 2.0, cx + w / 2.0, cy + h / 2.0)


def _disagreement(earlier: Image.Image, later: Image.Image,
                  box: tuple[int, int, int, int]) -> tuple[float, int]:
    """How far apart two overlapping frames are, and by how many pixels.

    Absolute brightness is not a fair test: torches flicker between frames, so a
    perfectly aligned pair still differs. The question being asked is different —
    is the *structure* in the same place. So the pair is compared over a small
    shift search; if the smallest difference sits at zero offset, the stitching
    is exact and whatever is left is animated light.
    """
    left, top, right, bottom = box
    pad = SHIFT_SEARCH
    core = earlier.convert("L").crop((left + pad, top + pad, right - pad, bottom - pad))
    if core.width < 8 or core.height < 8:
        return 0.0, 0
    best = None
    best_shift = 0
    grey = later.convert("L")
    for dy in range(-pad, pad + 1):
        for dx in range(-pad, pad + 1):
            moved = grey.crop((left + pad + dx, top + pad + dy,
                               right - pad + dx, bottom - pad + dy))
            score = ImageStat.Stat(ImageChops.difference(core, moved)).mean[0]
            if best is None or score < best - 1e-9:
                best, best_shift = score, max(abs(dx), abs(dy))
    return float(best or 0.0), best_shift


def stitch(folder: Path) -> dict | None:
    manifest_path = folder / "manifest.json"
    if not manifest_path.exists():
        return None
    manifest = json.loads(manifest_path.read_text())
    frames = [entry for entry in manifest.get("frames", [])
              if (folder / entry["file"]).exists()]
    if not frames:
        return None

    placed = []
    for entry in frames:
        x0, y0, x1, y1 = _rect(entry)
        image = Image.open(folder / entry["file"]).convert("RGB")
        world_w, world_h = entry.get("world_size") or (x1 - x0, y1 - y0)
        factor = max(1, int(round(image.width / max(1e-6, world_w))))
        if factor > 1:
            image = image.resize((int(round(image.width / factor)),
                                  int(round(image.height / factor))), Image.NEAREST)
        placed.append((x0, y0, x1, y1, image))

    left = math.floor(min(p[0] for p in placed))
    top = math.floor(min(p[1] for p in placed))
    right = math.ceil(max(p[2] for p in placed))
    bottom = math.ceil(max(p[3] for p in placed))
    canvas = Image.new("RGB", (right - left, bottom - top), (0, 0, 0))
    covered = Image.new("L", canvas.size, 0)

    checked = 0
    worst = 0.0
    worst_shift = 0
    for x0, y0, x1, y1, image in placed:
        ox, oy = int(round(x0)) - left, int(round(y0)) - top
        if image.size != (int(round(x1 - x0)), int(round(y1 - y0))):
            image = image.resize((int(round(x1 - x0)), int(round(y1 - y0))), Image.NEAREST)
        already = covered.crop((ox, oy, ox + image.width, oy + image.height))
        box = already.getbbox()
        if box is not None and (box[2] - box[0]) >= MIN_OVERLAP and (box[3] - box[1]) >= MIN_OVERLAP:
            earlier = canvas.crop((ox, oy, ox + image.width, oy + image.height))
            diff, shift = _disagreement(earlier, image, box)
            worst = max(worst, diff)
            worst_shift = max(worst_shift, shift)
            checked += 1
        canvas.paste(image, (ox, oy))
        covered.paste(255, (ox, oy, ox + image.width, oy + image.height))

    content = manifest.get("content") or [left, top, right, bottom]
    region = covered.crop((content[0] - left, content[1] - top,
                           content[2] - left, content[3] - top))
    seen = sum(region.histogram()[128:])
    total = max(1, (content[2] - content[0]) * (content[3] - content[1]))

    return {
        "canvas": canvas,
        "manifest": manifest,
        "meta": {
            "level": manifest.get("level"),
            "slot": manifest.get("slot"),
            "frames": len(placed),
            "bounds": manifest.get("bounds"),
            "content": content,
            "world_view": manifest.get("world_view"),
            "limits_applied": manifest.get("limits_applied"),
            "mosaic_origin": [left, top],
            "mosaic_px": [canvas.width, canvas.height],
            "coverage_of_content": round(seen / float(total), 4),
            "overlaps_checked": checked,
            # Residual after aligning the frames: torches flicker, so this is not
            # zero on a correct mosaic, but the shift that produces it must be 0.
            "overlap_best_diff": round(worst, 2),
            "overlap_worst_shift_px": worst_shift,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", default=".artifacts/audit")
    parser.add_argument("--out", default="docs/chapter1-audit")
    args = parser.parse_args()

    root = Path(args.artifacts)
    out = Path(args.out)
    (out / "manifests").mkdir(parents=True, exist_ok=True)
    written = 0
    for folder in sorted(root.glob("level_*")):
        result = stitch(folder)
        if result is None:
            continue
        slot = int(result["meta"]["slot"])
        result["canvas"].save(out / ("L%02d_mosaic.png" % slot), optimize=True)
        (out / ("L%02d_mosaic.json" % slot)).write_text(
            json.dumps(result["meta"], indent=2) + "\n")
        (out / "manifests" / ("level_%d.json" % slot)).write_text(
            json.dumps(result["manifest"], indent=2) + "\n")
        written += 1
        print("audit mosaic: L%02d frames=%d coverage=%.3f px=%s overlaps=%d shift=%dpx limits=%s"
              % (slot, result["meta"]["frames"], result["meta"]["coverage_of_content"],
                 result["meta"]["mosaic_px"], result["meta"]["overlaps_checked"],
                 result["meta"]["overlap_worst_shift_px"], result["meta"]["limits_applied"]))
    if not written:
        print("audit mosaics: nothing to stitch")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
