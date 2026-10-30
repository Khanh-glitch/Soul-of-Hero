#!/usr/bin/env python3
"""Validate A1 world art atlas, grammar, compiled presentations and A8 contract."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
WORLD = ROOT / "data/survival/world"


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def validate() -> dict:
    errors: list[str] = []
    atlas = load(ART / "atlas.v1.json")
    grammar = load(ART / "world_art_grammar.v1.json")
    index = load(ART / "presentations.v1.json")
    contract = load(ART / "a8_visual_contract.v1.json")
    for sheet in ("terrain", "props"):
        p = ROOT / "assets/environment/survival_world" / f"{sheet}.png"
        if sha(p) != atlas["file_sha256"][sheet]:
            errors.append(f"atlas file sha mismatch: {sheet}")
    for name, r in atlas["terrain"].items():
        if r[2] != 16 or r[3] != 16 or r[0] % 16 or r[1] % 16:
            errors.append(f"terrain frame not 16px grid-aligned: {name}")
    for role, spec in grammar["semantic_roles"].items():
        for frame in spec["frames"]:
            if frame not in atlas["props"]:
                errors.append(f"grammar role {role} references missing frame {frame}")
    req = contract["requirements"]
    if req["tile_px"] != atlas["tile_px"] or req["prop_scale"] != 1.0 or not req["integer_scale_only"]:
        errors.append("A8 visual contract requirements do not match atlas")
    if index["atlas_sha256"] != sha(ART / "atlas.v1.json") or index["grammar_sha256"] != sha(ART / "world_art_grammar.v1.json"):
        errors.append("presentation index pins stale atlas/grammar")
    plan = load(WORLD / "world_plan.v1.json")
    nodes = {n["node_id"]: n for n in plan["resource_nodes"]}
    corridor = load(WORLD / "corridor/crown_roadside.corridor.v1.json")
    required = {tuple(c) for c in corridor["route"]["required_nav_cells"]}
    inst_cells = {i["instance_id"]: i["cell"] for i in corridor["instances"]}
    profiles = set()
    for entry in index["presentations"]:
        p = ROOT / entry["path"]
        if sha(p) != entry["sha256"]:
            errors.append(f"compiled presentation sha mismatch: {entry['path']}")
        doc = load(p)
        if doc.get("collision_change") or doc.get("stand_change") or doc.get("economy_change") or doc.get("new_poi_count") != 0:
            errors.append(f"presentation claims authority change: {doc['treatment_id']}")
        if doc.get("production_native_playable") is not False:
            errors.append(f"presentation must remain non-production: {doc['treatment_id']}")
        g = doc["ground"]
        if len(g["rows"]) != g["size_cells"][1] or any(len(r) != g["size_cells"][0] for r in g["rows"]):
            errors.append(f"ground row dimensions mismatch: {doc['treatment_id']}")
        for row in g["rows"]:
            for frame in row:
                if frame not in atlas["terrain"]:
                    errors.append(f"unknown terrain frame {frame}")
        if doc["counts"]["ground_cells"] != g["size_cells"][0] * g["size_cells"][1] or doc["counts"]["props"] != len(doc["props"]):
            errors.append(f"counts mismatch: {doc['treatment_id']}")
        profiles.add(doc["biome_profile"])
        for prop in doc["props"]:
            if prop["frame"] not in atlas["props"]:
                errors.append(f"unknown prop frame {prop['frame']}")
            role = prop["role"]
            if prop["frame"] not in grammar["semantic_roles"][role]["frames"]:
                errors.append(f"prop frame {prop['frame']} not admitted by role {role}")
            if prop.get("collision_change") is not False:
                errors.append(f"prop claims collision change: {prop['id']}")
            if prop["world_px"] != [prop["cell"][0] * 16 + 8, prop["cell"][1] * 16 + 16]:
                errors.append(f"prop feet anchor mismatch: {prop['id']}")
            if "instance_id" in prop and inst_cells.get(prop["instance_id"]) != prop["cell"]:
                errors.append(f"cache visual diverges from canonical instance: {prop['instance_id']}")
            if "node_id" in prop and nodes[prop["node_id"]]["cell"] != prop["cell"]:
                errors.append(f"harvestable visual diverges from canonical node: {prop['node_id']}")
            if doc["kind"] == "corridor" and tuple(prop["cell"]) in required and prop["role"] != "supply_cache":
                errors.append(f"visual prop blocks required nav: {prop['id']}")
        for view in doc["capture_views"]:
            c = view["center_cell"]
            o = doc["window"]["origin_cell"]
            s = doc["window"]["size_cells"]
            if not (o[0] <= c[0] < o[0] + s[0] and o[1] <= c[1] < o[1] + s[1]):
                errors.append(f"capture view outside window: {view['id']}")
        if doc["kind"] == "corridor" and doc["pins"]["corridor_sha256"] != sha(WORLD / "corridor/crown_roadside.corridor.v1.json"):
            errors.append("corridor visual pin stale")
    if len(profiles) < 3:
        errors.append("expected ashen + amberwood + frost presentation profiles")
    for entry in index["presentations"]:
        doc = load(ROOT / entry["path"])
        if doc.get("terrain_method") != "AUTHORED_LANDFORMS_ON_SOURCE_SURFACES_NO_NOISE_BOUNDARIES":
            errors.append(f"presentation lacks causal terrain method: {doc['treatment_id']}")
        if not doc.get("landforms"):
            errors.append(f"presentation has no authored landforms: {doc['treatment_id']}")
        for lf in doc.get("landforms", []):
            if not lf.get("reason") or lf.get("cells", 0) <= 0:
                errors.append(f"landform lacks causal reason/cells: {lf.get('id')}")
        for o in doc.get("overlays", []):
            if o.get("layer") not in ("road", "bank") or o["frame"] not in atlas["terrain"]:
                errors.append(f"overlay invalid: {o}")
        if doc["counts"].get("road_overlays", 0) != doc["counts"].get("road_cells", 0):
            errors.append(f"road overlay count mismatch: {doc['treatment_id']}")
    runtime = (ROOT / "game/world_art/world_art_presentation.gd").read_text(encoding="utf-8")
    for token in ("func bind_focus", "func _process", "occlusion.step(delta)", 'set_meta("frame_name"', "WORLD_LIGHT_MASK", "_count_collisions", "return _fail"):
        if token not in runtime:
            errors.append(f"runtime missing hardening token: {token}")
    if '"collision_bodies": 0' in runtime:
        errors.append("runtime still hardcodes collision_bodies=0")
    shells_path = ART / "a8_shell_visuals.v1.json"
    if not shells_path.exists():
        errors.append("missing A8 shell visuals")
    else:
        shells = load(shells_path)
        if shells.get("atlas_sha256") != sha(ART / "atlas.v1.json"):
            errors.append("A8 shell visuals pin stale atlas")
        for site in shells.get("sites", []):
            if site.get("bounds_px") != [128, 128] or site.get("tile_px") != 16 or site.get("collision_change") is not False:
                errors.append(f"A8 shell visual invalid scope: {site.get('poi_id')}")
            door = site["doorway_clear_rect_px"]
            for prop in site["props"]:
                if prop["frame"] not in atlas["props"]:
                    errors.append(f"A8 shell unknown frame {prop['frame']}")
                x, y = prop["local_px"]
                if door[0] <= x < door[0] + door[2] and door[1] <= y < door[1] + door[3]:
                    errors.append(f"A8 shell prop blocks doorway: {site['poi_id']} {prop['frame']}")
    return {"ok": not errors, "errors": errors, "presentations": len(index["presentations"]), "profiles": sorted(profiles)}


if __name__ == "__main__":
    result = validate()
    print(json.dumps(result, sort_keys=True))
    raise SystemExit(0 if result["ok"] else 1)
