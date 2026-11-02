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

# Levels 1-4 use the chapter's shared tile sheets rather than a kit, and their theme
# documents reference those sheets by atlas coordinate. Those references fail the
# same silent way: a coordinate that lands on an empty cell draws nothing, and the
# room simply has a hole in it that no test notices.
THEME_DIR = ROOT / "data" / "environment" / "chapter1"
THEME_SCHEMA = "chapter1_environment_theme/1"
TILE_SIZE = 16
# Source id -> sheet, matching Chapter1EnvironmentArt's _tile_source() / DungeonLevel's
# TileSet atlas list.
THEME_SHEETS = {
    0: "assets/environment/dungeon_0x72/dungeon_tileset_ii.png",
    1: "assets/environment/dungeon_0x72/atlas_walls_low.png",
}
_TILE_CACHE: dict[int, set[tuple[int, int]]] = {}


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


def _sheet_tiles(source: int) -> set[tuple[int, int]]:
    """Atlas coordinates on this sheet that actually carry pixels."""
    if source in _TILE_CACHE:
        return _TILE_CACHE[source]
    tiles: set[tuple[int, int]] = set()
    path = ROOT / THEME_SHEETS[source]
    if not path.is_file():
        _TILE_CACHE[source] = tiles
        return tiles
    try:
        from PIL import Image  # noqa: PLC0415 - only the art jobs have pillow
    except ImportError:
        # The bounds part of the check still runs; only the emptiness part needs
        # the pixels themselves.
        _TILE_CACHE[source] = set()
        return tiles
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        for ty in range(rgba.height // TILE_SIZE):
            for tx in range(rgba.width // TILE_SIZE):
                box = rgba.crop((tx * TILE_SIZE, ty * TILE_SIZE,
                                 (tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE))
                if box.getchannel("A").getbbox() is not None:
                    tiles.add((tx, ty))
    _TILE_CACHE[source] = tiles
    return tiles


def _theme_entries(document: dict) -> list[tuple[str, object]]:
    """Every tile reference in a theme document, tagged with where it came from."""
    found: list[tuple[str, object]] = []
    facade = document.get("facade") or {}
    for key in ("courses", "cap", "side", "backing"):
        for entry in facade.get(key) or []:
            found.append(("facade.%s" % key, entry))
    for index, spec in enumerate(facade.get("trim") or []):
        if isinstance(spec, dict):
            for entry in spec.get("tiles") or []:
                found.append(("facade.trim[%d]" % index, entry))
    floor = document.get("floor") or {}
    for key in ("wear", "border"):
        for entry in floor.get(key) or []:
            found.append(("floor.%s" % key, entry))
    bedrock = document.get("bedrock") or {}
    for entry in bedrock.get("tiles") or []:
        found.append(("bedrock.tiles", entry))
    return found


def check_theme(path: pathlib.Path) -> list[str]:
    """Reject a theme tile reference the shared sheet cannot draw."""
    document = json.loads(path.read_text(encoding="utf-8"))
    problems: list[str] = []
    for field, entry in _theme_entries(document):
        if not isinstance(entry, list) or not entry:
            _report(problems, "%s: %s has a malformed tile entry %r" % (path.name, field, entry))
            continue
        if len(entry) >= 3:
            source, x, y = int(entry[0]), int(entry[1]), int(entry[2])
        elif len(entry) == 2:
            source, x, y = 1, int(entry[0]), int(entry[1])
        else:
            _report(problems, "%s: %s has a malformed tile entry %r" % (path.name, field, entry))
            continue
        if source not in THEME_SHEETS:
            _report(problems, "%s: %s names sheet %d, which Chapter1EnvironmentArt "
                              "cannot draw" % (path.name, field, source))
            continue
        tiles = _sheet_tiles(source)
        sheet_path = ROOT / THEME_SHEETS[source]
        if not sheet_path.is_file():
            _report(problems, "%s: sheet %d is missing (%s)"
                    % (path.name, source, THEME_SHEETS[source]))
            continue
        limit_x = limit_y = 0
        try:
            from PIL import Image  # noqa: PLC0415
            with Image.open(sheet_path) as sheet:
                limit_x, limit_y = sheet.width // TILE_SIZE, sheet.height // TILE_SIZE
        except ImportError:
            pass
        if limit_x and not (0 <= x < limit_x and 0 <= y < limit_y):
            _report(problems, "%s: %s tile [%d,%d] is outside sheet %s"
                    % (path.name, field, x, y, THEME_SHEETS[source].rsplit("/", 1)[-1]))
            continue
        if tiles and (x, y) not in tiles:
            _report(problems, "%s: %s tile %r is an empty cell on sheet %s - it draws "
                              "nothing and leaves a hole in the room"
                    % (path.name, field, [x, y], THEME_SHEETS[source].rsplit("/", 1)[-1]))
    return problems


def check_level_references() -> list[str]:
    """Every level that claims authored art must point at a document that exists."""
    problems: list[str] = []
    for path in sorted(LEVEL_DIR.glob("*.json")):
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
    # Every authored document in the directory, not just the numbered ones: Level 1
    # is `crypt_entrance_architecture.json` and a `chapter_1_level_*` glob skipped it,
    # so the first level's 36 wall placements were never checked against its kit.
    documents = sorted(LEVEL_DIR.glob("*_architecture.json"))
    if only:
        documents = [p for p in documents if p.name.startswith(only)]
    problems: list[str] = []
    for path in documents:
        problems.extend(check_document(path))
    themes = sorted(THEME_DIR.glob("*.json"))
    themes = [p for p in themes
              if json.loads(p.read_text(encoding="utf-8")).get("schema") == THEME_SCHEMA]
    for path in themes:
        problems.extend(check_theme(path))
    problems.extend(check_level_references())
    print("Chapter 1 art reference validation: %d architecture document(s), %d kit(s), "
          "%d theme document(s)."
          % (len(documents), len({json.loads(p.read_text(encoding='utf-8')).get('kit')
                                  for p in documents}), len(themes)))
    for problem in problems:
        print("  FAIL %s" % problem)
    if problems:
        print("FAIL: %d unresolved art reference(s)." % len(problems))
        return 1
    print("PASS: every authored frame resolves to a kit atlas, and every theme tile "
          "resolves to a pixel on its sheet.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
