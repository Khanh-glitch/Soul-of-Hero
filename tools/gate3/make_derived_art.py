#!/usr/bin/env python3
"""Gate 3 — derive the hazard sprites the prototype needs, from production art.

The one violet thing left in Level 3 is not the `Decor` layer: it is the floor
spike sprite. `assets/environment/dungeon/items/spikes/peaks_*.png` are fully
opaque 16x16 frames whose background is a flat violet, RGB (61, 37, 59). At the
2x scale the level draws them at, every spike bay reads as a lavender plate on a
stone floor — which is exactly the "magenta/purple" Gate 2 was marked down for, and
exactly the sort of thing a multiply tint cannot fix, because the plate is opaque.

Production art is frozen, so this tool does not touch it. It writes a
prototype-local *derived* copy with ONLY the flat background turned transparent;
every spike pixel is copied unchanged, so the hazard keeps its shape, its contrast
and its four-frame animation, and loses nothing but the plate behind it. The
derived files carry the source sha256 in the manifest, so the provenance is
auditable and the derivation is reproducible:

    python3 tools/gate3/make_derived_art.py [--check]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "assets/environment/dungeon/items/spikes"
OUT_DIR = ROOT / "prototypes/gate3/art"
MANIFEST = OUT_DIR / "derived_art.json"

# The flat plate behind every spike frame. Sampled at the corner of each source
# frame and asserted to be uniform before anything is written.
PLATE = (61, 37, 59)
FRAMES = ["peaks_1.png", "peaks_2.png", "peaks_3.png", "peaks_4.png"]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def derive(source: Path) -> tuple[bytes, dict]:
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - the CI image installs Pillow
        raise SystemExit("Pillow is required to derive the hazard frames")
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    plate = tuple(pixels[0, 0][:3])
    if plate != PLATE:
        raise SystemExit(f"{source.name}: expected a {PLATE} plate, found {plate}")
    cleared = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if (r, g, b) == PLATE:
                pixels[x, y] = (r, g, b, 0)
                cleared += 1
    if cleared == width * height:
        raise SystemExit(f"{source.name}: the whole frame is plate; refusing to erase the art")
    from io import BytesIO

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue(), {"cleared_pixels": cleared, "size": [width, height]}


def run(check: bool) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    problems = []
    for name in FRAMES:
        source = SOURCE_DIR / name
        if not source.exists():
            raise SystemExit(f"missing production spike frame {source}")
        data, meta = derive(source)
        target = OUT_DIR / name
        if check:
            if not target.exists() or target.read_bytes() != data:
                problems.append(f"{target.relative_to(ROOT)} is out of date")
        else:
            target.write_bytes(data)
        entries.append({
            "derived": str(target.relative_to(ROOT)),
            "source": str(source.relative_to(ROOT)),
            "source_sha256": sha256(source),
            "derived_sha256": hashlib.sha256(data).hexdigest(),
            "plate_rgb": list(PLATE),
            **meta,
        })
    document = {
        "note": ("Prototype-local derived hazard frames. Only the flat violet plate is "
                 "cleared to transparency; every spike pixel is the production pixel. "
                 "The production atlas is not modified."),
        "frames": entries,
    }
    text = json.dumps(document, indent=2) + "\n"
    if check:
        if not MANIFEST.exists() or MANIFEST.read_text() != text:
            problems.append(f"{MANIFEST.relative_to(ROOT)} is out of date")
        for problem in problems:
            print("GATE3 DERIVED ART: " + problem)
        if problems:
            return 1
        print(f"GATE3 DERIVED ART OK: {len(entries)} frames reproducible, production art untouched")
        return 0
    MANIFEST.write_text(text)
    cleared = sum(entry["cleared_pixels"] for entry in entries)
    print(f"GATE3 DERIVED ART: {len(entries)} spike frames, {cleared} plate pixels cleared, "
          f"production art untouched")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="verify the derived frames match their sources without writing")
    return run(parser.parse_args().check)


if __name__ == "__main__":
    sys.exit(main())
