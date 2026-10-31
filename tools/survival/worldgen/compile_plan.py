"""Deterministic SURV-050A compiler: authored source -> machine-readable plan.

Run: python3 tools/survival/worldgen/compile_plan.py
Writes only under data/survival/world/. Never touches production overworld data.
"""
from __future__ import annotations

import hashlib
import json
import math
from array import array
from collections import deque
from pathlib import Path

import authoring as A
import product_contracts as PC
from baseline import Baseline, ROOT
from build_contract import LAYER_SEMANTICS, REQUIRED_LAYERS

OUT = ROOT / "data" / "survival" / "world"
CHUNK_DIR = OUT / "chunks"
SURFACES = ["grass","moor","gravel","floor","snow","forest","tundra","sand","water","ash","badland","salt","jungle","karst","marsh","mangrove","mud","orchard","bog","road","bridge","legacy"]
BIOME_IDS = sorted(A.BIOMES)
REGION_IDS = [r[0] for r in A.REGIONS]
HAZARD_IDS = [h[0] for h in A.HAZARDS]
REGION_CAPS = {
    "r_ashen_crown": [], "r_amberwood": [], "r_mirrormere": [],
    "r_frost_crown": ["cap_thermal"], "r_glasswind_coast": ["cap_thermal"],
    "r_ember_steppe": ["cap_filter"], "r_saffron_coast": ["cap_thermal"],
    "r_verdant_fold": ["cap_filter", "cap_climb"], "r_pearl_mangroves": ["cap_boat"],
    "r_sunken_orchard": ["cap_deepward"], "r_ashwater_fen": ["cap_filter"],
}


