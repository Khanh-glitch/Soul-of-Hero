#!/usr/bin/env python3
"""A0/A8 consumer validation of the world-art mount bundle (no Godot required).

Verifies every referenced path/SHA, zero-collision + light-mask contract,
baseline compatibility, atlas frame resolution, A8 doorway clearance, first-hour
walkability proof and AVFX contrast floor. This is the explicit consumer gate an
A0/A8 owner runs before mounting; it is not native acceptance.
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


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def validate() -> dict:
    errors = []
    b = load(ART / "mount_bundle.v1.json")
    atlas = load(ART / "atlas.v1.json")

    def check_pin(entry, base=ROOT):
        p = base / entry["path"] if "path" in entry else base / entry.get("manifest", "")
        key = "sha256" if "sha256" in entry else "manifest_sha256"
        if not p.exists():
            errors.append(f"missing path {p}")
        elif sha(p) != entry[key]:
            errors.append(f"stale pin {p}")

    check_pin(b["atlas"])
    check_pin(b["presentations_index"])
    check_pin(b["a8_shells"])
    check_pin(b["avfx_lighting_contract"])
    check_pin(b["first_hour_route"])
    check_pin(b["grammar"])
    for t in b["treatments"]:
        p = ROOT / t["path"]
        if not p.exists() or sha(p) != t["sha256"]:
            errors.append(f"treatment pin stale {t['path']}")
            continue
        doc = load(p)
        if doc.get("collision_change") or doc.get("stand_change") or doc.get("economy_change") or doc.get("new_poi_count") != 0:
            errors.append(f"treatment claims authority {t['treatment_id']}")
        for row in doc["ground"]["rows"]:
            for f in row:
                if f not in atlas["terrain"]:
                    errors.append(f"unresolved ground frame {f}")
        for pr in doc["props"]:
            if pr["frame"] not in atlas["props"]:
                errors.append(f"unresolved prop frame {pr['frame']}")
    for sheet in ("terrain", "props"):
        if sha(ROOT / "assets/environment/survival_world" / f"{sheet}.png") != b["atlas"][f"{sheet}_sha256"]:
            errors.append(f"atlas texture pin stale {sheet}")
    if b["lighting"]["world_light_mask"] != 2 or b["lighting"]["inherited_vfx_mask"] != 1:
        errors.append("light mask contract violated")
    z = b["zero_collision_contract"]
    if z["collision_change"] or z["stand_change"] or z["economy_change"] or z["new_poi_count"] != 0 or z["tile_physics_layers"] != 0:
        errors.append("zero-collision contract violated")
    bc = b["baseline_compatibility"]
    for key, path in (("world_plan_sha256", WORLD / "world_plan.v1.json"),
                      ("baseline_lock_sha256", WORLD / "baseline_lock.json"),
                      ("corridor_sha256", WORLD / "corridor/crown_roadside.corridor.v1.json")):
        if sha(path) != bc[key]:
            errors.append(f"baseline drifted {path}")
    shells = load(ART / "a8_shell_visuals.v1.json")
    for site in shells["sites"]:
        door = site["doorway_clear_rect_px"]
        for pr in site["props"]:
            x, y = pr["local_px"]
            if door[0] <= x < door[0] + door[2] and door[1] <= y < door[1] + door[3]:
                errors.append(f"A8 doorway blocked {site['poi_id']}")
    route = load(WORLD / "corridor/first_hour_route.v1.json")
    if not route["proof"]["no_one_tile_trap"] or not route["proof"]["ten_thresholds_preserved"]:
        errors.append("first-hour route proof failed")
    avfx = load(ART / "avfx_lighting_contract.v1.json")
    if avfx["worst_case"]["contrast_ratio"] < 1.6:
        errors.append("AVFX contrast floor violated")
    return {"ok": not errors, "errors": errors, "treatments": len(b["treatments"]),
            "scope": "CONSUMER_DATA_VALIDATION_NOT_NATIVE"}


if __name__ == "__main__":
    r = validate()
    print(json.dumps(r, sort_keys=True))
    raise SystemExit(0 if r["ok"] else 1)
