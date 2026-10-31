#!/usr/bin/env python3
"""Compile A1 visual skins for A8 compact 128x128 overworld shells.

Visual-only handoff: A8 keeps shell collision/entry/interaction and local
worksite art; A0 alone mounts production. The A8 source facts below are pinned
from PR #26 head 5ccf7b3f (native_poi_shell.gd + south_*.json). The atlas pin is
derived from the current baked atlas so the bundle never goes stale silently.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
A8_HEAD = "5ccf7b3f"

# Pinned A8 shell geometry (bounds / action socket / entry portal) per site.
SITES = [
    ("poi_crown_south_quarry", "crown_south_quarry", "quarry", "lm_quarry_workface",
     [("rock_a", 1, 4), ("rock_c", 6, 4), ("handcart", 2, 6), ("fence_h", 1, 2), ("fence_h", 6, 2)]),
    ("poi_crown_south_orchard", "crown_south_orchard", "orchard", "lm_orchard_shed",
     [("tree_orchard", 1, 3), ("tree_orchard", 6, 3), ("drying_rack", 2, 5), ("beehive", 6, 5),
      ("split_rail", 1, 6), ("split_rail", 6, 6)]),
    ("poi_crown_south_mill", "crown_south_mill", "mill", "lm_mill_house",
     [("mill_wheel", 6, 4), ("handcart", 2, 6), ("fence_h", 1, 2), ("log_pile", 6, 6)]),
]


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def compile_all() -> dict:
    atlas = json.loads((ART / "atlas.v1.json").read_text(encoding="utf-8"))
    sites = []
    for poi, site_id, profile, landmark, extras in SITES:
        base = "grass" if profile == "orchard" else "gravel"
        rows = [[f"{base}_{(x + y) % 4}" for x in range(8)] for y in range(8)]
        for y in range(3, 6):
            for x in range(2, 6):
                rows[y][x] = f"soil_{(x + y) % 4}" if profile == "orchard" else f"gravel_{(x + y) % 4}"
        overlays = [{"frame": f"road_dirt_{10 if y < 7 else 4}", "cell": [x, y], "layer": "road"}
                    for y in range(4, 8) for x in (3, 4)]
        props = [{"frame": landmark, "local_px": [72, 64], "role": "authored_landmark", "collision_change": False}]
        for frame, x, y in extras:
            role = "ordinary_harvestable" if frame in ("tree_orchard", "beehive") else "background_scenery"
            props.append({"frame": frame, "local_px": [x * 16 + 8, y * 16 + 16], "role": role, "collision_change": False})
        sites.append({
            "poi_id": poi, "a8_site_id": site_id, "profile": profile,
            "bounds_px": [128, 128], "tile_px": 16, "action_socket_px": [64, 64],
            "entry_portal_px": [64, 108], "doorway_clear_rect_px": [44, 92, 40, 36],
            "ground_rows": rows, "overlays": overlays, "props": props,
            "authority": "VISUAL_ONLY_A8_OWNS_INTERACTION_A0_OWNS_MOUNT",
            "collision_change": False, "new_poi_count": 0,
        })
    doc = {
        "schema": "soh.world.a8_shell_visuals.v1", "owner": "A1", "consumer": "A8",
        "status": "EXECUTABLE_VISUAL_SKIN_NOT_A_MOUNT",
        "source_review": {"pr": 26, "head_sha": A8_HEAD,
                          "files": ["native_poi_shell.gd", "south_quarry.json", "south_orchard_ruin.json", "south_crown_mill.json"]},
        "atlas_sha256": sha(ART / "atlas.v1.json"),
        "requirements": {"tile_px": 16, "texture_filter": "nearest", "prop_scale": 1.0,
                         "integer_scale_only": True, "shared_palette_ramp": True, "doorway_must_remain_clear": True},
        "sites": sites,
    }
    (ART / "a8_shell_visuals.v1.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "sites": len(sites), "atlas_sha256": doc["atlas_sha256"]}


if __name__ == "__main__":
    print(json.dumps(compile_all(), sort_keys=True))
