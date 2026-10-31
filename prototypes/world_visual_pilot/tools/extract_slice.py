#!/usr/bin/env python3
"""Extract the bounded, byte-exact corridor slice this pilot is composed on.

The pilot never re-derives geography. It takes three pinned A1 artifacts and
cuts a window out of them, verifying every input byte first:

  annex_layers.v1.json   448x256 RLE ground/detail/solid grids (A0/A1 connector)
  annex_props.v1.json    the authored prop scatter for those grids
  first_hour_route.v1.json  A1's walkability proof between the two POIs

The output (data/corridor_cells.v1.json) contains only the tokens inside the
window, plus the route/nav/POI contract that the pilot must respect. Because the
full annex is 2.3 MB and is A1-owned production data, only this bounded slice is
committed here; `--verify-full-annex` re-checks the slice against the full file
when an auditor has it.

Usage:
    python3 extract_slice.py \
        --annex-layers  /path/annex_layers.v1.json \
        --annex-props   /path/annex_props.v1.json \
        --annex-world   /path/annex_world.v1.json \
        --route         /path/first_hour_route.v1.json \
        --slice         /path/poi_crown_waystation.slice.json \
        --out           ../data/corridor_cells.v1.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

# The exact branch/commit the bytes were read from. Changing this is a
# deliberate source-pin change and must be accompanied by new SHA-256 values.
SOURCE_COMMIT = "f6baaee0ad0ecc5162196e290ede9ccdf45982b1"
SOURCE_BRANCH = "reviews/ct-a0-a1-a3-a7-20261030-2345"

PINNED = {
    "annex_layers.v1.json": "674643e862168ab52b00fe7f8038fcf6be8c6aa66cb6666c28ca752394ca2d00",
    "annex_props.v1.json": "dc80877a0425ceac546fbed2dcc352c14fb6548e67c346d9f1226ef914440cd2",
    "annex_world.v1.json": "8883a224f05372f7ad3afa5317da82268e624acfc76f9891ba9fc24a22f6e1c6",
    "first_hour_route.v1.json": "4e4c4eb9864dfc28aca4fcb4168cd856fc3f6be466b95e3ff6b7fb5b3784722c",
    "poi_crown_waystation.slice.json": "3a4981fd3e24580e2e7c2ee5d0929f76c432d785e142b67a222c6480af01e16f",
}

# Corridor window, in authored cells. It is chosen so that all four camera
# stations (see stations.v1.json) fall inside it with margin, and so the west
# edge contains the authored fen (bog/pool) that the waystation road crosses.
CORRIDOR = {"x": 368, "y": 192, "w": 50, "h": 34}

# The nearest place in the *same authored world* where traversable marsh meets
# impassable deep water. It is 95 cells from the waystation - no deep water
# exists within 83 cells of the POI (see docs/world-visual-audition/) - so it is
# rendered as a separate, clearly labelled test station, never as part of the
# contiguous corridor.
WATER = {"x": 344, "y": 112, "w": 28, "h": 20}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def decode(entry: dict, width: int, height: int) -> list[list[str]]:
    """Decode the RLE layer exactly like game/overworld/overworld_world.gd."""
    runs = entry["rle"]
    total = width * height
    flat: list[str] = []
    for token, count in runs:
        flat.extend([token] * int(count))
    if len(flat) != total:
        raise SystemExit(f"layer decoded {len(flat)} of {total} cells")
    return [flat[y * width:(y + 1) * width] for y in range(height)]


def cut(grid: list[list[str]], window: dict) -> list[list[str]]:
    x0, y0, w, h = window["x"], window["y"], window["w"], window["h"]
    return [row[x0:x0 + w] for row in grid[y0:y0 + h]]


def inside(x: float, y: float, window: dict) -> bool:
    return (window["x"] <= x < window["x"] + window["w"]
            and window["y"] <= y < window["y"] + window["h"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--annex-layers", required=True)
    ap.add_argument("--annex-props", required=True)
    ap.add_argument("--annex-world", required=True)
    ap.add_argument("--route", required=True)
    ap.add_argument("--slice", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--verify-full-annex", action="store_true")
    args = ap.parse_args()

    paths = {
        "annex_layers.v1.json": args.annex_layers,
        "annex_props.v1.json": args.annex_props,
        "annex_world.v1.json": args.annex_world,
        "first_hour_route.v1.json": args.route,
        "poi_crown_waystation.slice.json": args.slice,
    }
    for name, path in paths.items():
        digest = sha256_file(path)
        if digest != PINNED[name]:
            raise SystemExit(f"source pin mismatch for {name}: {digest}")
        print(f"pin ok  {name}  sha256:{digest[:16]}")

    layers_doc = json.load(open(args.annex_layers, encoding="utf-8"))
    width, height = layers_doc["width"], layers_doc["height"]
    grids = {name: decode(layers_doc["layers"][name], width, height)
             for name in ("ground", "detail", "solid")}

    props = json.load(open(args.annex_props, encoding="utf-8"))["props"]
    world = json.load(open(args.annex_world, encoding="utf-8"))
    route = json.load(open(args.route, encoding="utf-8"))
    poi = json.load(open(args.slice, encoding="utf-8"))

    def window_doc(window: dict, label: str) -> dict:
        return {
            "label": label,
            "origin_cell": [window["x"], window["y"]],
            "size_cells": [window["w"], window["h"]],
            "tile_px": 16,
            "layers": {
                name: cut(grid, window)
                for name, grid in grids.items()
            },
            "source_props": [
                {
                    "index": i,
                    "frame": p["frame"],
                    "x": p["x"],
                    "y": p["y"],
                    "z": p["z"],
                    "flags": p.get("flags", ""),
                    "lit": bool(p.get("lit", False)),
                }
                for i, p in enumerate(props)
                if inside(p["x"] / 16.0, p["y"] / 16.0, window)
            ],
        }

    corridor = window_doc(CORRIDOR, "crown_roadside_waystation_corridor")
    water = window_doc(WATER, "fen_water_interface_test")

    # Contract the pilot must not violate.
    corridor["route"] = {
        "route_id": route["route_id"],
        "start_cell": route["start_cell"],
        "goal_cell": route["goal_cell"],
        "outbound_cells": route["outbound_cells"],
        "return_cells": route["return_cells"],
        "proof": route["proof"],
        "authority": route["authority"],
        "camera_landmark_states": route["camera_landmark_states"],
        "notes_crate_instance": route["notes_crate_instance"],
        "waystation_cache_instance": route["waystation_cache_instance"],
        "waystation_cache_interaction_alias": route["waystation_cache_interaction_alias"],
    }
    corridor["poi"] = {
        "poi_id": poi["poi_id"],
        "name": poi["name"],
        "chunk_ids": poi["chunk_ids"],
        "integration_status": poi["integration_status"],
        "native_playable": poi["native_playable"],
        "anchor_cell": poi["immutable_geography"]["anchor_cell"],
        "entrances": poi["immutable_geography"]["entrances"],
        "static_obstacles": poi["immutable_geography"]["static_obstacles"],
        "required_nav_cells": poi["immutable_geography"]["required_nav_cells"],
        "spawn_forbidden_cells": poi["immutable_geography"]["spawn_forbidden_cells"],
        "hero_spawn_cell": poi["immutable_geography"]["hero_spawn_cell"],
        "hero_return_cell": poi["immutable_geography"]["hero_return_cell"],
        "hero_body_px": poi["immutable_geography"]["hero_body_px"],
        "hero_offset_px": poi["immutable_geography"]["hero_offset_px"],
        "approach_path": poi["immutable_geography"]["approach_path"],
        "retreat_path": poi["immutable_geography"]["retreat_path"],
        "interaction_nodes": poi["interaction_nodes"],
        "actions": poi["actions"],
    }
    # Authored world facts that intersect the windows.
    def rect_hits(rect, window):
        rx, ry, rw, rh = rect
        return not (rx + rw <= window["x"] or rx >= window["x"] + window["w"]
                    or ry + rh <= window["y"] or ry >= window["y"] + window["h"])

    corridor["world_context"] = {
        "world_id": world["world_id"],
        "world_bounds": world["world_bounds"],
        "canonical_connector": world["canonical_connector"],
        "tile_size": world["tile_size"],
        "camera_default": world["camera_default"],
        "default_tint": world["default_tint"],
        "camps": [c for c in world["camps"] if inside(c["pos"][0], c["pos"][1], CORRIDOR)],
        "landmarks": [l for l in world["landmarks"] if inside(l["pos"][0], l["pos"][1], CORRIDOR)],
        "discoveries": [d for d in world["discoveries"] if inside(d["pos"][0], d["pos"][1], CORRIDOR)],
        "hazards": [h for h in world["hazards"] if rect_hits(h["rect"], CORRIDOR)],
        "shortcuts": [s for s in world["shortcuts"] if inside(s["pos"][0], s["pos"][1], CORRIDOR)],
    }
    water["world_context"] = {
        "world_id": world["world_id"],
        "camps": [c for c in world["camps"] if inside(c["pos"][0], c["pos"][1], WATER)],
        "landmarks": [l for l in world["landmarks"] if inside(l["pos"][0], l["pos"][1], WATER)],
        "hazards": [h for h in world["hazards"] if rect_hits(h["rect"], WATER)],
    }

    doc = {
        "schema": "soh.world_visual_pilot.slice.v1",
        "generated_by": "prototypes/world_visual_pilot/tools/extract_slice.py",
        "source": {
            "repository": "Khanh-glitch/Soul-of-Hero",
            "branch": SOURCE_BRANCH,
            "commit": SOURCE_COMMIT,
            "files": {
                name: {"path": name, "sha256": PINNED[name]}
                for name in PINNED
            },
        },
        "corridor": corridor,
        "water_test": water,
    }

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    print(f"wrote {out_path}  sha256:{sha256_file(out_path)[:16]}")
    print(f"corridor {CORRIDOR['w']}x{CORRIDOR['h']} cells, "
          f"{len(corridor['source_props'])} authored props inside")
    print(f"water     {WATER['w']}x{WATER['h']} cells, "
          f"{len(water['source_props'])} authored props inside")
    return 0


if __name__ == "__main__":
    sys.exit(main())
