#!/usr/bin/env python3
"""Compile the A1 canonical two-POI connector handoff and a bounded annex pilot.

A1 owns the connector contract/delta and the canonical chunk pins. This tool does
NOT edit A0 legacy sources, chapter1_overworld.gd, SaveService, or production POI
mounts. It reads the pinned legacy overworld + A1 chunk6:3 and emits:

  * committed A1-owned contract/delta under data/survival/world/connector/
  * derived pilot world/layers/props under --out (default artifacts/a1-connector)

The derived pilot is a temporary A0 composition input, not a replacement legacy
source of truth. Source hashes fail closed if A0 changes the legacy bake.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / "data/survival/world"
CONNECTOR = WORLD / "connector"
LEGACY = ROOT / "data/overworld"
DEFAULT_OUT = ROOT / "artifacts/a1-connector"

CONNECTOR_ID = "a1_crown_canonical_seam_v1"
CARVE_RECT = [368, 199, 16, 3]  # x, y, w, h; full three-row mouth, 46 actually-solid cells
ROAD_RECT = [368, 199, 16, 3]  # same as carve; all 48 cells dressed as road
APRON_CELLS: list[tuple[int, int]] = []  # native return trace proved x368,y201 corner catches the 12x16 body; mouth is fully cleared
ANNEX_CHUNK = "chunk:6:3"
ANNEX_PATH = "chunks/06_03.json"
ANNEX_ORIGIN = [384, 192]
ANNEX_SIZE = [64, 64]
COMPOSED_BOUNDS = {"x": 0, "y": 0, "w": 448, "h": 256}
TILE = 16

SOURCE_PINS = {
    "legacy_world": {"path": "data/overworld/hollow_marches.json", "sha256": "1d30ad27ba4408a4ec72d77dbc57c76bbddb214c89fd6d1309e97af742d51a19"},
    "legacy_layers": {"path": "data/overworld/hollow_marches_layers.json", "sha256": "2e7e3d9c07b4af54915d016bb826425e202346969bf8b928c0242b74f916a37d"},
    "legacy_props": {"path": "data/overworld/hollow_marches_props.json", "sha256": "ceafca1d4af01cf9b4dfff3e89de455935dc6ad0b3d1dd35d42c7230b7ffb180"},
    "a1_chunk_5_3": {"path": "data/survival/world/chunks/05_03.json", "sha256": "66badecf8838507cadae0a819da4902d464111f28334d6cc6c1bdb31c46d4032"},
    "a1_chunk_6_3": {"path": "data/survival/world/chunks/06_03.json", "sha256": "8bb0d95f7588124c9781fd942521e23b80271ef666c8cec5ce8a951002400c07"},
    "a1_waystation_slice": {"path": "data/survival/world/vertical_slice/poi_crown_waystation.slice.json", "sha256": None},
    "a1_relay_slice": {"path": "data/survival/world/vertical_slice/poi_crown_relay_shed.slice.json", "sha256": None},
    "knight_scene": {"path": "game/characters/knight/knight.tscn", "sha256": "2b29011bf361ac7e5cdde97c1fc454c69684dcb6c08e1c23186c05910a52e195"},
}
A0_PR21_PINS = {
    "ref": "origin/arena/dea2428e-soul-of-hero",
    "head": "06e00e59905ac9dfd41e37a7ca0c0ea84e2445b7",
    "chapter1_overworld_gd_sha256": "4fbcd789ee1317a2235fc171dbeeda9295111883fcc3b96024319a8723d174c7",
    "save_service_gd_sha256": "940a8cc666138102488f2189f7b6071a49917566cbd8ccc1cfbabcb3d960801d",
    "overworld_state_gd_sha256": "cde9ad81b5bb55a64023db0b4f156c6d6142054fe6d98fe546065ffee2545d07",
    "survival_build_system_gd_sha256": "ac908a97409dcdd7e78edf366844d9845dda2b71af78dee99d54923906184c2d",
    "native_blocker_run": 40931599594,
    "native_blocker_head": "ef423ad",
}
FLAT_CLIFF_PROPS = {
    "cliff_patch_a", "cliff_patch_b", "cliff_patch_c", "cliff_patch_d",
    "cliff_crack_a", "cliff_crack_b", "cliff_ledge_a", "cliff_ledge_b",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def decode(rle: list, total: int) -> list:
    out: list = []
    for token, count in rle:
        out.extend([token] * int(count))
    if len(out) != total:
        raise ValueError(f"RLE length {len(out)} != {total}")
    return out


def encode(cells: list) -> list:
    out: list = []
    for token in cells:
        if out and out[-1][0] == token:
            out[-1][1] += 1
        else:
            out.append([token, 1])
    return out


def rect_cells(rect: list[int]) -> list[tuple[int, int]]:
    x, y, w, h = rect
    return [(cx, cy) for cy in range(y, y + h) for cx in range(x, x + w)]


def check_pins() -> None:
    for key, pin in SOURCE_PINS.items():
        path = ROOT / pin["path"]
        if pin["sha256"] is None:
            pin["sha256"] = sha(path)
        elif sha(path) != pin["sha256"]:
            raise ValueError(f"source pin mismatch: {key} {path}")


def road_mask(road: set[tuple[int, int]], x: int, y: int) -> str:
    mask = 0
    if (x, y - 1) in road:
        mask |= 1
    if (x + 1, y) in road:
        mask |= 2
    if (x, y + 1) in road:
        mask |= 4
    if (x - 1, y) in road:
        mask |= 8
    return "=" + format(mask, "x")


def build_delta(legacy_layers: dict, legacy_props: dict, chunk: dict) -> dict:
    w, h = legacy_layers["width"], legacy_layers["height"]
    grids = {name: decode(entry["rle"], w * h) for name, entry in legacy_layers["layers"].items()}
    dressed = set(rect_cells(CARVE_RECT)) | set(APRON_CELLS)
    road = set(dressed)
    # Include the canonical annex road edge so the last legacy mask reads east.
    cw, ch = chunk["size"]
    ox, oy = chunk["origin"]
    chunk_road = decode(chunk["layers"]["road"], cw * ch)
    for ly in range(ch):
        for lx in range(cw):
            if chunk_road[ly * cw + lx] == 1:
                road.add((ox + lx, oy + ly))
    cell_deltas = []
    changed_solids = 0
    for x, y in sorted(dressed, key=lambda c: (c[1], c[0])):
        i = y * w + x
        before = {name: grids[name][i] for name in ("ground", "detail", "solid")}
        after = {"ground": "d", "detail": road_mask(road, x, y), "solid": "."}
        if (x, y) in APRON_CELLS:
            # Already-clear approach mouth: dress it, do not claim a collision carve.
            if before["solid"] != ".":
                raise ValueError("approach apron unexpectedly solid")
            after["solid"] = before["solid"]
        elif before["solid"] != ".":
            changed_solids += 1
        cell_deltas.append({"cell": [x, y], "before": before, "after": after})
    suppress = []
    for index, prop in enumerate(legacy_props["props"]):
        cx, cy = int(prop["x"] // TILE), int(prop["y"] // TILE)
        if (cx, cy) in set(rect_cells(CARVE_RECT)) and prop["frame"] in FLAT_CLIFF_PROPS:
            suppress.append({"index": index, "cell": [cx, cy], "frame": prop["frame"], "x": prop["x"], "y": prop["y"]})
    return {
        "schema": "soh.world.connector_delta.v1",
        "connector_id": CONNECTOR_ID,
        "source_pins": SOURCE_PINS,
        "carve_rect": CARVE_RECT,
        "road_dressing_rect": ROAD_RECT,
        "road_dressing_cells": [list(c) for c in sorted(dressed, key=lambda c: (c[1], c[0]))],
        "collision_cell_count": changed_solids,
        "dressed_cell_count": len(cell_deltas),
        "cell_deltas": cell_deltas,
        "prop_suppressions": suppress,
        "rollback": "Restore pinned legacy files byte-for-byte or apply inverse cell_deltas and reinsert suppressed props at exact indices; remove derived annex inputs.",
    }


def annex_token_maps(chunk: dict) -> tuple[dict, dict, dict]:
    cw, ch = chunk["size"]
    walk = decode(chunk["layers"]["walk"], cw * ch)
    hazard = decode(chunk["layers"]["hazard"], cw * ch)
    road = decode(chunk["layers"]["road"], cw * ch)
    surface = decode(chunk["layers"]["surface"], cw * ch)
    legend = chunk["legend"]["surface"]
    ground_map = {"road": "d", "ash": ";", "badland": "r", "gravel": "d", "moor": ";", "legacy": "b"}
    ground, detail, solid = {}, {}, {}
    for ly in range(ch):
        for lx in range(cw):
            i = ly * cw + lx
            if hazard[i] != 0:
                raise ValueError("canonical annex chunk contains unexpected hazard")
            x, y = ANNEX_ORIGIN[0] + lx, ANNEX_ORIGIN[1] + ly
            if walk[i] != 1:
                ground[(x, y)], detail[(x, y)], solid[(x, y)] = ".", ".", "#f"
                continue
            name = legend[surface[i] - 1] if surface[i] > 0 else "legacy"
            ground[(x, y)] = ground_map.get(name, ";")
            detail[(x, y)] = "=" if road[i] == 1 else "."
            solid[(x, y)] = "."
    return ground, detail, solid


def compose(legacy_world: dict, legacy_layers: dict, legacy_props: dict, chunk: dict, delta: dict) -> tuple[dict, dict, dict]:
    lw, lh = legacy_layers["width"], legacy_layers["height"]
    grids = {name: decode(entry["rle"], lw * lh) for name, entry in legacy_layers["layers"].items()}
    for record in delta["cell_deltas"]:
        x, y = record["cell"]
        i = y * lw + x
        for name, token in record["before"].items():
            if grids[name][i] != token:
                raise ValueError(f"delta before mismatch at {x},{y} {name}")
        for name, token in record["after"].items():
            grids[name][i] = token
    ag, ad, asolid = annex_token_maps(chunk)
    # Re-mask annex roads against the composed road network.
    road = {(x, y) for y in range(COMPOSED_BOUNDS["h"]) for x in range(COMPOSED_BOUNDS["w"])
            if (grids["detail"][y * lw + x].startswith("=") if x < lw else ad.get((x, y), ".").startswith("="))}
    cw, ch = COMPOSED_BOUNDS["w"], COMPOSED_BOUNDS["h"]
    out = {name: [] for name in grids}
    for y in range(ch):
        for x in range(cw):
            if x < lw:
                for name in out:
                    out[name].append(grids[name][y * lw + x])
                continue
            if (x, y) in ag:
                out["ground"].append(ag[(x, y)])
                out["detail"].append(road_mask(road, x, y) if ad[(x, y)] == "=" else ".")
                out["solid"].append(asolid[(x, y)])
            else:
                out["ground"].append(".")
                out["detail"].append(".")
                out["solid"].append("#f")
    layers = {"schema": "soh.overworld.layers.v1", "tile_size": TILE, "width": cw, "height": ch,
              "layers": {name: {"rle": encode(cells)} for name, cells in out.items()}}
    props = copy.deepcopy(legacy_props)
    removed = {p["index"] for p in delta["prop_suppressions"]}
    props["props"] = [p for i, p in enumerate(legacy_props["props"]) if i not in removed]
    world = copy.deepcopy(legacy_world)
    world["world_bounds"] = COMPOSED_BOUNDS
    world["layers_path"] = "annex_layers.v1.json"
    world["props_path"] = "annex_props.v1.json"
    world["canonical_connector"] = {
        "connector_id": CONNECTOR_ID,
        "annex_chunk_id": ANNEX_CHUNK,
        "annex_origin": ANNEX_ORIGIN,
        "annex_size": ANNEX_SIZE,
        "imported_chunk_count": 1,
        "coordinate_transform": "identity",
        "build_policy": "ANNEX_BUILD_DISABLED_PENDING_COMPOSITE_VALIDATOR",
        "native_playable": False,
    }
    return world, layers, props


def contract(delta: dict) -> dict:
    return {
        "schema": "soh.world.canonical_connector.v1",
        "connector_id": CONNECTOR_ID,
        "status": "APPROVED_BY_A1_EVIDENCE_GATE_PENDING_A0_PRODUCTION_NATIVE",
        "native_playable": False,
        "selected_option": "STATIC_ONE_CHUNK_ANNEX_WITH_MINIMAL_LEGACY_CARVE",
        "rejected_options": [
            {"option": "MOUNT_A1_UNCHANGED_ON_LEGACY_EDGE", "reason": "A0 native run 40931599594 proved legacy x369 cliff stops Hero before x383; A1 border bit is not legacy collision permission."},
            {"option": "DYNAMIC_STREAMING_CHUNK_MANAGER", "reason": "Correct long-term continent seam, but unnecessary lifecycle/nav/camera/save risk for one 64x64 chunk; defer until multi-chunk expansion."},
            {"option": "TELEPORT_OR_LOCAL_POI_INSET", "reason": "Violates physical canonical journey and would move/duplicate POI identity."},
        ],
        "source_pins": SOURCE_PINS,
        "a0_pr21_compatibility": A0_PR21_PINS,
        "coordinate_frame": {
            "transform": "identity; global canonical pixels = cell * 16; no local inset offset",
            "tile_px": TILE,
            "legacy_bounds": {"x": 0, "y": 0, "w": 384, "h": 256},
            "annex_bounds": {"x": 384, "y": 192, "w": 64, "h": 64},
            "composed_bounds": COMPOSED_BOUNDS,
            "unsupported_new_cells": "SOLID_FAIL_CLOSED outside chunk6:3; no second playable world",
        },
        "legacy_carve": {
            "collision_rect": CARVE_RECT,
            "road_dressing_rect": ROAD_RECT,
            "road_dressing_cells": delta["road_dressing_cells"],
            "collision_cells": delta["collision_cell_count"],
            "dressed_cells": delta["dressed_cell_count"],
            "suppressed_flat_cliff_props": len(delta["prop_suppressions"]),
            "centerline": [[368, 200], [384, 200]],
            "clearance_rows": [199, 200, 201],
            "hero_body_px": [12, 16],
            "hero_body_offset_px": [0, -8],
            "knight_collision_layer": 2,
            "knight_collision_mask": 5,
            "why_three_rows": "A0 live-shape probe uses foot anchor y*16+15 and BodyShape offset -8; the 12x16 body can overlap previous/current/next row. A one-tile centerline BFS is not sufficient.",
            "tradeoff": "Removes 46 solid cells in a 16x3 eastern-ridge mouth (x368..383,y199..201) and dresses all 48 cells; x368,y199/200 were already clear. Native return trace proved the leftover x368,y201 cliff corner catches the 12x16 body. Inside the already-authored A1 road allowance; does not move landmarks, dungeons, camps, shortcuts, POIs or rewards.",
        },
        "annex": {
            "chunk_id": ANNEX_CHUNK,
            "path": "data/survival/world/" + ANNEX_PATH,
            "sha256": SOURCE_PINS["a1_chunk_6_3"]["sha256"],
            "origin": ANNEX_ORIGIN,
            "size": ANNEX_SIZE,
            "imported_chunk_count": 1,
            "contains_only_slice_pois": ["poi_crown_waystation", "poi_crown_relay_shed"],
            "other_continent_chunks_imported": 0,
            "unmounted_pois_spawned": 0,
            "static_slice_obstacles": "A0 must mount the two slice contracts' static_obstacles as layer-1 bodies before native acceptance; no dynamic spawns.",
        },
        "approach": {
            "refuge_cell": [56, 218],
            "legacy_approach_goal": [368, 200],
            "border_crossing": [[383, 200], [384, 200]],
            "waystation_anchor": [408, 200],
            "waystation_locker_stand": [408, 199],
            "relay_anchor": [440, 236],
            "relay_crank_stand": [442, 234],
            "return": "Reverse the same physical corridor to Refuge; no teleport, payload spawn or scene swap.",
        },
        "camera": {
            "limit_left_px": 0,
            "limit_top_px": 0,
            "limit_right_px": COMPOSED_BOUNDS["w"] * TILE,
            "limit_bottom_px": COMPOSED_BOUNDS["h"] * TILE,
            "source": "existing chapter1_overworld.gd uses world.width*16 and world.height*16; composed bounds extend right limit to 7168 without a camera teleport",
        },
        "navigation": {
            "authority": "composed OverworldWorld + live prop/slice obstacle bodies, then OverworldTraversability",
            "acceptance_method": "live PhysicsShapeQueryParameters2D with pinned Knight BodyShape plus ordinary held movement; tile-center BFS alone is insufficient",
            "streaming": "none in pilot; one static annex loaded once. Future multi-chunk streaming must preserve the same global coordinates and invalidate nav/camera/build caches atomically.",
        },
        "build_permissions": {
            "legacy_connector": "Road detail '=' makes A0 _on_route_detail reject placement; legacy build_permission=2 still delegates to A0 validator, never interpreted as forbidden by A1.",
            "annex_pilot": "DISABLED_PENDING_COMPOSITE_VALIDATOR; A0 must reject placement x>=384 with annex_build_not_enabled until composite build validation is implemented. Walking is allowed.",
            "future": "Composite validator must consume A1 build_permission and protected slice nav/doorway cells; build=0 remains delegate-to-A0, not a blanket prohibition.",
        },
        "save": {
            "coordinate_space": "global canonical pixels, identity transform",
            "resume_path": ["overworld", "hollow_marches", "last_position"],
            "resume_owner": "A0 OverworldState via SaveService.patch_state_path",
            "reward_owner": "A0 SaveService.transact_once; A1 slice transaction keys and rewards unchanged",
            "migration": "No coordinate migration for existing saves with x<6144. Annex saves use the same global pixels.",
            "rollback_recovery": "If annex is disabled and saved last_position.x>=6144, A0 must recover to last_camp/Refuge through an explicit rollback path and log it; normal gameplay must never teleport.",
        },
        "rewards_lock": {
            "slice_manifest_sha256": sha(WORLD / "vertical_slice/manifest.json"),
            "waystation_slice_sha256": SOURCE_PINS["a1_waystation_slice"]["sha256"],
            "relay_slice_sha256": SOURCE_PINS["a1_relay_slice"]["sha256"],
            "locker": {"grants": ["cap_salvage"], "items": {}},
            "ledger": {"grants": ["cap_seal_1"], "items": {}},
            "cache": {"items": {"iron_scrap": 3, "knowledge_spares": 2}, "active_seconds": 1800},
            "deadfall": {"items": {"oak_wood": 2}, "active_seconds": 300},
            "relay": {"consumes": {"iron_scrap": 2, "oak_wood": 1}, "grants": ["cap_power_1"]},
            "a3_hypothetical_rewards_imported": False,
        },
        "owners": {
            "A1": "connector contract, exact delta, canonical chunk/slice pins, isolated geometry/native fixture, evidence gate",
            "A0": "apply delta in owned legacy bake or temporary composition root; source-path injection; annex build guard; mount slice obstacles/POIs; production Hero/camera/save acceptance; rollback recovery",
            "A3": "catalog/token verifier only; no reward quantity changes",
            "A6": "discovered-only connector/POI clues after A0 activation",
        },
        "acceptance_vectors": [
            {"id": "CN-01", "gate": "source pins and exact 46-cell collision / 48-cell dressing / 14-prop delta validate; rollback restores hashes"},
            {"id": "CN-02", "gate": "A0 native blocker remains reproduced on unmodified legacy: Hero stops before x369; run 40931599594"},
            {"id": "CN-03", "gate": "composed live-shape route Refuge -> border -> exact Waystation locker stand (408,199) without teleport; repaired locker-bank collision footprint, live-shape clearance and interaction range verified"},
            {"id": "CN-04", "gate": "composed live-shape route Waystation -> Relay stand around static slice obstacles"},
            {"id": "CN-05", "gate": "composed live-shape return Relay -> Refuge; camera right limit 7168 and Hero visible"},
            {"id": "CN-06", "gate": "all ten legacy dungeon thresholds, camps and discoveries remain reachable in composed nav"},
            {"id": "CN-07", "gate": "A0 production controller with source overrides repeats CN-03..06 on fresh save and reload; SaveService last_position round-trips global pixels"},
            {"id": "CN-08", "gate": "build placement rejected on connector road and disabled annex; legacy home/build tests unchanged"},
            {"id": "CN-09", "gate": "canonical rewards byte-locked; no A3 hypothetical locker/cache rewards; one receipt per entitlement"},
            {"id": "CN-10", "gate": "only chunk6:3 imported; 106 unmounted POIs not spawned; rollback/downgrade recovery explicit"},
        ],
        "rollback": {
            "a1_branch": "delete derived pilot inputs / disable source overrides; committed A1 contract/delta remain review evidence",
            "a0_bake": "restore pinned legacy world/layers/props hashes or apply inverse delta; no A1 chunk mutation",
            "save": "pre-adoption pilot saves discarded; post-adoption downgrade uses explicit annex-position recovery to camp/Refuge",
        },
    }


def compile_all(out_dir: Path = DEFAULT_OUT, write_contract: bool = True) -> dict:
    check_pins()
    legacy_world = load(LEGACY / "hollow_marches.json")
    legacy_layers = load(LEGACY / "hollow_marches_layers.json")
    legacy_props = load(LEGACY / "hollow_marches_props.json")
    chunk = load(WORLD / ANNEX_PATH)
    if chunk["chunk_id"] != ANNEX_CHUNK or chunk["origin"] != ANNEX_ORIGIN or chunk["size"] != ANNEX_SIZE:
        raise ValueError("canonical annex identity mismatch")
    delta = build_delta(legacy_layers, legacy_props, chunk)
    con = contract(delta)
    world, layers, props = compose(legacy_world, legacy_layers, legacy_props, chunk, delta)
    if write_contract:
        write(CONNECTOR / "canonical_connector.v1.json", con)
        write(CONNECTOR / "legacy_cell_delta.v1.json", delta)
    out_dir.mkdir(parents=True, exist_ok=True)
    write(out_dir / "annex_world.v1.json", world)
    write(out_dir / "annex_layers.v1.json", layers)
    write(out_dir / "annex_props.v1.json", props)
    manifest = {"schema": "soh.world.connector_pilot.v1", "connector_id": CONNECTOR_ID, "native_playable": False,
                "files": {name: {"sha256": sha(out_dir / name)} for name in ("annex_world.v1.json", "annex_layers.v1.json", "annex_props.v1.json")},
                "contract_sha256": sha(CONNECTOR / "canonical_connector.v1.json") if write_contract else None,
                "delta_sha256": sha(CONNECTOR / "legacy_cell_delta.v1.json") if write_contract else None}
    write(out_dir / "pilot_manifest.json", manifest)
    return {"ok": True, "connector_id": CONNECTOR_ID, "collision_cells": delta["collision_cell_count"],
            "dressed_cells": delta["dressed_cell_count"], "suppressed_props": len(delta["prop_suppressions"]),
            "out": str(out_dir), "native_playable": False, "pilot_manifest_sha256": sha(out_dir / "pilot_manifest.json")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--no-contract", action="store_true", help="derive pilot only; do not rewrite committed A1 contract/delta")
    args = parser.parse_args()
    print(json.dumps(compile_all(args.out, not args.no_contract), sort_keys=True))
