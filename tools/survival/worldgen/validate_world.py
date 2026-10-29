"""Deterministic SURV-050A validator. Static/data gate, NOT native gameplay proof.

Run: python3 tools/survival/worldgen/validate_world.py
Exit 0 only if every check passes. Negative fixtures live in tests/survival/world.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from collections import defaultdict, deque
from pathlib import Path

from build_contract import REQUIRED_LAYERS, BINARY_LAYERS, BUILD_PERMISSION

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "survival" / "world"


def load(path=OUT / "world_plan.v1.json"):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def decode_rle(rle, total):
    """Strict RLE decode: positive integer counts, non-negative integer values,
    no overrun/underrun. Negative counts are rejected, not silently ignored."""
    if not isinstance(rle, list) or not rle:
        raise ValueError("RLE must be a non-empty list of [value, count] pairs")
    if not isinstance(total, int) or isinstance(total, bool) or total <= 0:
        raise ValueError("RLE total must be a positive integer")
    out = []
    used = 0
    for pair in rle:
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            raise ValueError("RLE pair must be [value, count]")
        v, n = pair
        if isinstance(v, bool) or not isinstance(v, int) or v < 0:
            raise ValueError(f"RLE value must be a non-negative integer, got {v!r}")
        if isinstance(n, bool) or not isinstance(n, int) or n <= 0:
            raise ValueError(f"RLE count must be a positive integer, got {n!r}")
        if used + n > total:
            raise ValueError(f"RLE overrun {used + n} > {total}")
        out.extend([v] * n)
        used += n
    if used != total:
        raise ValueError(f"RLE underrun {used} != {total}")
    return out


def layer_allowed_values(layer, chunk, plan):
    legend = chunk.get("legend", {})
    if layer in ("region", "biome", "surface"):
        names = legend.get(layer, [])
        return set(range(1, len(names) + 1))
    if layer == "hazard":
        return set(range(0, len(legend.get("hazard", [])) + 1))
    if layer in BINARY_LAYERS:
        return {0, 1}
    if layer == "build_permission":
        return set(BUILD_PERMISSION)
    if layer == "elevation_band":
        return None  # any non-negative integer; legacy unknown is 0
    return None


def validate_chunk_document(chunk, plan, manifest=None):
    """Identity, bounds, legend, RLE and layer-value checks for one chunk."""
    errors = []
    def err(code, msg): errors.append({"code": code, "message": msg})
    if not isinstance(chunk, dict):
        return [{"code": "CHUNK_TYPE", "message": "chunk is not an object"}]
    if chunk.get("schema") != "soh.world.chunk.v1":
        err("CHUNK_SCHEMA", "not a world chunk v1")
    frame = plan["frame"]; size = plan["chunk_size"]
    w, h = frame["w"], frame["h"]
    origin = chunk.get("origin"); dims = chunk.get("size")
    if not isinstance(origin, list) or len(origin) != 2 or not all(isinstance(v, int) and not isinstance(v, bool) for v in origin):
        err("CHUNK_ORIGIN", "origin must be [int, int]")
        return errors
    if not isinstance(dims, list) or len(dims) != 2 or not all(isinstance(v, int) and not isinstance(v, bool) and v > 0 for v in dims):
        err("CHUNK_SIZE", "size must be [positive int, positive int]")
        return errors
    ox, oy = origin; cw, ch = dims
    if ox % size or oy % size:
        err("CHUNK_ALIGN", f"origin {origin} not aligned to chunk size {size}")
    cx, cy = ox // size, oy // size
    expected_id = f"chunk:{cx}:{cy}"
    if chunk.get("chunk_id") != expected_id:
        err("CHUNK_IDENTITY", f"chunk_id {chunk.get('chunk_id')} != {expected_id}")
    if ox < 0 or oy < 0 or ox + cw > w or oy + ch > h or cw > size or ch > size:
        err("CHUNK_BOUNDS", f"chunk {origin} {dims} outside frame {w}x{h}")
    expected_path = f"chunks/{cx:02d}_{cy:02d}.json"
    if manifest is not None:
        if manifest.get("chunk_id") != chunk.get("chunk_id"):
            err("CHUNK_MANIFEST_ID", "manifest chunk_id mismatch")
        if manifest.get("origin") != origin or manifest.get("size") != dims:
            err("CHUNK_MANIFEST_BOUNDS", "manifest origin/size mismatch")
        if manifest.get("path") != expected_path:
            err("CHUNK_PATH", f"manifest path {manifest.get('path')} != {expected_path}")
    layers = chunk.get("layers")
    if not isinstance(layers, dict):
        err("CHUNK_LAYERS", "layers missing")
        return errors
    for layer in REQUIRED_LAYERS:
        if layer not in layers:
            err("CHUNK_LAYER_MISSING", f"missing required layer {layer}")
    legend = chunk.get("legend", {})
    for key, expected in (("region", {r["region_id"] for r in plan["regions"]}),
                          ("biome", set(plan["biomes"])),
                          ("hazard", {hz["hazard_id"] for hz in plan["hazards"]})):
        names = legend.get(key)
        if not isinstance(names, list) or len(names) != len(set(names)) or set(names) != expected:
            err("CHUNK_LEGEND", f"{key} legend does not match plan identities")
    total = cw * ch
    decoded = {}
    for layer in REQUIRED_LAYERS:
        if layer not in layers:
            continue
        try:
            vals = decode_rle(layers[layer], total)
        except ValueError as e:
            err("RLE_INVALID", f"{layer}: {e}")
            continue
        decoded[layer] = vals
        allowed = layer_allowed_values(layer, chunk, plan)
        if allowed is not None:
            bad = next((v for v in vals if v not in allowed), None)
            if bad is not None:
                err("LAYER_VALUE", f"{layer} contains unknown value {bad}")
    if "preserved" in decoded and "build_permission" in decoded:
        for i, (pres, perm) in enumerate(zip(decoded["preserved"], decoded["build_permission"])):
            if pres and perm != 2:
                err("LEGACY_BUILD_AUTHORITY", f"preserved cell {i} build_permission={perm}, expected 2 (delegate to A0)")
                break
            if not pres and perm == 2:
                err("BUILD_AUTHORITY", f"new-land cell {i} incorrectly delegates to legacy A0 inset")
                break
    return errors


def reconstruct(plan, layer):
    w, h = plan["frame"]["w"], plan["frame"]["h"]
    grid = [0] * (w * h)
    for m in plan["chunk_manifest"]:
        c = json.loads((OUT / m["path"]).read_text(encoding="utf-8"))
        ox, oy = c["origin"]; cw, ch = c["size"]
        vals = decode_rle(c["layers"][layer], cw * ch)
        for y in range(ch):
            for x in range(cw):
                grid[(oy + y) * w + ox + x] = vals[y * cw + x]
    return grid


def flood(walk, w, h, origin):
    ox, oy = origin
    if not (0 <= ox < w and 0 <= oy < h) or not walk[oy * w + ox]:
        return set()
    s = oy * w + ox
    seen = {s}; q = deque([s])
    while q:
        c = q.popleft(); x, y = c % w, c // w
        for xx, yy in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= xx < w and 0 <= yy < h:
                n = yy * w + xx
                if walk[n] and n not in seen:
                    seen.add(n); q.append(n)
    return seen


def validate(plan, check_files=True, check_chunks=True):
    errors = []
    warn = []
    def err(code, msg): errors.append({"code": code, "message": msg})

    if plan.get("schema") != "soh.world.masterplan.v1":
        err("SCHEMA", "not a world masterplan v1")
        return {"ok": False, "errors": errors, "warnings": warn}

    # identity uniqueness
    for key, idfield in [("regions","region_id"),("pois","poi_id"),("resource_nodes","node_id"),("resource_sites","site_id")]:
        ids = [r[idfield] for r in plan[key]]
        if len(ids) != len(set(ids)):
            err("DUP_ID", f"duplicate {idfield}")
    rids = {r["region_id"] for r in plan["regions"]}
    pids = {p["poi_id"] for p in plan["pois"]}
    mats = set(plan["materials"])
    caps = set(plan["capabilities"])

    # region coverage
    area = sum(r["rect"][2] * r["rect"][3] for r in plan["regions"])
    if area != plan["frame"]["w"] * plan["frame"]["h"]:
        err("REGION_COVERAGE", f"region area {area} != frame")
    for r in plan["regions"]:
        if not r["identity"] or not r["revisit_hook"]:
            err("REGION_THIN", f"{r['region_id']} lacks identity/revisit")
        if not set(r["entry_capabilities"]) <= caps:
            err("BAD_CAP", f"{r['region_id']} entry cap unknown")

    # legacy preservation
    legacy = [p for p in plan["pois"] if p.get("preserved_legacy")]
    if len(legacy) != 10:
        err("LEGACY_COUNT", f"expected 10 preserved dungeons, got {len(legacy)}")
    sq = plan["starter_quarter"]
    for p in legacy:
        x, y = p["cell"]
        if not (sq["x"] <= x < sq["x"] + sq["w"] and sq["y"] <= y < sq["y"] + sq["h"]):
            err("LEGACY_QUARTER", f"{p['poi_id']} outside starter quarter")
        if "threshold" not in p:
            err("LEGACY_THRESHOLD", f"{p['poi_id']} missing threshold")
    if check_files:
        lock = json.loads((OUT / "baseline_lock.json").read_text(encoding="utf-8"))
        for rel, digest in lock["files"].items():
            f = ROOT / rel
            if not f.exists() or sha(f.read_bytes()) != digest:
                err("BASELINE_DRIFT", f"protected baseline file changed: {rel}")
        base_lm = {l["id"]: l for l in lock["landmarks"]}
        for p in legacy:
            lid = p["poi_id"].replace("legacy_", "")
            if lid not in base_lm:
                err("LEGACY_ID", f"unknown legacy {lid}")
            elif p["threshold"] != base_lm[lid]["threshold"] or p["cell"] != base_lm[lid]["pos"]:
                err("LEGACY_MOVED", f"{lid} entrance moved")

    # seam safety: never intersect a dungeon/camp/shortcut clearance
    if check_files:
        lock = json.loads((OUT / "baseline_lock.json").read_text(encoding="utf-8"))
        protected = [l["threshold"] for l in lock["landmarks"]] + [c["pos"] for c in lock["camps"]] + [s["pos"] for s in lock["shortcuts"]]
        for s in plan["legacy_seam_carves"]:
            x0,y0,x1,y1 = s["carve"]
            for px,py in protected:
                if x0-5 <= px <= x1+5 and y0-5 <= py <= y1+5:
                    err("SEAM_PROTECTED", f"{s['id']} intersects protected clearance at {px},{py}")

    # hydrology: downhill vertices, valid outlets
    lake_ids = {l["lake_id"] for l in plan["lakes"]}
    river_ids = {r["river_id"] for r in plan["rivers"]}
    for r in plan["rivers"]:
        vs = r["vertices"]
        for a,b in zip(vs, vs[1:]):
            if b[2] > a[2] + 1e-6:
                err("RIVER_UPHILL", f"{r['river_id']} {a}->{b}")
        out = r["outlet"]
        if out.startswith("lake:") and out[5:] not in lake_ids:
            err("RIVER_OUTLET", f"{r['river_id']} missing lake outlet")
        if out.startswith("river:") and out[6:] not in river_ids:
            err("RIVER_OUTLET", f"{r['river_id']} missing river outlet")
    for l in plan["lakes"]:
        if l["water_level_m"] < 0:
            err("LAKE_LEVEL", f"{l['lake_id']} negative level")

    # resources: sources exist, causes exist, caps valid
    site_by_id = {s["site_id"]: s for s in plan["resource_sites"]}
    mat_sites = defaultdict(list)
    for s in plan["resource_sites"]:
        if s["material_key"] not in mats:
            err("MAT_UNKNOWN", f"{s['site_id']} material {s['material_key']}")
        if s["placed_count"] <= 0:
            err("SITE_EMPTY", f"{s['site_id']} has no nodes")
        if not s["cause"]:
            err("SITE_NO_CAUSE", f"{s['site_id']} lacks geological/ecological cause")
        mat_sites[s["material_key"]].append(s["site_id"])
    for n in plan["resource_nodes"]:
        if n["site_id"] not in site_by_id:
            err("NODE_ORPHAN", f"{n['node_id']} missing site")
        if n["region_id"] not in rids:
            err("NODE_REGION", f"{n['node_id']} bad region")
        if not set(n["required_capabilities"]) <= caps:
            err("NODE_CAP", f"{n['node_id']} bad cap")
        if not n["renewal"]:
            err("NODE_RENEWAL", f"{n['node_id']} no renewal policy")
    for p in plan["pois"]:
        for m in p["material_keys"]:
            if m not in mats:
                err("POI_MAT", f"{p['poi_id']} unknown material {m}")
            elif m not in mat_sites and not p["preserved_legacy"]:
                err("POI_MAT_NO_SOURCE", f"{p['poi_id']} material {m} has no world source")

    # capability graph acyclic + source POI grants it
    graph = {c: set(v.get("requires", [])) for c,v in plan["capabilities"].items()}
    state = {}
    def dfs(c):
        if state.get(c) == 1: return False
        if state.get(c) == 2: return True
        state[c] = 1
        for d in graph.get(c, ()):
            if d not in graph or not dfs(d):
                return False
        state[c] = 2
        return True
    for c in graph:
        if not dfs(c):
            err("CAP_CYCLE", f"capability cycle/unknown at {c}")
    for c,v in plan["capabilities"].items():
        src = v.get("source")
        if src not in pids:
            err("CAP_SOURCE", f"{c} source POI missing")
        else:
            poi = next(p for p in plan["pois"] if p["poi_id"] == src)
            if c not in poi["grants_capabilities"]:
                err("CAP_NOT_GRANTED", f"{c} not granted by {src}")
    for p in plan["pois"]:
        if not set(p["required_capabilities"]) <= caps:
            err("POI_CAP", f"{p['poi_id']} unknown required cap")
        if p["region_id"] not in rids:
            err("POI_REGION", f"{p['poi_id']} bad region")
        if not p["purpose"]:
            err("POI_THIN", f"{p['poi_id']} no purpose")

    # POI density and spacing
    new_pois = [p for p in plan["pois"] if not p.get("preserved_legacy")]
    by_region = defaultdict(list)
    for p in new_pois:
        by_region[p["region_id"]].append(p)
    for rid in rids:
        if len(by_region[rid]) < 5:
            err("POI_DENSITY", f"{rid} has {len(by_region[rid])} new POIs (<5)")
    for i,p in enumerate(new_pois):
        for q in new_pois[i+1:]:
            d = math.hypot(p["cell"][0]-q["cell"][0], p["cell"][1]-q["cell"][1])
            if d < 10:
                err("POI_TOO_CLOSE", f"{p['poi_id']} / {q['poi_id']} {d:.1f}")

    # route graph + alternatives
    rg = plan["route_graph"]
    nodes = {n["node_id"] for n in rg["nodes"]}
    edges = rg["edges"]
    eids = [e["route_id"] for e in edges]
    if len(eids) != len(set(eids)):
        err("ROUTE_DUP", "duplicate route id")
    for e in edges:
        if e["from"] not in nodes or e["to"] not in nodes:
            err("ROUTE_NODE", f"{e['route_id']} endpoint missing")
        if not set(e["required_capabilities"]) <= caps:
            err("ROUTE_CAP", f"{e['route_id']} bad cap")
    trunk = [e for e in edges if e["kind"] == "trunk"]
    hubs = {n["node_id"] for n in rg["nodes"] if n["kind"] == "hub"}
    def connected_without(skip):
        adj = defaultdict(set)
        for e in trunk:
            if e["route_id"] == skip: continue
            adj[e["from"]].add(e["to"]); adj[e["to"]].add(e["from"])
        start = next(iter(hubs)); seen={start}; q=deque([start])
        while q:
            c=q.popleft()
            for n in adj[c]:
                if n not in seen: seen.add(n); q.append(n)
        return hubs <= seen
    for e in trunk:
        if not connected_without(e["route_id"]):
            err("ROUTE_NO_ALT", f"removing {e['route_id']} disconnects hub network")

    # chunk integrity + traversal
    if check_chunks:
        w,h = plan["frame"]["w"], plan["frame"]["h"]
        expected_chunks = ((w + plan["chunk_size"] - 1) // plan["chunk_size"]) * ((h + plan["chunk_size"] - 1) // plan["chunk_size"])
        if len(plan["chunk_manifest"]) != expected_chunks:
            err("CHUNK_COUNT", f"manifest has {len(plan['chunk_manifest'])} chunks, expected {expected_chunks}")
        seen_ids = set()
        for m in plan["chunk_manifest"]:
            cid = m.get("chunk_id")
            if cid in seen_ids:
                err("CHUNK_DUP", f"duplicate manifest chunk {cid}")
            seen_ids.add(cid)
            p = OUT / m["path"]
            if not p.exists():
                err("CHUNK_MISSING", m["path"]); continue
            if sha(p.read_bytes()) != m["sha256"]:
                err("CHUNK_HASH", m["path"])
            try:
                chunk = json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                err("CHUNK_JSON", f"{m['path']}: {e}"); continue
            for e in validate_chunk_document(chunk, plan, m):
                err(e["code"], f"{m['path']}: {e['message']}")
        if any(e["code"] in {"RLE_INVALID", "CHUNK_LAYER_MISSING", "CHUNK_JSON", "CHUNK_TYPE"} for e in errors):
            return {"ok": False, "errors": errors, "warnings": warn,
                    "checks": {"regions": len(rids), "pois": len(plan["pois"]), "new_pois": len(new_pois),
                               "resource_nodes": len(plan["resource_nodes"]), "routes": len(edges),
                               "chunks": len(plan["chunk_manifest"]), "long_run_goals": len(plan["long_run_goals"])}}
        walk = reconstruct(plan, "walk")
        road_grid = reconstruct(plan, "road")
        origin = tuple(json.loads((OUT/"baseline_lock.json").read_text())["spawn_resolved"]) if check_files else (56,218)
        reach = flood(walk, w, h, origin)
        for seam in plan.get("legacy_seam_carves", []):
            x0, y0, x1, y1 = seam["carve"]
            ok = True
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    i = y * w + x
                    if not walk[i] or not road_grid[i]:
                        ok = False
            fx, fy = seam["from"]; tx, ty = seam["to"]
            if not ok or fy * w + fx not in reach or ty * w + tx not in reach:
                err("SEAM_DISCONNECT", f"{seam['id']} carve is not walkable/road-connected from spawn")
        for p in new_pois:
            x,y=p["cell"]
            if y*w+x not in reach:
                err("POI_UNREACHABLE", f"{p['poi_id']} physically unreachable")
        for n in plan["resource_nodes"]:
            x,y=n["cell"]
            if y*w+x not in reach:
                err("NODE_UNREACHABLE", f"{n['node_id']} physically unreachable")
        # biome/region consistency on a sampled grid
        region_grid = reconstruct(plan, "region")
        biome_grid = reconstruct(plan, "biome")
        biome_names = sorted(plan["biomes"])
        region_names = [r["region_id"] for r in plan["regions"]]
        allowed = {r["region_id"]: set(r["allowed_biomes"]) | {"riverine","lake","ocean"} for r in plan["regions"]}
        for y in range(0,h,4):
            for x in range(0,w,4):
                i=y*w+x
                rid = region_names[region_grid[i]-1] if region_grid[i] else None
                b = biome_names[biome_grid[i]-1] if biome_grid[i] else None
                if rid and b and b not in allowed[rid]:
                    err("BIOME_REGION", f"{rid} cell {x},{y} biome {b} not allowed")
                    break
            else:
                continue
            break

    # empty space and long-run depth
    m = plan["metrics"]
    if m["empty_space_ratio"] > 0.05:
        err("EMPTY_SPACE", f"empty ratio {m['empty_space_ratio']} > 0.05")
    if m["max_distance_to_meaningful_anchor_tiles"] > 96:
        err("EMPTY_MAX", f"max anchor distance {m['max_distance_to_meaningful_anchor_tiles']} > 96")
    if len(plan["long_run_goals"]) < 3:
        err("LONGRUN", "fewer than 3 post-14d goals")
    if m["capability_access_counts"]["novice"] < 10:
        err("NOVICE_STARVED", "novice has too few accessible new POIs")
    late = [p for p in new_pois if p["band"] == "late"]
    mid_caps = {"cap_salvage","cap_seal_1","cap_power_1","cap_thermal","cap_filter","cap_climb","cap_boat","cap_seal_2","cap_stormward"}
    late_core = [p for p in late if p.get("core_family_contract")]
    if late_core and any(set(p["required_capabilities"]) <= mid_caps for p in late_core):
        err("MID_BYPASS", "a late core/specimen vault is fully accessible with mid preparation")
    return {"ok": not errors, "errors": errors, "warnings": warn,
            "checks": {"regions": len(rids), "pois": len(plan["pois"]), "new_pois": len(new_pois),
                       "resource_nodes": len(plan["resource_nodes"]), "routes": len(edges),
                       "chunks": len(plan["chunk_manifest"]), "long_run_goals": len(plan["long_run_goals"])}}


def schema_validate(plan):
    try:
        import jsonschema
    except ImportError:
        return {"available": False, "note": "jsonschema not installed; structural validator still ran"}
    results = {}
    sdir = OUT / "schemas"
    def val(name, obj):
        schema = json.loads((sdir / f"{name}.schema.json").read_text())
        try:
            jsonschema.validate(obj, schema); results[name] = "PASS"
        except jsonschema.ValidationError as e:
            results[name] = f"FAIL: {e.message}"
    val("masterplan", plan)
    reader_path = OUT / "reader_contract.json"
    if reader_path.exists():
        val("reader_contract", json.loads(reader_path.read_text(encoding="utf-8")))
    val("identity", plan["identity_contract"])
    val("hydrology", {"rivers": plan["rivers"], "lakes": plan["lakes"], "subsurface_hydrology": plan["subsurface_hydrology"]})
    for r in plan["regions"]: val("region", r)
    for b in plan["biomes"].values(): val("biome", b)
    for p in plan["pois"]: val("poi", p)
    for n in plan["resource_nodes"]: val("resource", n)
    for e in plan["route_graph"]["edges"]: val("route", e)
    return {"available": True, "results": results}


if __name__ == "__main__":
    plan = load()
    report = validate(plan)
    report["schema"] = schema_validate(plan)
    print(json.dumps(report, indent=2))
    sys.exit(0 if report["ok"] and all(v == "PASS" for v in report["schema"].get("results", {}).values()) else 1)
