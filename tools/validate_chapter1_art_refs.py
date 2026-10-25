#!/usr/bin/env python3
"""Reject an authored architecture document that names a frame its kit cannot draw.

The renderer can only draw the frames that exist in the kit's two atlases. When a
document asks for a frame the atlas does not have, the sprite is silently skipped
and the cell stays empty, which is how Level 7 lost twenty barrels and Level 8 lost
two banners without a single error anywhere in the pipeline.

This validator is the missing link between the level documents and the art kits.
It reads every chapter 1 architecture document, opens the kit it names, and fails
if any floor, wall or prop frame is not in that kit.

    python3 tools/validate_chapter1_art_refs.py [--level chapter_1_level_7]

Exit status is 0 when every reference resolves, 1 otherwise.
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVEL_DIR = ROOT / "data" / "levels"
ART_DIR = ROOT / "assets" / "environment" / "chapter1"


def _frames(path: pathlib.Path) -> set[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    # Both atlas families use the same {"tile_size", "frames": {name: {...}}} shape.
    return set(data.get("frames", {}))


def _report(problems: list[str], message: str) -> None:
    problems.append(message)


def check_document(path: pathlib.Path) -> list[str]:
    document = json.loads(path.read_text(encoding="utf-8"))
    kit = document.get("kit")
    if not kit:
        return ["%s: no kit field" % path.name]
    kit_dir = ART_DIR / kit
    tiles_json = kit_dir / ("%s_tiles.json" % kit)
    props_json = kit_dir / ("%s_props.json" % kit)
    problems: list[str] = []
    if not kit_dir.is_dir():
        return ["%s: kit directory %s does not exist" % (path.name, kit_dir.relative_to(ROOT))]
    missing_atlas = [p for p in (tiles_json, props_json) if not p.is_file()]
    for missing in missing_atlas:
        _report(problems, "%s: atlas %s does not exist" % (path.name, missing.relative_to(ROOT)))
    if missing_atlas:
        return problems

    tiles = _frames(tiles_json)
    props = _frames(props_json)

    # Two families of authored layers: the chapter 1 schema's floor/wall lists and
    # the earlier overlay schema's flat layer names. Read whichever is present.
    layers = document.get("layers", {})
    for name in ("floor", "wall", "decor"):
        entries = layers.get(name) or []
        atlas = tiles
        seen: dict[str, list[list[int]]] = {}
        for entry in entries:
            frame = entry.get("frame")
            if frame not in atlas:
                seen.setdefault(frame, []).append(list(entry.get("cell", [])))
        for frame, cells in sorted(seen.items()):
            _report(problems, "%s: %s frame '%s' is not in kit '%s' (%d cells, e.g. %s)"
                    % (path.name, name, frame, kit, len(cells), cells[:4]))

    seen_props: dict[str, list[list[int]]] = {}
    for entry in document.get("props") or []:
        frame = entry.get("frame")
        if frame not in props:
            seen_props.setdefault(frame, []).append(list(entry.get("cell", [])))
    for frame, cells in sorted(seen_props.items()):
        _report(problems, "%s: prop frame '%s' is not in kit '%s' (%d cells, e.g. %s)"
                % (path.name, frame, kit, len(cells), cells[:4]))
    return problems


def check_level_references() -> list[str]:
    """Every level that claims authored art must point at a document that exists."""
    problems: list[str] = []
    for path in sorted(LEVEL_DIR.glob("chapter_1_level_*.json")):
        if path.name.endswith("_architecture.json"):
            continue
        document = json.loads(path.read_text(encoding="utf-8"))
        metadata = document.get("metadata") or {}
        art = metadata.get("architecture") or metadata.get("environment_theme")
        if isinstance(art, dict):
            art = art.get("document") or art.get("path")
        if not art:
            continue
        relative = str(art).replace("res://", "")
        if not (ROOT / relative).is_file():
            _report(problems, "%s: references %s, which does not exist" % (path.name, art))
    return problems


def main(argv: list[str]) -> int:
    only = None
    if "--level" in argv:
        only = argv[argv.index("--level") + 1]
    documents = sorted(LEVEL_DIR.glob("chapter_1_level_*_architecture.json"))
    if only:
        documents = [p for p in documents if p.name.startswith(only)]
    problems: list[str] = []
    for path in documents:
        problems.extend(check_document(path))
    problems.extend(check_level_references())
    print("Chapter 1 art reference validation: %d architecture document(s), %d kit(s)."
          % (len(documents), len({json.loads(p.read_text(encoding='utf-8')).get('kit')
                                  for p in documents})))
    for problem in problems:
        print("  FAIL %s" % problem)
    if problems:
        print("FAIL: %d unresolved art reference(s)." % len(problems))
        return 1
    print("PASS: every authored frame resolves to a kit atlas.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
