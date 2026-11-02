#!/usr/bin/env python3
"""Assemble the Chapter 1 visual-overhaul evidence tree.

Input:  .artifacts/chapter1/<level_id>/{after,before}/<tag>_<station>.png
        (written by tools/captures/chapter1_visual_capture.tscn, native Godot)
Output: docs/chapter1-visual-overhaul/
          L01/..L10/  native frames, before/after pairs, 3x crops, REVIEW.md
          gallery/    per-level strip and one chapter-wide sheet
          INDEX.md, BASELINES.md (written by the workflow, not here)

Nothing is drawn that did not come out of the engine: this tool only crops,
pairs, labels and lays out the native frames it is handed. Crops are integer
nearest-neighbour so no pixel is invented.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "chapter1-visual-overhaul"
ARTIFACTS = ROOT / ".artifacts" / "chapter1"
CROP_SCALE = 3
CROP_SIZE = 320


def _index() -> dict:
    return json.loads((ROOT / "data" / "environment" / "chapter1" / "chapter_index.json").read_text())


def _font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def _label(image: Image.Image, text: str, height: int = 20) -> Image.Image:
    canvas = Image.new("RGB", (image.width, image.height + height), (10, 8, 12))
    canvas.paste(image.convert("RGB"), (0, height))
    ImageDraw.Draw(canvas).text((6, 3), text, font=_font(13), fill=(240, 232, 226))
    return canvas


def _load(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    with Image.open(path) as handle:
        return handle.convert("RGB")


def _save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def _stations(level_id: str, tag: str) -> list[str]:
    directory = ARTIFACTS / level_id / tag
    if not directory.is_dir():
        return []
    prefix = tag + "_"
    return sorted(path.stem[len(prefix):] for path in directory.glob(prefix + "*.png"))


def build_level(entry: dict, out_dir: Path) -> dict:
    level_id = entry["level_id"]
    folder = out_dir / entry["folder"]
    images = folder / "images"
    images.mkdir(parents=True, exist_ok=True)
    after = {station: _load(ARTIFACTS / level_id / "after" / ("after_%s.png" % station))
             for station in _stations(level_id, "after")}
    before = {station: _load(ARTIFACTS / level_id / "before" / ("before_%s.png" % station))
              for station in _stations(level_id, "before")}
    stations = [station for station in after if after[station] is not None]
    if not stations:
        return {"slot": entry["slot"], "level_id": level_id, "status": "NOT ATTEMPTED", "stations": []}

    for station in stations:
        _save(after[station], images / ("after_%s.png" % station))
        if before.get(station) is not None:
            _save(before[station], images / ("before_%s.png" % station))
            pair = Image.new("RGB", (after[station].width * 2 + 8, after[station].height), (10, 8, 12))
            pair.paste(before[station], (0, 0))
            pair.paste(after[station], (after[station].width + 8, 0))
            _save(_label(pair, "BEFORE (same map, art layer off)   |   AFTER (%s)" % entry["title"]),
                  images / ("pair_%s.png" % station))
        if station in ("entry", "landmark", "boss", "exit"):
            crop = after[station].crop((320, 150, 320 + CROP_SIZE, 150 + CROP_SIZE // 2))
            crop = crop.resize((crop.width * CROP_SCALE, crop.height * CROP_SCALE), Image.NEAREST)
            _save(_label(crop, "%dx nearest crop (native pixels) — %s / %s" % (CROP_SCALE, entry["title"], station)),
                  images / ("crop3x_%s.png" % station))
    return {"slot": entry["slot"], "level_id": level_id, "status": "PENDING", "stations": stations}


def build_gallery(results: list[dict], out_dir: Path) -> None:
    gallery = out_dir / "gallery"
    gallery.mkdir(parents=True, exist_ok=True)
    thumbs = []
    for result in results:
        entry = next(e for e in _index()["levels"] if e["level_id"] == result["level_id"])
        if "entry" not in result["stations"]:
            continue
        image = _load(ARTIFACTS / result["level_id"] / "after" / "after_entry.png")
        if image is None:
            continue
        thumb = image.resize((480, 270), Image.NEAREST)
        thumbs.append(_label(thumb, "L%02d %s — %s" % (result["slot"], entry["title"], result["status"]), 18))
    if not thumbs:
        return
    columns = 2
    rows = (len(thumbs) + columns - 1) // columns
    cell_w, cell_h = thumbs[0].width, thumbs[0].height
    sheet = Image.new("RGB", (columns * cell_w + (columns + 1) * 6, rows * cell_h + (rows + 1) * 6), (12, 10, 14))
    for position, thumb in enumerate(thumbs):
        column, row = position % columns, position // columns
        sheet.paste(thumb, (6 + column * (cell_w + 6), 6 + row * (cell_h + 6)))
    _save(_label(sheet, "Chapter 1 visual overhaul — one AFTER frame per level (native 1280x720, halved)"),
          gallery / "chapter1_after_overview.png")


def build_comparison(results: list[dict], out_dir: Path) -> None:
    """BEFORE/AFTER pairs for Levels 5-10, the block the sprint started from."""
    gallery = out_dir / "gallery"
    rows = []
    for result in results:
        if result["slot"] < 5:
            continue
        entry = next(e for e in _index()["levels"] if e["level_id"] == result["level_id"])
        before = _load(ARTIFACTS / result["level_id"] / "before" / "before_entry.png")
        after = _load(ARTIFACTS / result["level_id"] / "after" / "after_entry.png")
        if before is None or after is None:
            continue
        before = before.resize((420, 236), Image.NEAREST)
        after = after.resize((420, 236), Image.NEAREST)
        row = Image.new("RGB", (420 * 2 + 24, 236 + 26), (12, 10, 14))
        row.paste(_label(before, "L%02d BEFORE — art layer off" % result["slot"], 14), (6, 20))
        row.paste(_label(after, "L%02d AFTER — %s" % (result["slot"], entry["title"]), 14), (438, 20))
        rows.append(row)
    if not rows:
        return
    width = max(row.width for row in rows)
    height = sum(row.height + 6 for row in rows)
    sheet = Image.new("RGB", (width + 12, height + 12), (12, 10, 14))
    y = 6
    for row in rows:
        sheet.paste(row, (6, y))
        y += row.height + 6
    _save(_label(sheet, "Levels 5-10 — same map, presentation layer off (left) vs on (right)"),
          gallery / "level5_to_10_comparison.png")


def write_reviews(results: list[dict], out_dir: Path) -> None:
    for result in results:
        entry = next(e for e in _index()["levels"] if e["level_id"] == result["level_id"])
        folder = out_dir / entry["folder"]
        folder.mkdir(parents=True, exist_ok=True)
        stations = ", ".join(result["stations"]) or "none captured"
        (folder / "REVIEW.md").write_text(
            "# L%02d — %s\n\n"
            "**Status: `%s`**\n\n"
            "| Level id | Map source | Theme | Stations |\n"
            "| --- | --- | --- | --- |\n"
            "| `%s` | `data/levels/%s` | `data/environment/chapter1/%s.json` | %s |\n\n"
            "Native frames: `images/after_*.png` (1280x720, Godot 4.7), pairs in\n"
            "`images/pair_*.png` where a BEFORE station exists. BEFORE runs the same\n"
            "map, geometry and entities with the presentation layer disabled.\n"
            % (result["slot"], entry["title"], result["status"], entry["level_id"],
               entry["map"], entry["level_id"], stations),
            encoding="utf-8",
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(DOCS))
    args = parser.parse_args()
    out_dir = Path(args.out)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    index = _index()
    results = [build_level(entry, out_dir) for entry in index["levels"]]
    # Status is the workflow's call, not this tool's: a level that produced
    # frames is at best a candidate for review, never self-accepted.
    for result in results:
        if result["status"] == "PENDING":
            result["status"] = "CANDIDATE — pending human review"
    build_gallery(results, out_dir)
    build_comparison(results, out_dir)
    write_reviews(results, out_dir)
    (out_dir / "gallery" / "status.json").write_text(
        json.dumps(results, indent=2) + "\n", encoding="utf-8")
    captured = sum(1 for result in results if result["stations"])
    print("LEVELS %d/%d with native frames" % (captured, len(results)))
    for result in results:
        print("  L%02d %-20s %s (%d stations)"
              % (result["slot"], result["level_id"], result["status"], len(result["stations"])))
    return 0 if captured else 1


if __name__ == "__main__":
    sys.exit(main())
