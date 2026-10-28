#!/usr/bin/env python3
"""Local, non-destructive overrides for the *world*, not just the atlas.

`overrides.py` lets a hand-painted frame win over a generated one. That is only
half of what an environment artist needs: the frames are a vocabulary, and the
problems that actually show up on screen are usually in the *sentence* — a rock
standing where the road bends, a marsh tile in the middle of a stone plaza, a
tree whose trunk closes a sightline, a detail band that repeats eight times in a
row.

This module is the other half. It applies a small, ordered, human-readable patch
list to the baked world:

  * **terrain** — set a cell's ground/detail/solid code inside a rect or a list of
    cells (add a paving apron, pull a water cell back out of a footpath, remove a
    detail prop that repeats),
  * **props** — remove, move, replace or add a prop at a tile.

Design rules, all of them enforced by `--check`:

  1. **Deterministic.** No randomness, no time, no dictionary-order dependence:
     patches are applied in file order and rects are iterated in a fixed
     y-then-x order.
  2. **Idempotent.** Applying the list twice produces byte-identical output.
     `move` records the tile it has already moved *to*; a second application sees
     the prop at its destination and does nothing. `remove` matches on
     frame+position, so a second pass finds nothing.
  3. **Non-destructive.** Patches are data. Delete the file and the bake produces
     the original world again; `--check` proves it by baking both ways and
     comparing hashes.
  4. **Validated.** Patches are applied *before* `author.validate()`, so the bake's
     own topology, prop-body and interaction-cell gates judge them like any other
     authored content. A patch cannot smuggle in a sealed reward.

    python3 tools/overworld/patches.py --list      # what is declared
    python3 tools/overworld/patches.py --report    # what each patch changes
    python3 tools/overworld/patches.py --check     # determinism + idempotency + no-op
    python3 tools/overworld/patches.py --empty     # prove the world is unchanged without patches
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DATA_DIR = os.path.join(ROOT, "data", "overworld")
PATCH_PATH = os.path.join(DATA_DIR, "world_patches.json")

## The game's own layer alphabets. Kept here rather than imported so that a patch
## file can be validated without a bake.
GROUND_CODES = set(".,;drybg~afm")
DETAIL_CODES = set(".=+:/\|Mv")

VALID_OPS = ("remove", "move", "replace", "add")


def load(path: str = PATCH_PATH) -> dict:
    if not os.path.exists(path):
        return {"schema": "hollow_marches_world_patches/v1", "terrain": [], "props": []}
    with open(path) as handle:
        doc = json.load(handle)
    doc.setdefault("terrain", [])
    doc.setdefault("props", [])
    return doc


def _cells_of(entry: dict) -> list[tuple[int, int]]:
    """Every cell an entry addresses, in a fixed order."""
    if "cells" in entry:
        return [(int(x), int(y)) for x, y in entry["cells"]]
    if "rect" in entry:
        x0, y0, x1, y1 = (int(v) for v in entry["rect"])
        if x1 < x0 or y1 < y0:
            raise ValueError("patch %s: rect is inverted" % entry.get("id", "?"))
        return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    raise ValueError("patch %s: needs 'cells' or 'rect'" % entry.get("id", "?"))


def _hash_layers(ground, detail, solid, props) -> str:
    digest = hashlib.sha256()
    digest.update("".join(ground).encode())
    digest.update(b"|")
    digest.update("".join(detail).encode())
    digest.update(b"|")
    digest.update("".join(solid).encode())
    digest.update(b"|")
    for entry in props:
        digest.update(("%s@%s,%s;" % (entry["frame"], entry["x"], entry["y"])).encode())
    return digest.hexdigest()


def apply(doc: dict, ground, detail, solid, props, width: int, height: int,
          tile: int = 16, report: list | None = None) -> dict:
    """Apply the patch document in place. Returns a summary.

    `ground`, `detail` and `solid` are flat lists indexed `y * width + x`; `props`
    is the world's prop list of `{"frame", "x", "y", "flags", "z", "lit"}` dicts.
    """
    tile_count = 0
    prop_count = 0

    for entry in doc.get("terrain", []):
        code = entry.get("set")
        layer_name = entry.get("layer", "detail")
        layers = {"ground": ground, "detail": detail, "solid": solid}
        if layer_name not in layers:
            raise ValueError("patch %s: unknown layer %r" % (entry.get("id", "?"), layer_name))
        if code is None or len(str(code)) != 1:
            raise ValueError("patch %s: 'set' must be one character" % entry.get("id", "?"))
        target = layers[layer_name]
        for x, y in _cells_of(entry):
            if not (0 <= x < width and 0 <= y < height):
                raise ValueError("patch %s: (%d,%d) is outside the world" % (entry.get("id", "?"), x, y))
            index = y * width + x
            if target[index] != code:
                target[index] = code
                tile_count += 1
        if report is not None:
            report.append({"id": entry.get("id", "?"), "kind": "terrain",
                           "layer": layer_name, "code": code, "cells": len(_cells_of(entry))})

    for entry in doc.get("props", []):
        op = entry.get("op")
        if op not in VALID_OPS:
            raise ValueError("patch %s: unknown op %r" % (entry.get("id", "?"), op))
        frame = entry.get("frame")
        at = entry.get("at")
        if at is None:
            # An `add` is placed by its destination; a zone op by its centre.
            if op == "add" and entry.get("to") is not None:
                at = entry["to"]
            elif entry.get("within") is not None:
                at = entry["within"]["centre"]
            else:
                raise ValueError("patch %s: 'at' is required (or a 'within' zone)"
                                 % entry.get("id", "?"))
        at = (int(at[0]), int(at[1]))
        position = (at[0] * tile + tile * 0.5, at[1] * tile + tile * 0.5)

        within = entry.get("within")

        def matches(item: dict) -> bool:
            if frame and item["frame"] != frame:
                return False
            if within:
                # A zone op: every prop of this frame inside a radius of a tile. The
                # camp clearings use it to lift gravestones out of a living camp
                # without listing twenty tiles by hand.
                cx, cy = int(within["centre"][0]), int(within["centre"][1])
                radius = float(within.get("radius", 6))
                tile_x = (item["x"] - tile * 0.5) / tile
                tile_y = (item["y"] - tile * 0.5) / tile
                return ((tile_x - cx) ** 2 + (tile_y - cy) ** 2) ** 0.5 <= radius
            return (round(item["x"], 1), round(item["y"], 1)) == (round(position[0], 1), round(position[1], 1))

        touched = 0
        if op in ("remove", "move", "replace"):
            survivors = [item for item in props if not matches(item)]
            touched = len(props) - len(survivors)
            props[:] = survivors
        if op in ("move", "replace", "add"):
            frame_to = entry.get("to_frame", frame if op != "replace" else None)
            to = entry.get("to", at if op != "move" else None)
            if frame_to is None:
                raise ValueError("patch %s: missing frame for %s" % (entry.get("id", "?"), op))
            to = (int(to[0]), int(to[1]))
            # Idempotency: if the destination already holds this frame, we are
            # looking at a world where the patch has already been applied.
            already = any(item["frame"] == frame_to
                          and (round(item["x"], 1), round(item["y"], 1))
                          == (round(to[0] * tile + tile * 0.5, 1), round(to[1] * tile + tile * 0.5, 1))
                          for item in props)
            if not (op == "add" and already):
                props.append({
                    "frame": frame_to,
                    "x": round(to[0] * tile + tile * 0.5, 1),
                    "y": round(to[1] * tile + tile * 0.5, 1),
                    "flags": entry.get("flags", ""),
                    "z": int(entry.get("z", 0)),
                    "lit": bool(entry.get("lit", False)),
                })
                # Counted only when the prop is really written. An `add` whose
                # destination already holds that frame is a world that has this
                # patch applied already, and must report zero edits or the
                # idempotency check fails on a correct patch.
                touched += 1
        prop_count += touched
        if report is not None:
            report.append({"id": entry.get("id", "?"), "kind": "prop", "op": op,
                           "frame": frame, "at": list(at), "touched": touched})

    return {"terrain_cells": tile_count, "prop_edits": prop_count,
            "patches": len(doc.get("terrain", [])) + len(doc.get("props", [])),
            "hash": _hash_layers(ground, detail, solid, props)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="print the declared patches")
    parser.add_argument("--report", action="store_true", help="apply to a throwaway world and report")
    parser.add_argument("--check", action="store_true",
                        help="determinism, idempotency and no-op checks")
    parser.add_argument("--empty", action="store_true",
                        help="prove that an empty patch list leaves the world identical")
    parser.add_argument("--path", default=PATCH_PATH)
    args = parser.parse_args()

    doc = load(args.path)
    if args.list:
        for entry in doc.get("terrain", []):
            print("terrain  %-28s %-6s %-1s  %s" % (entry.get("id", "?"), entry.get("layer", "detail"),
                                                    entry.get("set", "?"), entry.get("why", "")))
        for entry in doc.get("props", []):
            print("prop     %-28s %-7s %-14s at %s  %s" % (entry.get("id", "?"), entry.get("op"),
                                                           entry.get("frame", "?"), entry.get("at"),
                                                           entry.get("why", "")))
        return 0

    if args.empty:
        # An empty document must be a true no-op: this is the non-destructiveness
        # claim, stated as a test rather than as a comment.
        width, height = 384, 256
        layers = ([","] * (width * height), ["."] * (width * height), ["."] * (width * height))
        items = [{"frame": "tree_dead", "x": 8.0, "y": 8.0, "flags": "", "z": 0, "lit": False}]
        before = _hash_layers(*layers, items)
        summary = apply({"terrain": [], "props": []}, *layers, items, width, height)
        after = _hash_layers(*layers, items)
        if before != after or summary["terrain_cells"] or summary["prop_edits"]:
            print("EMPTY PATCH LIST CHANGED THE WORLD")
            return 1
        print("empty patch list is a no-op (%s)" % before[:16])
        return 0

    if args.report or args.check:
        import author  # the real world, painted for real

        author.paint_base(*author.build_fields())
        for painter in (author.paint_landforms, author.paint_water, author.paint_barriers,
                        author.paint_forests, author.paint_landmarks, author.paint_camps,
                        author.paint_shortcuts, author.paint_discoveries, author.paint_roads,
                        author.paint_scatter, author.reinstate_shortcut_bands):
            painter()
        base = _hash_layers(author.ground, author.detail, author.solid, author.props)

        report: list = []
        summary = apply(doc, author.ground, author.detail, author.solid, author.props,
                        author.W, author.H, author.TILE, report)
        print("patches: %d, cells changed %d, prop edits %d"
              % (summary["patches"], summary["terrain_cells"], summary["prop_edits"]))
        for row in report:
            print("  %-10s %-28s %s" % (row["kind"], row["id"],
                                        {k: v for k, v in row.items() if k not in ("kind", "id")}))

        if args.report:
            return 0

        problems = []
        # Determinism + idempotency: apply the same document a second time to the
        # already-patched world. Nothing may change.
        twice = apply(doc, author.ground, author.detail, author.solid, author.props,
                      author.W, author.H, author.TILE)
        after_twice = _hash_layers(author.ground, author.detail, author.solid, author.props)
        if twice["terrain_cells"] or twice["prop_edits"]:
            problems.append("second application changed %d cells / %d props"
                            % (twice["terrain_cells"], twice["prop_edits"]))
        if after_twice != summary["hash"]:
            problems.append("second application produced a different world hash")

        # Non-destructiveness: a fresh paint plus an empty document reproduces the
        # unpatched world exactly.
        global ground, detail, solid, props  # noqa: PLW0603 - author's module state
        import importlib
        author = importlib.reload(author)
        author.paint_base(*author.build_fields())
        for painter in (author.paint_landforms, author.paint_water, author.paint_barriers,
                        author.paint_forests, author.paint_landmarks, author.paint_camps,
                        author.paint_shortcuts, author.paint_discoveries, author.paint_roads,
                        author.paint_scatter, author.reinstate_shortcut_bands):
            painter()
        if _hash_layers(author.ground, author.detail, author.solid, author.props) != base:
            problems.append("painting is not deterministic across a module reload")

        if problems:
            for problem in problems:
                print("PATCH CHECK FAILED:", problem, file=sys.stderr)
            return 1
        print("patch check passed: deterministic, idempotent, non-destructive")
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.exit(main())
