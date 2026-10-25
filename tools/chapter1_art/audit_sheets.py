#!/usr/bin/env python3
"""Stitch the Chapter 1 audit sweep back into one native, 1:1 mosaic per level.

The sweep photographs a level on an overlapping grid; this puts the frames back
where they were taken, in map coordinates, so the result is the level as the game
renders it and not a contact sheet of fragments. Because it is 1:1, any region of
a mosaic can be cropped and read at pixel scale without resampling.

Input:  .artifacts/audit/level_<n>/manifest.json + the frames it names
Output: <out>/L<nn>_mosaic.png   the stitched level
        <out>/L<nn>_mosaic.json  coverage, frame count, bounds, content rect

Usage: python3 tools/chapter1_art/audit_sheets.py [--artifacts .artifacts/audit]
                                                 [--out docs/chapter1-audit]
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image


def stitch(folder: Path) -> dict | None:
    manifest_path = folder / "manifest.json"
    if not manifest_path.exists():
        return None
    manifest = json.loads(manifest_path.read_text())
    frames = manifest.get("frames", [])
    if not frames:
        return None

    xs0 = min(entry["centre"][0] - entry["size"][0] // 2 for entry in frames)
    ys0 = min(entry["centre"][1] - entry["size"][1] // 2 for entry in frames)
    xs1 = max(entry["centre"][0] + entry["size"][0] // 2 for entry in frames)
    ys1 = max(entry["centre"][1] + entry["size"][1] // 2 for entry in frames)
    width, height = xs1 - xs0, ys1 - ys0

    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    covered = Image.new("L", (width, height), 0)
    placed = 0
    for entry in frames:
        path = folder / entry["file"]
        if not path.exists():
            continue
        image = Image.open(path).convert("RGBA")
        x = entry["centre"][0] - entry["size"][0] // 2 - xs0
        y = entry["centre"][1] - entry["size"][1] // 2 - ys0
        canvas.paste(image, (x, y))
        covered.paste(255, (x, y, x + image.width, y + image.height))
        placed += 1

    content = manifest.get("content") or [xs0, ys0, xs1, ys1]
    cw = max(1, content[2] - content[0])
    ch = max(1, content[3] - content[1])
    region = covered.crop((content[0] - xs0, content[1] - ys0,
                           content[2] - xs0, content[3] - ys0))
    histogram = region.histogram()
    seen = sum(histogram[128:])
    total = cw * ch

    return {
        "canvas": canvas,
        "meta": {
            "level": manifest.get("level"),
            "slot": manifest.get("slot"),
            "frames": placed,
            "bounds": manifest.get("bounds"),
            "content": content,
            "mosaic_origin": [xs0, ys0],
            "coverage_of_content": round(seen / float(total), 4),
            "mosaic_px": [width, height],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", default=".artifacts/audit")
    parser.add_argument("--out", default="docs/chapter1-audit")
    args = parser.parse_args()

    root = Path(args.artifacts)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for folder in sorted(root.glob("level_*")):
        result = stitch(folder)
        if result is None:
            continue
        slot = int(result["meta"]["slot"])
        image_path = out / ("L%02d_mosaic.png" % slot)
        meta_path = out / ("L%02d_mosaic.json" % slot)
        result["canvas"].save(image_path, optimize=True)
        meta_path.write_text(json.dumps(result["meta"], indent=2) + "\n")
        written.append((slot, image_path.name, result["meta"]))
        print("audit mosaic: L%02d frames=%d coverage=%.3f px=%s"
              % (slot, result["meta"]["frames"], result["meta"]["coverage_of_content"],
                 result["meta"]["mosaic_px"]))
    if not written:
        print("audit mosaics: nothing to stitch")
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())
