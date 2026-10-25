#!/usr/bin/env python3
"""Assemble docs/chapter1-visual-overhaul/architecture-breakthrough/.

Native frames come from .artifacts/crucible/{after,before} (written by
tools/captures/crucible_capture.gd during the workflow). This script only pairs,
crops, labels and indexes them; it never invents a frame.

Everything it writes is labelled:
  * L05/images/*_after_*.png    native Godot frames
  * L05/images/pair_*.png       native before | native after
  * L05/comparisons/*           native after next to the two gold references
  * L05/crops/*                 integer-scaled crops of native frames
  * preview/                    PIL COMPOSITION PREVIEWS - never gameplay evidence
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".artifacts" / "crucible"
DOCS = ROOT / "docs" / "chapter1-visual-overhaul" / "architecture-breakthrough"
L05 = DOCS / "L05"
GOLD = [
    (ROOT / "docs" / "gate2" / "evidence" / "after_archive_entry.png", "GOLD A - Gate 2 Archive"),
    (ROOT / "prototypes" / "environment_art" / "archive_audition" / "captures" / "archive_room_end.png",
     "GOLD B - Monastic Archive"),
]
REJECTED = ROOT / "docs" / "chapter1-visual-overhaul" / "L05" / "images" / "after_entry.png"

FONT_LINE = 16


def _load(path: Path):
    if not path.exists():
        return None
    return Image.open(path).convert("RGB")


def _save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def _label(image: Image.Image, text: str, height: int = 20, scale: int = 1) -> Image.Image:
    """Put a caption bar above an image. Never used to imply the picture is a
    render when it is not: the caption says what the picture is."""
    band = Image.new("RGB", (image.width, height), (10, 8, 10))
    draw = ImageDraw.Draw(band)
    draw.text((6, 4), text, fill=(255, 232, 160))
    out = Image.new("RGB", (image.width, image.height + height), (10, 8, 10))
    out.paste(band, (0, 0))
    out.paste(image, (0, height))
    return out


def _hstack(images: list, gap: int = 8) -> Image.Image:
    if not images:
        return None
    width = sum(i.width for i in images) + gap * (len(images) - 1)
    height = max(i.height for i in images)
    out = Image.new("RGB", (width, height), (10, 8, 10))
    x = 0
    for image in images:
        out.paste(image, (x, 0))
        x += image.width + gap
    return out


def _stations(log: Path) -> dict:
    """Rows the harness printed, so the review can quote what was actually shot."""
    rows = {}
    if not log.exists():
        return rows
    text = log.read_text(errors="replace")
    for match in re.finditer(
            r"CRUCIBLE STATION tag=(\w+) station=(\w+) cell=\(([-\d]+), ([-\d]+)\) zoom=([\d.]+) out=(\S+) ok=(\w+)(.*)",
            text):
        rows[match.group(2)] = {
            "tag": match.group(1), "cell": [int(match.group(3)), int(match.group(4))],
            "zoom": float(match.group(5)), "ok": match.group(7) == "True",
            "extra": match.group(8).strip(),
        }
    return rows


def _capture_summary(log: Path) -> dict:
    if not log.exists():
        return {}
    text = log.read_text(errors="replace")
    out = {}
    summary = re.search(
        r"CRUCIBLE CAPTURE: level=(\S+) art=(\w+) wall_cells=(\d+) props=(\d+) lights=(\d+) entities=(\d+)",
        text)
    if summary:
        out.update(level=summary.group(1), art=summary.group(2), walls=int(summary.group(3)),
                   props=int(summary.group(4)), lights=int(summary.group(5)),
                   entities=int(summary.group(6)))
    perf = re.search(r"CRUCIBLE PERF: art=(\w+) nodes=(\d+) draw_calls=(\d+) static_mb=([\d.]+) fps=(\d+)", text)
    if perf:
        out.update(perf_nodes=int(perf.group(2)), draw_calls=int(perf.group(3)),
                   static_mb=float(perf.group(4)), fps=int(perf.group(5)))
    errors = [line for line in text.splitlines() if "SCRIPT ERROR" in line or "Parse Error" in line]
    out["errors"] = errors[:12]
    return out


STATION_ORDER = [
    ("f1_spawn", "Floor 1 - the first gameplay frame"),
    ("f1_gate", "Floor 1 - processional gate and altar"),
    ("f1_altar", "Floor 1 - the altar up close"),
    ("f2_landing", "Floor 2 - landing"),
    ("f2_court", "Floor 2 - blood court"),
    ("f2_encounter", "Floor 2 - court encounter space"),
    ("f3_approach", "Floor 3 - arena threshold"),
    ("f3_fight", "Floor 3 - live Hooded Archer fight"),
]

CROP_STATIONS = ["f1_spawn", "f1_gate", "f2_court", "f3_fight"]
CROP_SCALE = 3


def main() -> int:
    after_dir = ARTIFACTS / "after"
    before_dir = ARTIFACTS / "before"
    images_dir = L05 / "images"
    crops_dir = L05 / "crops"
    comparisons_dir = L05 / "comparisons"
    for folder in (images_dir, crops_dir, comparisons_dir):
        folder.mkdir(parents=True, exist_ok=True)

    after_log = DOCS / "L05" / "logs" / "after.txt"
    before_log = DOCS / "L05" / "logs" / "before.txt"
    summary = _capture_summary(after_log)
    before_summary = _capture_summary(before_log)
    stations = _stations(after_log)
    before_stations = _stations(before_log)

    # ---- per-station native frames + pairs ---------------------------------
    captured = []
    pairs = 0
    for station_id, label in STATION_ORDER:
        after = _load(after_dir / f"after_{station_id}.png")
        if after is None:
            continue
        captured.append(station_id)
        _save(_label(after, f"NATIVE GODOT {after.width}x{after.height} - {label}"), 
              images_dir / f"after_{station_id}.png")
        before = _load(before_dir / f"before_{station_id}.png")
        if before is not None:
            left = _label(before, "BEFORE - same map, architecture layer off")
            right = _label(after, f"AFTER - {label}")
            _save(_hstack([left, right]), images_dir / f"pair_{station_id}.png")
            pairs += 1

    # ---- overviews ---------------------------------------------------------
    overviews = []
    for station_id in ("f1", "f2", "f3"):
        image = _load(after_dir / f"overview_after_overview_{station_id}.png")
        if image is None:
            continue
        _save(_label(image, f"NATIVE GODOT OVERVIEW (camera zoomed out) - Floor {station_id[-1]}"),
              images_dir / f"overview_floor{station_id[-1]}.png")
        overviews.append(station_id)

    # ---- integer-scaled crops ---------------------------------------------
    crop_rows = []
    for station_id in CROP_STATIONS:
        image = _load(after_dir / f"after_{station_id}.png")
        if image is None:
            continue
        # centre crop, integer scale, nearest neighbour: no resampling invented
        w, h = 420, 300
        left = max(0, image.width // 2 - w // 2)
        top = max(0, image.height // 2 - h // 2)
        crop = image.crop((left, top, left + w, top + h))
        crop = crop.resize((w * CROP_SCALE, h * CROP_SCALE), Image.NEAREST)
        _save(_label(crop, f"{CROP_SCALE}x nearest-neighbour crop of a native frame - {station_id}"),
              crops_dir / f"crop_{CROP_SCALE}x_{station_id}.png")
        crop_rows.append(station_id)

    # ---- comparison against the gold references and the rejected baseline --
    reference_rows = []
    for path, name in GOLD:
        gold = _load(path)
        if gold is None:
            continue
        gold = gold.resize((640, 360), Image.LANCZOS)
        reference_rows.append((name, gold))
    rejected = _load(REJECTED)
    if rejected is not None:
        reference_rows.append(("REJECTED baseline - Level 5 before this sprint",
                               rejected.resize((640, 360), Image.LANCZOS)))
    shots = []
    for station_id in ("f1_spawn", "f2_court", "f3_fight"):
        image = _load(after_dir / f"after_{station_id}.png")
        if image is None:
            continue
        shots.append((station_id, image.resize((640, 360), Image.LANCZOS)))

    if shots:
        rows = []
        for name, image in reference_rows:
            rows.append(_label(image, name))
        for station_id, image in shots:
            rows.append(_label(image, f"NATIVE AFTER - {station_id} (this sprint)"))
        row_images = []
        for i in range(0, len(rows), 2):
            row_images.append(_hstack(rows[i:i + 2]))
        height = sum(r.height + 6 for r in row_images)
        width = max(r.width for r in row_images)
        sheet = Image.new("RGB", (width, height + 24), (10, 8, 10))
        draw = ImageDraw.Draw(sheet)
        draw.text((6, 5), "GOLD REFERENCES vs the rejected baseline vs native Level 5 frames "
                          "(native shots scaled to 640x360 for layout only)",
                  fill=(255, 232, 160))
        y = 24
        for row in row_images:
            sheet.paste(row, (0, y))
            y += row.height + 6
        _save(sheet, comparisons_dir / "gold_vs_rejected_vs_after.png")

    # ---- manifest ----------------------------------------------------------
    manifest = {
        "schema": "chapter1_architecture_evidence/1",
        "level": "chapter_1_level_5",
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        "commit": _git("rev-parse", "HEAD"),
        "source_pins": _pins(),
        "capture": summary,
        "capture_before": before_summary,
        "stations": stations,
        "stations_before": before_stations,
        "frames": captured,
        "pairs": pairs,
        "overviews": overviews,
        "crops": crop_rows,
        "evidence_kind": {
            "images": "native Godot 4.7 frames, 1280x720, production AppRoot -> AppFlow campaign boot",
            "crops": "integer nearest-neighbour crops of those native frames",
            "comparisons": "native frames plus the two owner-approved gold references and the rejected baseline",
            "preview": "PIL composition previews: NOT gameplay evidence, never present these as frames",
        },
    }
    (L05 / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("ARCHITECTURE EVIDENCE: frames=%d pairs=%d overviews=%d crops=%d"
          % (len(captured), pairs, len(overviews), len(crop_rows)))
    return 0


def _git(*args: str) -> str:
    import subprocess
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                              check=False).stdout.strip()
    except OSError:
        return ""


def _pins() -> dict:
    import hashlib
    out = {}
    for relative in (
        "data/levels/chapter_1_level_5.json",
        "data/levels/chapter_1_level_5_architecture.json",
        "assets/environment/chapter1/crucible/crucible_tiles.png",
        "assets/environment/chapter1/crucible/crucible_props.png",
        "tools/level5/art_crucible.py",
        "tools/level5/architecture.py",
        "game/levels/presentation/crucible_art.gd",
    ):
        path = ROOT / relative
        if path.exists():
            out[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


if __name__ == "__main__":
    raise SystemExit(main())
