#!/usr/bin/env python3
"""Stitch the Chapter 1 audit sweep back into one native, 1:1 mosaic per level.

The sweep photographs a level on an overlapping grid; this puts the frames back
where they were taken, in world coordinates, so the result is the level as the
game renders it and not a contact sheet of fragments. Because it is 1:1, any
region of a mosaic can be cropped and read at pixel scale without resampling.

Each frame is placed using the world rectangle the renderer itself reported (the
inverse of the canvas transform at draw time), never from the camera's requested
position. Where two frames overlap the stitcher also checks that the overlap
agrees, because a mosaic assembled from frames that do not agree is worse than no
mosaic: it looks like a real defect in the map.

Input:  .artifacts/audit/level_<n>/manifest.json + the frames it names
Output: <out>/L<nn>_mosaic.png      the stitched level
        <out>/L<nn>_mosaic.json     coverage, overlap agreement, frame count
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


def _rect(entry: dict) -> tuple[float, float, float, float]:
    rect = entry.get("rect")
    if rect and len(rect) == 4:
        return tuple(float(v) for v in rect)  # type: ignore[return-value]
    # Older manifests recorded a centre; keep them stitchable.
    cx, cy = entry["centre"]
    w, h = entry["size"]
    return (cx - w / 2.0, cy - h / 2.0, cx + w / 2.0, cy + h / 2.0)


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
        image = Image.open(folder / entry["file"]).convert("RGBA")
        placed.append((x0, y0, x1, y1, image))

    left = math.floor(min(p[0] for p in placed))
    top = math.floor(min(p[1] for p in placed))
    right = math.ceil(max(p[2] for p in placed))
    bottom = math.ceil(max(p[3] for p in placed))
    canvas = Image.new("RGBA", (right - left, bottom - top), (0, 0, 0, 255))
    covered = Image.new("L", canvas.size, 0)

    worst = 0.0
    checked = 0
    for x0, y0, x1, y1, image in placed:
        ox0, oy0 = int(round(x0)) - left, int(round(y0)) - top
        if image.width != int(round(x1 - x0)) or image.height != int(round(y1 - y0)):
            image = image.resize((int(round(x1 - x0)), int(round(y1 - y0))), Image.NEAREST)
        # Agreement where this frame lands on pixels an earlier frame already put
        # down. Both sides are cropped in their own coordinates.
        common = covered.crop((ox0, oy0, ox0 + image.width, oy0 + image.height))
        box = common.getbbox()
        if box is not None and (box[2] - box[0]) >= 24 and (box[3] - box[1]) >= 24:
            earlier = canvas.crop((ox0, oy0, ox0 + image.width, oy0 + image.height))
            diff = ImageChops.difference(earlier, image).convert("L")
            diff = diff.crop(box)
            worst = max(worst, ImageStat.Stat(diff).mean[0])
            checked += 1
        canvas.paste(image, (ox0, oy0))
        covered.paste(255, (ox0, oy0, ox0 + image.width, oy0 + image.height))

    content = manifest.get("content") or [left, top, right, bottom]
    region = covered.crop((content[0] - left, content[1] - top,
                           content[2] - left, content[3] - top))
    histogram = region.histogram()
    seen = sum(histogram[128:])
    total = max(1, (content[2] - content[0]) * (content[3] - content[1]))

    return {
        "canvas": canvas,
        "manifest": manifest,
        "meta": {
            "level": manifest.get("level"),
            "slot": manifest.get("slot"),
            "frames": len(placed),
            "bounds": manifest.get("bounds"),
            "limits_applied": manifest.get("limits_applied"),
            "content": content,
            "mosaic_origin": [left, top],
            "coverage_of_content": round(seen / float(total), 4),
            "mosaic_px": [canvas.width, canvas.height],
            "overlaps_checked": checked,
            "overlap_mean_abs_diff": round(worst, 2),
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
        print("audit mosaic: L%02d frames=%d coverage=%.3f px=%s limits_applied=%s"
              % (slot, result["meta"]["frames"], result["meta"]["coverage_of_content"],
                 result["meta"]["mosaic_px"], result["meta"]["limits_applied"]))
    if not written:
        print("audit mosaics: nothing to stitch")
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())