def canon(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def rle(vals):
    out = []
    last = None
    n = 0
    for v in vals:
        if v == last:
            n += 1
        else:
            if last is not None:
                out.append([last, n])
            last, n = v, 1
    if last is not None:
        out.append([last, n])
    return out


def point_in_poly(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t


def region_at(x, y):
    for rid, _name, rect, *_ in A.REGIONS:
        rx, ry, rw, rh = rect
        if rx <= x < rx + rw and ry <= y < ry + rh:
            return rid
    return "r_ashen_crown"


REGION_RECT = {r[0]: r[2] for r in A.REGIONS}
REGION_BASE = {r[0]: r[4] for r in A.REGIONS}
REGION_MOIST = {"r_ashen_crown":0.45,"r_frost_crown":0.50,"r_glasswind_coast":0.60,"r_ember_steppe":0.20,
                "r_saffron_coast":0.15,"r_verdant_fold":0.90,"r_pearl_mangroves":0.95,"r_amberwood":0.65,
                "r_mirrormere":0.80,"r_sunken_orchard":0.75,"r_ashwater_fen":0.90}


def _hash2(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 144269) & 0x7fffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0x7fffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def value_noise(x, y, scale, seed=0):
    gx, gy = x / scale, y / scale
    x0, y0 = int(gx // 1), int(gy // 1)
    fx, fy = gx - x0, gy - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = _hash2(x0, y0, seed); b = _hash2(x0 + 1, y0, seed)
    c = _hash2(x0, y0 + 1, seed); d = _hash2(x0 + 1, y0 + 1, seed)
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fbm(x, y, seed=0):
    return 0.6 * value_noise(x, y, 96, seed) + 0.3 * value_noise(x, y, 32, seed + 1) + 0.1 * value_noise(x, y, 8, seed + 2)


def blended_base_elev(rid, x, y):
    base = REGION_BASE[rid]
    rx, ry, rw, rh = REGION_RECT[rid]
    d = min(x - rx, rx + rw - 1 - x, y - ry, ry + rh - 1 - y)
    if d >= 32:
        return base
    # blend toward the neighbouring region across the nearest ownership edge
    nx, ny = x, y
    if d == x - rx: nx = rx - 1
    elif d == rx + rw - 1 - x: nx = rx + rw
    elif d == y - ry: ny = ry - 1
    else: ny = ry + rh
    nrid = region_at(max(0, min(A.FRAME["w"] - 1, nx)), max(0, min(A.FRAME["h"] - 1, ny)))
    if nrid == rid:
        return base
    t = 0.5 * (1.0 - d / 32.0)
    return base * (1 - t) + REGION_BASE[nrid] * t


def coast_land(x, y):
    inside = point_in_poly(x + 0.5, y + 0.5, A.COAST)
    for cx, cy, rx, ry in A.BAYS:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
            inside = False
    for cx, cy, rx, ry in A.HEADLANDS:
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
            inside = True
    return inside


def meander(pts, width):
    out = []
    for a, b in zip(pts, pts[1:]):
        ax, ay, ae = a; bx, by, be = b
        L = math.hypot(bx - ax, by - ay)
        steps = max(2, int(L / 8))
        px, py = -(by - ay) / (L or 1), (bx - ax) / (L or 1)
        for i in range(steps):
            t = i / steps
            amp = math.sin(t * math.pi) * math.sin(L * t / 24.0 * math.pi) * width * 0.9
            out.append([ax + (bx - ax) * t + px * amp, ay + (by - ay) * t + py * amp, ae + (be - ae) * t])
    out.append(list(pts[-1]))
    return out


def legacy_biome(token):
    c = token[:1]
    return {"~":"freshwater_marsh","-":"freshwater_marsh","b":"peat_bog","m":"freshwater_marsh",";":"moorland","r":"ruin_field","g":"riverine","f":"ruin_field","F":"ruin_field","G":"ruin_field","v":"ruin_field","a":"volcanic_steppe","d":"temperate_mixed",",":"temperate_mixed","y":"ruin_field"}.get(c, "temperate_mixed")


def expand_regions():
    rows = []
    for rid, name, rect, band, elev, climate, geology, soils, biomes, resources, identity, revisit in A.REGIONS:
        rows.append({
            "region_id": rid, "name": name, "rect": rect, "band": band,
            "base_elevation_m": elev, "climate": climate, "geology": geology, "soils": soils,
            "allowed_biomes": biomes, "material_keys": resources,
            "identity": identity, "revisit_hook": revisit,
            "entry_capabilities": REGION_CAPS[rid],
            "contains_legacy_inset": rid == "r_ashen_crown",
            "status": "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED",
        })
    return rows


def expand_pois():
    pois = []
    for pid, rid, name, archetype, pos, band, purpose, mats, caps, rewards, hz, core in A.P:
        # A hazard capability is required only when the POI actually sits inside
        # the authored exposure rect. Sheltered source POIs (e.g. the thermal
        # wardhouse) must not demand the very gear they are meant to bootstrap.
        hazard_req = set()
        if hz:
            hx, hy, hw, hh = A_HAZ[hz]["rect"]
            if hx <= pos[0] < hx + hw and hy <= pos[1] < hy + hh:
                hazard_req.add(A_HAZ[hz]["requires"])
        req = sorted(set(caps) | hazard_req)
        stages = [
            {"stage": "approach", "requires": [], "note": "visible from route; environmental clue before commitment"},
            {"stage": "outer", "requires": req, "note": "gear/credential/power preparation"},
        ]
        if core:
            stages.append({"stage": "vault", "requires": sorted(set(req) | {"cap_seal_2" if band == "mid" else "cap_seal_3"}), "note": "layered specimen vault; alternate approach may reduce combat but not exposure"})
        pois.append({
            "poi_id": pid, "region_id": rid, "name": name, "archetype": archetype,
            "cell": pos, "band": band, "purpose": purpose, "material_keys": mats,
            "required_capabilities": req, "grants_capabilities": rewards,
            "hazard_id": hz, "core_family_contract": core,
            "access_stages": stages, "footprint_radius_tiles": 4,
            "refresh_policy": "outer caches restock; specimen vault one-time until world-state change",
            "alternate_approach": "rear/climb/boat route where authored; never a fake invisible wall",
            "preserved_legacy": False, "status": "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED",
        })
    return pois


A_HAZ = {h[0]: {"hazard_id": h[0], "region_id": h[1], "kind": h[2], "rect": h[3], "clue": h[4], "requires": h[5], "severity": h[6]} for h in A.HAZARDS}


def legacy_pois(base: Baseline):
    out = []
    for lm in base.world["landmarks"]:
        out.append({
            "poi_id": "legacy_" + lm["id"], "region_id": "r_ashen_crown", "name": lm["title"],
            "archetype": "chapter1_dungeon_entrance", "cell": lm["pos"], "threshold": lm["threshold"],
            "band": "early", "purpose": "Preserve existing Chapter 1 entrance and interior gameplay.",
            "material_keys": [], "required_capabilities": [], "grants_capabilities": [],
            "hazard_id": None, "core_family_contract": None,
            "access_stages": [{"stage": "approach", "requires": [], "note": "existing gameplay preserved"}],
            "footprint_radius_tiles": 5, "refresh_policy": "existing SaveService/AppFlow authority",
            "alternate_approach": "existing four shortcuts preserved", "preserved_legacy": True,
            "campaign_level_id": lm["campaign_level_id"], "status": "PRESERVED_BASELINE",
        })
    return out


def expand_rivers():
    return [{"river_id": r[0], "region_ids": r[1], "width_tiles": r[2], "vertices": r[3], "meander_vertices": meander(r[3], r[2]), "outlet": r[4], "kind": "surface"} for r in A.RIVERS]


def expand_lakes():
    return [{"lake_id": l[0], "region_id": l[1], "center": l[2], "rx": l[3], "ry": l[4], "water_level_m": l[5], "geology": l[6]} for l in A.LAKES]


def expand_routes(pois):
    nodes = {k: {"node_id": k, "cell": v, "kind": "hub"} for k, v in A.HUBS.items()}
    edges = []
    for rid, a, b, pts, mode, caps, risk in A.TRUNK:
        edges.append({"route_id": rid, "from": a, "to": b, "polyline": pts, "mode": mode, "required_capabilities": caps, "risk": risk, "kind": "trunk"})
    for p in pois:
        if p["preserved_legacy"]:
            continue
        pid = p["poi_id"]
        nodes[pid] = {"node_id": pid, "cell": p["cell"], "kind": "poi"}
        hub = min(A.HUBS, key=lambda h: math.hypot(A.HUBS[h][0] - p["cell"][0], A.HUBS[h][1] - p["cell"][1]))
        edges.append({"route_id": "sp_" + pid, "from": hub, "to": pid, "polyline": [A.HUBS[hub], p["cell"]], "mode": "foot", "required_capabilities": p["required_capabilities"], "risk": p["band"], "kind": "spur"})
    return {"nodes": list(nodes.values()), "edges": edges}


def draw_line(cells, w, h, a, b, fn, width=1):
    ax, ay = a
    bx, by = b
    steps = max(int(round(abs(bx - ax))), int(round(abs(by - ay))), 1)
    for i in range(steps + 1):
        t = i / steps
        x = int(round(ax + (bx - ax) * t))
        y = int(round(ay + (by - ay) * t))
        for dy in range(-width, width + 1):
            for dx in range(-width, width + 1):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    fn(yy * w + xx)


def build_raster(base: Baseline, pois, routes):
    w, h = A.FRAME["w"], A.FRAME["h"]
    n = w * h
    region = bytearray(n)
    biome = bytearray(n)
    surface = bytearray(n)
    elev = array("H", [0]) * n
    walk = bytearray(n)
    build = bytearray(n)
    build_permission = bytearray(n)
    hazard = bytearray(n)
    road = bytearray(n)
    preserved = bytearray(n)
    rid_index = {r: i + 1 for i, r in enumerate(REGION_IDS)}
    bio_index = {b: i + 1 for i, b in enumerate(BIOME_IDS)}
    surf_index = {s: i + 1 for i, s in enumerate(SURFACES)}
    haz_index = {hz: i + 1 for i, hz in enumerate(HAZARD_IDS)}

    for y in range(h):
        for x in range(w):
            i = y * w + x
            rid = region_at(x, y)
            region[i] = rid_index[rid]
            if not coast_land(x, y):
                biome[i] = bio_index["ocean"]; surface[i] = surf_index["water"]; walk[i] = 0; elev[i] = 0
                continue
            base_e = blended_base_elev(rid, x, y)
            ridge = 0.0
            for (ax, ay), (bx, by), amp in [((520,40),(760,80),320),((600,340),(660,400),260),((560,560),(700,620),220),((860,60),(940,160),180)]:
                d, _ = seg_dist(x, y, ax, ay, bx, by)
                ridge += amp * max(0.0, 1.0 - d / 70.0)
            rough = (fbm(x, y, 11) - 0.5) * 90.0
            e = max(0, int(base_e + ridge + rough))
            elev[i] = min(65535, e)
            moist = REGION_MOIST[rid] + (fbm(x, y, 29) - 0.5) * 0.18
            # climate + elevation + geology rules; low-frequency roughness only
            # softens boundaries, it does not scatter biomes randomly.
            if e > 1250:
                b = "alpine_snow"
            elif rid == "r_frost_crown":
                b = "boreal_forest" if (e < 980 and moist > 0.48) else ("alpine_snow" if e > 1120 else "frost_steppe")
            elif rid == "r_glasswind_coast":
                b = "coastal_scrub" if (x > 880 or e < 260) else "boreal_forest"
            elif rid == "r_ember_steppe":
                b = "ash_badland" if math.hypot(x - 630, y - 400) < 70 + (fbm(x,y,41)-0.5)*30 else "volcanic_steppe"
            elif rid == "r_saffron_coast":
                b = "salt_flat" if math.hypot(x - 880, y - 360) < 48 else ("oasis" if math.hypot(x - 780, y - 340) < 32 else "arid_coast")
            elif rid == "r_verdant_fold":
                b = "karst_orchard" if e > 380 else "tropical_forest"
            elif rid == "r_pearl_mangroves":
                b = "tidal_flat" if (y > 630 or e < 90) else "mangrove"
            elif rid == "r_amberwood":
                b = "orchard" if (60 < x < 200 and 400 < y < 500) else ("moorland" if (e > 260 and moist < 0.5) else "temperate_mixed")
            elif rid == "r_mirrormere":
                b = "freshwater_marsh" if (y > 470 or moist > 0.82) else "temperate_mixed"
            elif rid == "r_sunken_orchard":
                b = "tropical_forest" if moist > 0.86 else "karst_orchard"
            elif rid == "r_ashwater_fen":
                b = "peat_bog" if (moist > 0.86 and e < 170) else "freshwater_marsh"
            else:
                b = "volcanic_steppe" if (e > 460 and (x > 300 or y < 120)) else ("moorland" if moist < 0.4 else "temperate_mixed")
            biome[i] = bio_index[b]
            surface[i] = surf_index[A.BIOMES[b]["surface"]]
            walk[i] = 1 if A.BIOMES[b]["walkable"] else 0
            build[i] = 1 if A.BIOMES[b]["buildable"] else 0
            build_permission[i] = build[i]

    # rivers and lakes (new land only; legacy hydrology remains untouched)
    for riv in A.RIVERS:
        width = riv[2]; pts = meander(riv[3], width)
        for a, b in zip(pts, pts[1:]):
            def wet(i, a=a, b=b, width=width):
                if preserved[i]:
                    return
                x, y = i % w, i // w
                d, t = seg_dist(x, y, a[0], a[1], b[0], b[1])
                if d <= width / 2 + 1:
                    biome[i] = bio_index["riverine"]; surface[i] = surf_index["water"]; walk[i] = 0; build[i] = 0; build_permission[i] = 0
                    elev[i] = int(a[2] + (b[2] - a[2]) * t)
            draw_line(None, w, h, a[:2], b[:2], wet, width=int(width / 2 + 3))
    for l in A.LAKES:
        cx, cy = l[2]; rx, ry = l[3], l[4]
        for y in range(max(0, cy - ry - 2), min(h, cy + ry + 3)):
            for x in range(max(0, cx - rx - 2), min(w, cx + rx + 3)):
                i = y * w + x
                if preserved[i]:
                    continue
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    biome[i] = bio_index["lake"]; surface[i] = surf_index["water"]; walk[i] = 0; build[i] = 0; build_permission[i] = 0; elev[i] = l[5]

    # legacy inset: copy the production collision/ground truth verbatim
    for y in range(base.h):
        for x in range(base.w):
            i = y * w + x
            j = y * base.w + x
            preserved[i] = 1
            walk[i] = 0 if base.blocked[j] else 1
            build[i] = 0  # historical hint, NOT authority
            build_permission[i] = 2  # delegate to A0 validate_cell; never deny from build=0
            biome[i] = bio_index[legacy_biome(base.ground[j])]
            surface[i] = surf_index["legacy"]
            elev[i] = 0  # unknown legacy elevation is not fabricated

    # seam carves: the only proposed legacy edits
    for s in A.SEAMS:
        x0, y0, x1, y1 = s["carve"]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                i = y * w + x
                walk[i] = 1; road[i] = 1; surface[i] = surf_index["road"]

    # roads: trunk + spurs, bridges where a foot route crosses water
    bridges = []
    for e in routes["edges"]:
        if e["mode"] == "boat" or e["kind"] == "spur" and e["to"].startswith("legacy_"):
            continue
        pts = e["polyline"]
        for a, b in zip(pts, pts[1:]):
            def road_fn(i):
                if preserved[i] and not road[i]:
                    return
                was_water = surface[i] == surf_index["water"]
                walk[i] = 1; road[i] = 1; build[i] = 0
                if not preserved[i]:
                    build_permission[i] = 0
                surface[i] = surf_index["bridge" if was_water else "road"]
                if was_water:
                    bridges.append(i)
            draw_line(None, w, h, a, b, road_fn, width=1)

    # POI clearings
    for p in pois:
        x, y = p["cell"]
        r = p["footprint_radius_tiles"]
        for yy in range(max(0, y - r), min(h, y + r + 1)):
            for xx in range(max(0, x - r), min(w, x + r + 1)):
                i = yy * w + xx
                if not preserved[i]:
                    walk[i] = 1; build[i] = 0; build_permission[i] = 0
                    if surface[i] == surf_index["water"]:
                        surface[i] = surf_index["bridge"]

    # hazards
    for hz in A.HAZARDS:
        x0, y0, rw, rh = hz[3]
        for y in range(max(0, y0), min(h, y0 + rh)):
            for x in range(max(0, x0), min(w, x0 + rw)):
                i = y * w + x
                hazard[i] = haz_index[hz[0]]
                if hz[6] >= 3:
                    build[i] = 0
                    if not preserved[i]:
                        build_permission[i] = 0

    return {"w": w, "h": h, "region": region, "biome": biome, "surface": surface, "elev": elev,
            "walk": walk, "build": build, "build_permission": build_permission,
            "hazard": hazard, "road": road, "preserved": preserved,
            "bridges": sorted(set(bridges)), "rid_index": rid_index, "bio_index": bio_index,
            "surf_index": surf_index, "haz_index": haz_index}


def resource_nodes(raster):
    w = raster["w"]; walk = raster["walk"]; preserved = raster["preserved"]
    nodes = []
    sites = []
    for sid, rid, mat, center, count, cause, biome_constraint in A.RESOURCE_SITES:
        cx, cy = center
        placed = []
        used = set()
        for k in range(count * 12):
            if len(placed) >= count:
                break
            # deterministic outward spiral, not random scatter
            ang = k * 2.399963229728653
            rad = 2 + 1.6 * math.sqrt(k)
            x = int(round(cx + rad * math.cos(ang)))
            y = int(round(cy + rad * math.sin(ang)))
            if not (0 <= x < w and 0 <= y < raster["h"]):
                continue
            i = y * w + x
            if preserved[i] or not walk[i] or i in used:
                continue
            if any(abs(x - px) + abs(y - py) < 4 for px, py in placed):
                continue
            used.add(i); placed.append((x, y))
            nodes.append({
                "node_id": f"res:{sid}:{len(placed):02d}", "site_id": sid, "region_id": rid,
                "material_key": mat, "cell": [x, y], "cause": cause,
                "biome_constraint": biome_constraint, "required_capabilities": REGION_CAPS[rid],
                "renewal": A.MATERIALS[mat][4], "status": "CONTRACT_NOT_SPAWNED",
            })
        sites.append({"site_id": sid, "region_id": rid, "material_key": mat, "center": center,
                      "requested_count": count, "placed_count": len(placed), "cause": cause,
                      "biome_constraint": biome_constraint, "required_capabilities": REGION_CAPS[rid]})
    return sites, nodes


def flood_walk(walk, w, h, origin):
    ox, oy = origin
    if not walk[oy * w + ox]:
        return set()
    start = oy * w + ox
    seen = {start}
    q = deque([start])
    while q:
        c = q.popleft(); x, y = c % w, c // w
        for xx, yy in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= xx < w and 0 <= yy < h:
                ni = yy * w + xx
                if walk[ni] and ni not in seen:
                    seen.add(ni); q.append(ni)
    return seen


def chunk_data(raster, cx, cy):
    w = raster["w"]; size = A.CHUNK
    layers = {}
    for key in REQUIRED_LAYERS:
        if key == "elevation_band":
            continue
        arr = raster[key]
        vals = []
        for y in range(cy * size, min((cy + 1) * size, raster["h"])):
            row = y * w
            vals.extend(arr[row + cx * size: row + min((cx + 1) * size, w)])
        layers[key] = rle(vals)
    ev = []
    for y in range(cy * size, min((cy + 1) * size, raster["h"])):
        row = y * w
        ev.extend(raster["elev"][row + cx * size: row + min((cx + 1) * size, w)])
    layers["elevation_band"] = rle([e // 50 for e in ev])
    return {"schema": "soh.world.chunk.v1", "chunk_id": f"chunk:{cx}:{cy}", "origin": [cx * size, cy * size],
            "size": [min(size, w - cx * size), min(size, raster["h"] - cy * size)],
            "tile_px": A.FRAME["tile_px"], "layers": layers,
            "legend": {"region": REGION_IDS, "biome": BIOME_IDS, "surface": SURFACES, "hazard": HAZARD_IDS}}


def compile_all():
    base = Baseline()
    OUT.mkdir(parents=True, exist_ok=True)
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    lock = base.lock()
    write_json(OUT / "baseline_lock.json", lock)
    regions = expand_regions()
    pois = PC.apply_poi_readiness(expand_pois() + legacy_pois(base))
    routes = expand_routes(pois)
    raster = build_raster(base, pois, routes)
    w, h = raster["w"], raster["h"]
    # Region ownership stays rectangular for contracts, but observed biomes may
    # transition across seams; publish the actual observed set for A0/A5.
    observed = {rid: set() for rid in REGION_IDS}
    for i in range(w * h):
        observed[REGION_IDS[raster["region"][i] - 1]].add(BIOME_IDS[raster["biome"][i] - 1])
    for r in regions:
        r["primary_biomes"] = r["allowed_biomes"]
        r["allowed_biomes"] = sorted(observed[r["region_id"]])
    sites, nodes = resource_nodes(raster)
    w, h = raster["w"], raster["h"]
    reach = flood_walk(raster["walk"], w, h, base.origin)

    chunks = []
    for cy in range((h + A.CHUNK - 1) // A.CHUNK):
        for cx in range((w + A.CHUNK - 1) // A.CHUNK):
            c = chunk_data(raster, cx, cy)
            p = CHUNK_DIR / f"{cx:02d}_{cy:02d}.json"
            write_json(p, c)
            chunks.append({"chunk_id": c["chunk_id"], "path": f"chunks/{p.name}", "sha256": sha(p), "origin": c["origin"], "size": c["size"]})

    # metrics
    land = sum(1 for i in range(w * h) if raster["biome"][i] != raster["bio_index"]["ocean"])
    new_pois = [p for p in pois if not p["preserved_legacy"]]
    anchors = [p["cell"] for p in new_pois] + [s["center"] for s in sites] + list(A.HUBS.values())
    max_empty = 0; empty_gt_64 = 0; samples = 0
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            i = y * w + x
            if raster["biome"][i] == raster["bio_index"]["ocean"] or raster["preserved"][i]:
                continue
            d = min(math.hypot(x - ax, y - ay) for ax, ay in anchors)
            max_empty = max(max_empty, d); samples += 1
            if d > 64: empty_gt_64 += 1
    poi_reach = sum(1 for p in new_pois if p["cell"][1] * w + p["cell"][0] in reach)
    profiles = {
        "novice": {"cap_salvage","cap_seal_1","cap_power_1"},
        "mid": {"cap_salvage","cap_seal_1","cap_power_1","cap_thermal","cap_filter","cap_climb","cap_boat","cap_seal_2","cap_stormward"},
        "late": set(A.CAPABILITIES),
    }
    access = {name: sum(1 for p in new_pois if set(p["required_capabilities"]) <= caps) for name, caps in profiles.items()}
    metrics = {
        "frame_tiles": [w, h], "land_cells": land, "legacy_inset_cells": base.w * base.h,
        "legacy_share_of_frame": round(base.w * base.h / (w * h), 4),
        "starter_quarter_share_of_frame": 0.25,
        "new_poi_count": len(new_pois), "legacy_dungeon_count": 10,
        "resource_site_count": len(sites), "resource_node_count": len(nodes),
        "route_edge_count": len(routes["edges"]), "bridge_cells": len(raster["bridges"]),
        "physically_reachable_new_pois": poi_reach,
        "capability_access_counts": access,
        "content_readiness_counts": {k: sum(1 for p in pois if p.get("content_readiness") == k) for k in (PC.READINESS_SITE, PC.READINESS_SPEC, PC.READINESS_LEGACY)},
        "max_distance_to_meaningful_anchor_tiles": round(max_empty, 2),
        "sampled_land_cells_over_64_tiles_from_anchor": empty_gt_64,
        "sampled_new_land_cells": samples,
        "empty_space_ratio": round(empty_gt_64 / max(1, samples), 4),
        "ideal_crossing_seconds_at_96px_s": {"west_east": round(w * 16 / 96, 1), "north_south": round(h * 16 / 96, 1)},
    }
    plan = {
        "schema": "soh.world.masterplan.v1", "world_id": A.WORLD_ID, "status": "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED",
        "frame": A.FRAME, "legacy_inset": A.LEGACY, "starter_quarter": A.STARTER_QUARTER,
        "chunk_size": A.CHUNK, "baseline_lock": "baseline_lock.json",
        "layer_semantics": LAYER_SEMANTICS,
        "regions": regions, "biomes": A.BIOMES, "materials": A.MATERIALS,
        "capabilities": A.CAPABILITIES, "hazards": list(A_HAZ.values()),
        "rivers": expand_rivers(), "lakes": expand_lakes(), "subsurface_hydrology": A.SUBSURFACE,
        "legacy_seam_carves": A.SEAMS, "pois": pois, "route_graph": routes,
        "resource_sites": sites, "resource_nodes": nodes,
        "long_run_goals": A.LONG_RUN_GOALS, "chunk_manifest": chunks, "metrics": metrics,
        "identity_contract": {
            "world_id": A.WORLD_ID, "region_id_pattern": "^r_[a-z0-9_]+$", "poi_id_pattern": "^(poi|legacy_lm)_[a-z0-9_]+$",
            "chunk_id_pattern": "^chunk:[0-9]+:[0-9]+$", "resource_node_id_pattern": "^res:[a-z0-9_]+:[0-9]{2}$",
            "legacy_ids": "unchanged from data/overworld/hollow_marches.json",
            "dynamic_state": "A0 SaveService owns mutations; this plan is immutable static truth",
        },
        "integration": {
            "owner": "A0", "production_controller_changed": False, "saveservice_changed": False,
            "load_order": ["baseline_lock", "world_plan", "chunk_manifest", "chunks", "dynamic_survival_state"],
            "seam_policy": "apply legacy_seam_carves through existing shortcut/carve mechanism; never move dungeon thresholds",
            "legacy_build_delegation": "build_permission=2 inside preserved inset; call A0 validate_cell; build=0 is not a denial",
            "build_permission_layer": "build_permission",
            "overlay_precedence": LAYER_SEMANTICS["overlay_precedence"],
            "native_playable": False,
        },
    }
    write_json(OUT / "world_plan.v1.json", plan)
    write_json(OUT / "authoring_source.json", {"regions": A.REGIONS, "pois": A.P, "trunk": A.TRUNK, "resource_sites": A.RESOURCE_SITES, "rivers": A.RIVERS, "lakes": A.LAKES, "hazards": A.HAZARDS, "capabilities": A.CAPABILITIES, "materials": A.MATERIALS, "hubs": A.HUBS, "seams": A.SEAMS, "coast": A.COAST, "novice_bootstrap": A.NOVICE_BOOTSTRAP})
    # lightweight graph exports for A3/A5/A6
    write_json(OUT / "material_source_contracts.json", {
        "schema": "soh.world.material_sources.v1", "status": "AUTHORED_CONTRACT_NOT_A3_INTEGRATED",
        "materials": A.MATERIALS, "sites": sites, "nodes": nodes,
        "poi_consumers": [{"poi_id": p["poi_id"], "material_keys": p["material_keys"]} for p in pois],
        "a0_item_hints": {"timber": "oak_wood", "iron": "iron_scrap", "salvage": "iron_scrap", "stone": "stone_chunk"},
        "a1_a3_decision_contract": "a1_a3_material_decisions.json",
        "note": "material_key is a contract, not a final A3 item_id. a0_item_hints are legacy survival aliases only; fibre/rare_herb/venom_sac/frost_resin/peat/hardwood/bog_iron/glacial_iron require the explicit A1/A3 decision contract. A3 owns final mapping, yields, recipes and prices.",
    })
    write_json(OUT / "hazard_capability_contracts.json", {
        "schema": "soh.world.hazard_capabilities.v1", "status": "AUTHORED_CONTRACT_NOT_A6_INTEGRATED",
        "hazards": list(A_HAZ.values()), "capabilities": A.CAPABILITIES,
        "clue_policy": "environmental/gameplay clues before commitment; no arbitrary level walls",
        "note": "A6 owns UX/VFX presentation; A1 supplies stable labels, regions, rects, required capabilities and severity only.",
        "damage_mitigation_contract": "hazard_damage_contract.json",
        "novice_bootstrap_contract": "novice_bootstrap_contract.json",
    })
    write_json(OUT / "hazard_damage_contract.json", PC.hazard_damage_contract())
    write_json(OUT / "novice_bootstrap_contract.json", PC.novice_bootstrap_contract())
    write_json(OUT / "a1_a3_material_decisions.json", PC.material_decision_contract())
    for spec in PC.poi_authoring_specs():
        write_json(OUT / "poi_authoring" / f"{spec['poi_id']}.v1.json", spec)
    write_json(OUT / "poi_route_graph.json", {"schema": "soh.world.poi_route_graph.v1", "pois": pois, "route_graph": routes, "capabilities": A.CAPABILITIES})
    sample_cells = {
        "legacy_legal_home": [54, 222],
        "legacy_protected_camp": [56, 216],
        "new_road_no_build": [400, 200],
        "new_build_candidate": [480, 240],
    }
    write_json(OUT / "reader_contract.json", {
        "schema": "soh.world.reader_contract.v1",
        "world_id": A.WORLD_ID,
        "plan_sha256": sha(OUT / "world_plan.v1.json"),
        "frame": A.FRAME, "legacy_inset": A.LEGACY, "chunk_size": A.CHUNK,
        "required_layers": list(REQUIRED_LAYERS),
        "layer_semantics": LAYER_SEMANTICS,
        "sample_cells": sample_cells,
        "legacy_delegate_contract": {
            "callable": "A0 SurvivalBuildSystem.validate_cell(cell) -> String",
            "adapter_wrapper": "return {ok: reason.is_empty(), reason: reason}",
            "empty_reason_means": "allow",
            "missing_delegate_means": "error_legacy_build_delegate_required",
            "build_zero_in_legacy_means": "delegate_not_deny",
        },
        "native_playable": False,
    })
    write_json(OUT / "metrics.json", metrics)
    print(canon({"ok": True, "metrics": metrics, "plan_sha256": sha(OUT / "world_plan.v1.json")}))
    return plan


if __name__ == "__main__":
    compile_all()
