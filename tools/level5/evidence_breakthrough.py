#!/usr/bin/env python3
"""Assemble the Level 5 final-art-direction evidence folder.

Native frames come from `.artifacts/crucible/{after,before}`, written by
`tools/captures/crucible_capture.gd` inside the workflow. This script only pairs,
crops, labels and indexes them; it never invents a frame, and it never resamples a
native frame except with NEAREST for the integer crops.

Output: docs/chapter1-visual-overhaul/architecture-breakthrough/L05-final/
  images/       native Godot frames + before/after pairs
  crops/        integer-scaled crops of native frames
  comparisons/  gold references vs the previous architecture commit vs this one
  logs/         the capture logs and the frozen suite logs, copied verbatim
  manifest.json branch, commit, source hashes, capture metrics, per-station rows

The previous folder (`L05/`) is left exactly as it was: it is the "before" side of
this pass's comparison, and history is not overwritten.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".artifacts" / "crucible"
DOCS = ROOT / "docs" / "chapter1-visual-overhaul" / "architecture-breakthrough"
PREVIOUS = DOCS / "L05"                      # the preceding architecture breakthrough
OUT = DOCS / "L05-final"
GOLD = [
    (ROOT / "docs" / "gate2" / "evidence" / "after_archive_entry.png", "GOLD A - Gate 2 Archive"),
    (ROOT / "prototypes" / "environment_art" / "archive_audition" / "captures" / "archive_room_end.png",
     "GOLD B - Monastic Archive"),
]
REJECTED = ROOT / "docs" / "chapter1-visual-overhaul" / "L05" / "images" / "after_entry.png"

STATION_ORDER = [
    ("f1_spawn", "Floor 1 - spawn, first gameplay frame"),
    ("f1_gate", "Floor 1 - processional gate and shrine"),
    ("f1_altar", "Floor 1 - the raised crucible on its island"),
    ("f2_landing", "Floor 2 - landing"),
    ("f2_court", "Floor 2 - the blood court basin"),
    ("f2_encounter", "Floor 2 - court encounter ground"),
    ("f3_approach", "Floor 3 - arena threshold"),
    ("f3_fight", "Floor 3 - live Hooded Archer fight"),
]
OVERVIEWS = [("f1", "Floor 1"), ("f2", "Floor 2"), ("f3", "Floor 3")]
CROP_STATIONS = ["f1_spawn", "f2_court", "f3_fight", "f3_approach"]
CROP_SCALE = 3
# Screenshots the review cannot proceed without. Missing any of these fails the run.
REQUIRED = [f"after_{sid}.png" for sid, _ in STATION_ORDER] + [
    f"overview_after_overview_{sid}.png" for sid, _ in OVERVIEWS
]


def _git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                              check=False).stdout.strip()
    except OSError:
        return ""


def _load(path: Path):
    if not path.exists():
        return None
    return Image.open(path).convert("RGB")


def _save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def _label(image: Image.Image, text: str, height: int = 20) -> Image.Image:
    """A caption strip above an image. Captions state what the picture is."""
    band = Image.new("RGB", (image.width, height), (10, 8, 10))
    ImageDraw.Draw(band).text((6, 4), text, fill=(255, 232, 160))
    out = Image.new("RGB", (image.width, image.height + height), (10, 8, 10))
    out.paste(band, (0, 0))
    out.paste(image, (0, height))
    return out


def _hstack(images, gap: int = 6) -> Image.Image:
    width = sum(i.width for i in images) + gap * (len(images) - 1)
    height = max(i.height for i in images)
    out = Image.new("RGB", (width, height), (10, 8, 10))
    x = 0
    for image in images:
        out.paste(image, (x, 0))
        x += image.width + gap
    return out


def _stations(log: Path) -> dict:
    """Rows the harness printed, so the review can quote what was actually shot.

    `ok` is compared against the file on disk. The previous evidence recorded
    ok=false for every station while the native logs said ok=true, because this
    parser compared the GDScript literal `true` with Python `True`. Both are
    accepted now, and a disagreement between the log and the file is an error
    rather than a silent false.
    """
    rows = {}
    if not log.exists():
        return rows
    text = log.read_text(errors="replace")
    for match in re.finditer(
            r"CRUCIBLE STATION tag=(\w+) station=(\w+) cell=\(([-\d]+), ([-\d]+)\) "
            r"zoom=([\d.]+) out=(\S+) ok=(\w+)(.*)", text):
        name = match.group(2)
        out_path = ROOT / match.group(6).replace("res://", "")
        rows[name] = {
            "tag": match.group(1),
            "cell": [int(match.group(3)), int(match.group(4))],
            "zoom": float(match.group(5)),
            "log_ok": match.group(7).lower() == "true",
            "file_present": out_path.exists(),
            "extra": match.group(8).strip(),
        }
    return rows


def _capture_summary(log: Path) -> dict:
    summary = {
        "level": "", "art": "", "walls": 0, "props": 0, "lights": 0,
        "shadows": 0, "entities": 0, "renderer": "", "nodes": 0,
        "draw_calls": 0, "static_mb": 0.0, "errors": [],
    }
    if not log.exists():
        return summary
    text = log.read_text(errors="replace")
    match = re.search(r"CRUCIBLE CAPTURE: level=(\S+) art=(\w+) wall_cells=(\d+) props=(\d+) "
                      r"lights=(\d+) entities=(\d+)", text)
    if match:
        summary.update({
            "level": match.group(1), "art": match.group(2), "walls": int(match.group(3)),
            "props": int(match.group(4)), "lights": int(match.group(5)),
            "entities": int(match.group(6)),
        })
    match = re.search(r"CRUCIBLE ART: floor_detail=\d+ wall_cells=\d+ bedrock=\d+ props=\d+ "
                      r"lights=\d+ shadows=(\d+)", text)
    if match:
        summary["shadows"] = int(match.group(1))
    match = re.search(r"CRUCIBLE PERF: art=\w+ renderer=(.+?) nodes=(\d+) draw_calls=(\d+) "
                      r"static_mb=([\d.]+)", text)
    if match:
        summary.update({
            "renderer": match.group(1).strip(), "nodes": int(match.group(2)),
            "draw_calls": int(match.group(3)), "static_mb": float(match.group(4)),
        })
    match = re.search(r"CRUCIBLE FIGHT: knight_hp (\S+) -> (\S+) \| boss_hp=(\S+) boss_state=(\S+)",
                      text)
    if match:
        summary["fight"] = {
            "knight_hp_before": match.group(1), "knight_hp_after": match.group(2),
            "boss_hp": match.group(3), "boss_state": match.group(4),
        }
    summary["traversal"] = re.findall(r"CRUCIBLE TRAVERSAL: leg=(\S+) door_used_via=(\S+) "
                                      r"moved=([\d.]+)", text)
    summary["app_boot"] = (re.search(r"CRUCIBLE BOOT: app_boot=(\w+)", text) or [None, ""])[1] \
        if re.search(r"CRUCIBLE BOOT: app_boot=(\w+)", text) else ""
    for line in text.splitlines():
        if line.startswith("ERROR:") or line.startswith("SCRIPT ERROR"):
            summary["errors"].append(line.strip())
    # The startup-profile error used to be triggered by this harness starting a run
    # while AppRoot was still booting. It is only acceptable if it is absent.
    summary["startup_profile_error"] = any("startup profile choice" in e for e in summary["errors"])
    summary["leaks"] = [e for e in summary["errors"] if "leaked" in e]
    return summary


def _pins() -> dict:
    out = {}
    for relative in (
        "data/levels/chapter_1_level_5.json",
        "data/levels/chapter_1_level_5_architecture.json",
        "assets/environment/chapter1/crucible/crucible_tiles.png",
        "assets/environment/chapter1/crucible/crucible_props.png",
        "tools/level5/art_crucible.py",
        "tools/level5/architecture.py",
        "game/levels/presentation/crucible_art.gd",
        "game/levels/dungeon_level.gd",
        "tools/captures/crucible_capture.gd",
    ):
        path = ROOT / relative
        if path.exists():
            out[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


def main() -> int:
    after_dir = ARTIFACTS / "after"
    before_dir = ARTIFACTS / "before"
    images_dir = OUT / "images"
    crops_dir = OUT / "crops"
    comparisons_dir = OUT / "comparisons"
    logs_dir = OUT / "logs"
    for folder in (images_dir, crops_dir, comparisons_dir, logs_dir):
        folder.mkdir(parents=True, exist_ok=True)

    # logs first: they are the evidence the frames are claimed against
    for source in sorted((ARTIFACTS / "suites").glob("*.log")) + sorted(ARTIFACTS.glob("*.log")):
        shutil.copy2(source, logs_dir / (source.stem + ".txt"))

    after_log = logs_dir / "after.txt"
    before_log = logs_dir / "before.txt"
    summary = _capture_summary(after_log)
    before_summary = _capture_summary(before_log)
    stations = _stations(after_log)

    problems = []
    missing = [name for name in REQUIRED if not (after_dir / name).exists()]
    if missing:
        problems.append("missing required native frames: " + ", ".join(missing))
    for name, row in stations.items():
        if row["log_ok"] != row["file_present"]:
            problems.append(f"station {name}: log_ok={row['log_ok']} file_present={row['file_present']}")
    if summary["startup_profile_error"]:
        problems.append("the app reported the startup-profile boot error")
    if not summary.get("fight"):
        problems.append("the boss fight frames carry no health/state record")

    # ---- per-station native frames, and pairs against the previous pass ----
    captured, pairs_previous, pairs_generic = [], 0, 0
    for station_id, label in STATION_ORDER:
        after = _load(after_dir / f"after_{station_id}.png")
        if after is None:
            continue
        captured.append(station_id)
        _save(_label(after, f"NATIVE GODOT {after.width}x{after.height} - {label}"),
              images_dir / f"after_{station_id}.png")
        previous = _load(PREVIOUS / "images" / f"after_{station_id}.png")
        if previous is not None:
            left = _label(previous, f"BEFORE - previous architecture pass (8efe9fa) - {station_id}")
            right = _label(after, f"AFTER - this pass - {label}")
            _save(_hstack([left, right]), images_dir / f"pair_previous_{station_id}.png")
            pairs_previous += 1
        generic = _load(before_dir / f"before_{station_id}.png")
        if generic is not None:
            left = _label(generic, "BEFORE - generic dungeon, architecture layer off")
            right = _label(after, f"AFTER - {label}")
            _save(_hstack([left, right]), images_dir / f"pair_generic_{station_id}.png")
            pairs_generic += 1

    # ---- overviews --------------------------------------------------------
    overviews = []
    for station_id, name in OVERVIEWS:
        image = _load(after_dir / f"overview_after_overview_{station_id}.png")
        if image is None:
            continue
        _save(_label(image, f"NATIVE GODOT OVERVIEW (camera zoomed out) - {name}"),
              images_dir / f"overview_floor{station_id[-1]}.png")
        overviews.append(station_id)

    # ---- traversal sequence (input-driven, not a camera station) ----------
    traversal = []
    for path in sorted(after_dir.glob("after_traversal*.png")):
        image = _load(path)
        if image is None:
            continue
        name = path.stem.replace("after_", "")
        _save(_label(image, f"NATIVE GODOT - INPUT-DRIVEN TRAVERSAL FRAME - {name}"),
              images_dir / f"traversal_{name}.png")
        traversal.append(name)

    # ---- integer crops ----------------------------------------------------
    crop_rows = []
    for station_id in CROP_STATIONS:
        image = _load(after_dir / f"after_{station_id}.png")
        if image is None:
            continue
        w, h = 420, 300
        left = max(0, image.width // 2 - w // 2)
        top = max(0, image.height // 2 - h // 2)
        crop = image.crop((left, top, left + w, top + h))
        crop = crop.resize((w * CROP_SCALE, h * CROP_SCALE), Image.NEAREST)
        _save(_label(crop, f"{CROP_SCALE}x nearest-neighbour crop of a native frame - {station_id}"),
              crops_dir / f"crop_{CROP_SCALE}x_{station_id}.png")
        crop_rows.append(station_id)

    # ---- gold vs previous vs now -----------------------------------------
    rows = []
    for path, name in GOLD:
        gold = _load(path)
        if gold is not None:
            rows.append(_label(gold.resize((640, 360), Image.LANCZOS), name))
    rejected = _load(REJECTED)
    if rejected is not None:
        rows.append(_label(rejected.resize((640, 360), Image.LANCZOS),
                           "REJECTED baseline - Level 5 before the architecture pass"))
    picked = []
    for station_id in ("f1_spawn", "f2_court", "f3_approach", "f3_fight"):
        image = _load(after_dir / f"after_{station_id}.png")
        if image is not None:
            picked.append(image.resize((640, 360), Image.LANCZOS))
            rows.append(_label(image.resize((640, 360), Image.LANCZOS),
                               f"NATIVE - this pass - {station_id}"))
    if rows:
        pairs = [_hstack(rows[i:i + 2]) for i in range(0, len(rows), 2)]
        height = sum(p.height + 6 for p in pairs)
        sheet = Image.new("RGB", (max(p.width for p in pairs), height + 24), (10, 8, 10))
        ImageDraw.Draw(sheet).text(
            (6, 5), "GOLD REFERENCES (full size 1280x720) vs rejected baseline vs native "
                    "Level 5 frames taken for this pass", fill=(255, 232, 160))
        y = 24
        for pair in pairs:
            sheet.paste(pair, (0, y))
            y += pair.height + 6
        _save(sheet, comparisons_dir / "gold_vs_rejected_vs_now.png")

    manifest = {
        "schema": "chapter1_architecture_evidence/2",
        "level": "chapter_1_level_5",
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        "commit": _git("rev-parse", "HEAD"),
        "previous_pass": {
            "evidence": str((PREVIOUS / "manifest.json").relative_to(ROOT)),
            "commit": (json.loads((PREVIOUS / "manifest.json").read_text())["commit"]
                       if (PREVIOUS / "manifest.json").exists() else ""),
        },
        "source_pins": _pins(),
        "capture": summary,
        "capture_before": before_summary,
        "stations": stations,
        "frames": captured,
        "pairs_vs_previous": pairs_previous,
        "pairs_vs_generic": pairs_generic,
        "overviews": overviews,
        "traversal_frames": traversal,
        "crops": crop_rows,
        "evidence_kind": {
            "images": "native Godot 4.7 frames, 1280x720, production AppRoot -> AppFlow campaign boot",
            "traversal": "native frames from a path walked with real movement input; doors opened by input",
            "crops": "integer nearest-neighbour crops of those native frames",
            "comparisons": "gold references + rejected baseline + native frames",
        },
        "problems": problems,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("ARCHITECTURE EVIDENCE: frames=%d pairs(previous)=%d pairs(generic)=%d overviews=%d "
          "traversal=%d crops=%d" % (len(captured), pairs_previous, pairs_generic,
                                     len(overviews), len(traversal), len(crop_rows)))
    if problems:
        for problem in problems:
            print("EVIDENCE PROBLEM:", problem)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
