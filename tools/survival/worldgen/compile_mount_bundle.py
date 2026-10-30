#!/usr/bin/env python3
"""Compile the consumable A0/A8 world-art mount bundle manifest.

Exact paths + SHA-256 + placement origin + light mask + zero-collision contract +
baseline compatibility + reproducible import/check commands, so A0 can mount and
A8 can adopt shells with no reinterpretation. A0 alone mounts production; this
manifest is data, not a mount.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
WORLD = ROOT / "data/survival/world"


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def compile_all() -> dict:
    index = json.loads((ART / "presentations.v1.json").read_text(encoding="utf-8"))
    treatments = []
    for e in index["presentations"]:
        doc = json.loads((ROOT / e["path"]).read_text(encoding="utf-8"))
        treatments.append({
            "treatment_id": doc["treatment_id"], "path": e["path"], "sha256": e["sha256"],
            "biome_profile": doc["biome_profile"], "window_origin_cell": doc["window"]["origin_cell"],
            "window_size_cells": doc["window"]["size_cells"],
            "placement_origin_px": [0, 0],
            "note": "Cells are absolute overworld cells; add the node at global (0,0).",
        })
    bundle = {
        "schema": "soh.world.art_mount_bundle.v1", "owner": "A1",
        "status": "MOUNT_READY_DATA_A0_ALONE_MOUNTS_PRODUCTION",
        "renderer": {"script": "res://game/world_art/world_art_presentation.gd",
                     "shader": "res://game/world_art/world_art_ambient.gdshader",
                     "class": "WorldArtPresentation"},
        "atlas": {"manifest": rel(ART / "atlas.v1.json"), "manifest_sha256": sha(ART / "atlas.v1.json"),
                  "terrain": "res://assets/environment/survival_world/terrain.png",
                  "props": "res://assets/environment/survival_world/props.png",
                  "terrain_sha256": sha(ROOT / "assets/environment/survival_world/terrain.png"),
                  "props_sha256": sha(ROOT / "assets/environment/survival_world/props.png")},
        "presentations_index": {"path": rel(ART / "presentations.v1.json"), "sha256": sha(ART / "presentations.v1.json")},
        "treatments": treatments,
        "a8_shells": {"path": rel(ART / "a8_shell_visuals.v1.json"), "sha256": sha(ART / "a8_shell_visuals.v1.json")},
        "avfx_lighting_contract": {"path": rel(ART / "avfx_lighting_contract.v1.json"), "sha256": sha(ART / "avfx_lighting_contract.v1.json")},
        "first_hour_route": {"path": rel(WORLD / "corridor/first_hour_route.v1.json"), "sha256": sha(WORLD / "corridor/first_hour_route.v1.json")},
        "grammar": {"path": rel(ART / "world_art_grammar.v1.json"), "sha256": sha(ART / "world_art_grammar.v1.json")},
        "lighting": {"world_light_mask": 2, "inherited_vfx_mask": 1,
                     "rule": "A1 lamps range_item_cull_mask=2; Gold/Hero VFX remain mask 1, never tinted by A1."},
        "zero_collision_contract": {"collision_change": False, "stand_change": False, "economy_change": False,
                                    "new_poi_count": 0, "tile_physics_layers": 0,
                                    "focus_binding": "build(hero) then reparent hero into props_root and bind_focus(hero); occlusion excludes the focus subtree."},
        "baseline_compatibility": {
            "world_plan_sha256": sha(WORLD / "world_plan.v1.json"),
            "baseline_lock_sha256": sha(WORLD / "baseline_lock.json"),
            "corridor_sha256": sha(WORLD / "corridor/crown_roadside.corridor.v1.json"),
            "ten_thresholds_preserved": True,
        },
        "a0_mount_instructions": [
            "1. Add WorldArtPresentation as a child of the overworld at global_position Vector2.ZERO.",
            "2. load_presentation(<treatment path>, res://data/survival/world/art/atlas.v1.json); abort if false.",
            "3. build(hero); then hero.reparent(pres.props_root); pres.bind_focus(hero).",
            "4. Drive set_time_of_day(t) from the A0 world clock; occlusion steps automatically.",
            "5. Do NOT add collision/stands/rewards from art; A3 binds si:* grants; A0 SaveService unchanged.",
            "6. For A8 shells, adopt a8_shell_visuals.v1.json as the shell skin; A8 keeps collision/entry; A0 approves mount transform.",
        ],
        "import_check_commands": [
            "godot --headless --path . --import",
            ".venv/bin/python tools/survival/worldgen/validate_mount_bundle.py",
            ".venv/bin/python tools/survival/worldgen/validate_world_art.py",
            ".venv/bin/python tools/survival/worldgen/check_determinism.py",
        ],
        "consumer_validator": "tools/survival/worldgen/validate_mount_bundle.py",
        "pending": ["native on-screen inspection", "A0 production mount", "A8 shell adoption", "A6 D051 human-body composition", "exact Gold parity"],
    }
    (ART / "mount_bundle.v1.json").write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "treatments": len(treatments), "path": rel(ART / "mount_bundle.v1.json")}


if __name__ == "__main__":
    print(json.dumps(compile_all(), sort_keys=True))
