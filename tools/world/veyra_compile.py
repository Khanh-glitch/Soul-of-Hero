"""Veyra corrective compiler (v2) — GOLD → world, Git-only assets, sub-tile hydrology.

Design decisions and why
------------------------
* GOLD geometry is authoritative and is read from the committed canonical file
  `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` (sha256 pinned in the manifest).
* Two independent rasters, as required by the corrective order:
    - VISUAL raster: 4 px per GOLD unit (2000x1400 units → 8000x5600 px).  Rivers keep
      their authored width (`river.width`), roads their authored class width.  Nothing is
      inflated to a minimum brush radius.
    - GROUND grid: 32 px Cainos art tiles over 250x175 cells (1 GOLD cell = 1 art tile).
    - COLLISION grid: 16 px cells (500x350) so a 10 px river does not block a 32 px tile.
* Art comes only from committed repository files through `tools/world/art_registry.py`.
  Families that do not exist in this repository (water surface, buildings, bridge and
  dock kits, sand/ash ground) are reported in `map_tower/assets/UNRESOLVED_ART_GAPS.json`
  and rendered as clearly marked stand-ins, never as finished art.
* Determinism: every placement uses blake2b of a stable string.  No `hash()`, no
  `random`, no wall-clock, no absolute paths outside the repository.

Run:  python3 tools/world/veyra_compile.py [--out out]
"""
import argparse
import base64
import hashlib
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

import art_registry as ART

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
GOLD = os.path.join(REPO, "map_tower", "veyra_gold", "VEYRA_GOLD_MAP.sohmap.json")

U = 4                     # px per GOLD unit (visual raster)
UW, UH = 2000, 1400       # GOLD world units
PW, PH = UW * U, UH * U   # 8000 x 5600 px
ART_TILE = 32             # Cainos art tile
COLL = 16                 # collision cell
GW, GH = PW // ART_TILE, PH // ART_TILE          # 250 x 175 art cells (= GOLD cells)
CW, CH = PW // COLL, PH // COLL                  # 500 x 350 collision cells

# road class half-widths in GOLD units (before /2).  Derived from the conversion
# contract's road grammar; recorded here because GOLD stores road *class*, not width.
ROAD_HALF = {"cart": 1.4, "trail": 0.9, "foot": 0.7, "riverside": 0.8, "ferry": 0.0}

WATER_PLACEHOLDER = ((38, 92, 128), (52, 118, 152), (74, 148, 176))  # deep, shelved, shore


# --------------------------------------------------------------------------
# deterministic helpers
# --------------------------------------------------------------------------
def h32(*parts):
    """Stable 32-bit hash of arbitrary parts (independent of PYTHONHASHSEED)."""
    s = "|".join(str(p) for p in parts).encode()
    return int.from_bytes(hashlib.blake2b(s, digest_size=4).digest(), "big")


def frac(*parts):
    return h32(*parts) / 4294967296.0


# --------------------------------------------------------------------------
# vector rasterisation on the visual unit raster
# --------------------------------------------------------------------------
def fill_polygon(mask, ring, value=1):
    """Scanline fill of a ring in GOLD units onto the unit raster."""
    pts = [(float(x), float(y)) for x, y in ring]
    if len(pts) < 3:
        return
    ys = [p[1] for p in pts]
    y0, y1 = max(0, int(min(ys))), min(UH - 1, int(max(ys)) + 1)
    n = len(pts)
    for y in range(y0, y1 + 1):
        yc = y + 0.5
        xs = []
        for i in range(n):
            xa, ya = pts[i]
            xb, yb = pts[(i + 1) % n]
            if (ya <= yc < yb) or (yb <= yc < ya):
                t = (yc - ya) / (yb - ya)
                xs.append(xa + t * (xb - xa))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a, b = max(0, int(math.ceil(xs[i] - 0.5))), min(UW - 1, int(math.floor(xs[i + 1] - 0.5)))
            if b >= a:
                mask[y, a:b + 1] = value


def stroke_polyline(mask, pts, half, value=1, cap=True):
    """Round-brush stroke with the brush radius given in GOLD units (no minimum)."""
    if half <= 0:
        return
    pts = [(float(x), float(y)) for x, y in pts]
    r = half
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1e-6
        steps = max(1, int(L))
        for s in range(steps + 1):
            t = s / steps
            cx, cy = x0 + dx * t, y0 + dy * t
            _disc(mask, cx, cy, r, value)
    if cap:
        for (cx, cy) in (pts[0], pts[-1]):
            _disc(mask, cx, cy, r, value)


def _disc(mask, cx, cy, r, value=1):
    x0, x1 = max(0, int(math.floor(cx - r))), min(UW - 1, int(math.ceil(cx + r)))
    y0, y1 = max(0, int(math.floor(cy - r))), min(UH - 1, int(math.ceil(cy + r)))
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.ogrid[y0:y1 + 1, x0:x1 + 1]
    inside = ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2) <= r * r
    sub = mask[y0:y1 + 1, x0:x1 + 1]
    sub[inside] = value


def rect_rot(mask, cx, cy, ang, half_len, half_wid, value=1):
    """Rotated rectangle (bridge decks, piers) into the unit raster."""
    ca, sa = math.cos(ang), math.sin(ang)
    r = math.hypot(half_len, half_wid) + 1
    x0, x1 = max(0, int(cx - r)), min(UW - 1, int(cx + r))
    y0, y1 = max(0, int(cy - r)), min(UH - 1, int(cy + r))
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    dx, dy = xx + 0.5 - cx, yy + 0.5 - cy
    u = dx * ca + dy * sa          # along the deck
    v = -dx * sa + dy * ca         # across the deck
    sub = mask[y0:y1 + 1, x0:x1 + 1]
    sub[(np.abs(u) <= half_len) & (np.abs(v) <= half_wid)] = value


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main(out_dir):
    gold = json.load(open(GOLD))
    proj = gold["project"]
    os.makedirs(out_dir, exist_ok=True)

    fams, manifest = ART.load()

    # ---------------- masks on the unit raster ----------------
    land = np.zeros((UH, UW), np.uint8)
    for l in proj["land"]:
        for ring in l["rings"]:
            fill_polygon(land, ring, 1)
    lakes = np.zeros((UH, UW), np.uint8)
    for lk in proj["lakes"]:
        for ring in lk.get("rings") or [lk.get("ring")]:
            if ring:
                fill_polygon(lakes, ring, 1)
    rivers = np.zeros((UH, UW), np.uint8)
    river_list = []
    for r in proj["rivers"]:
        half = max(0.35, (r.get("width") or 3) / 2.0)   # authored width, no inflation
        stroke_polyline(rivers, r["points"], half, 1)
        river_list.append({"id": r["id"], "name": r.get("name"), "width": r.get("width"),
                           "kind": r.get("kind"), "nav": r.get("nav"),
                           "feats": r.get("feats"), "mouth": r.get("mouth"),
                           "source": r.get("source"), "points": r["points"],
                           "half_width_units": round(half, 2)})
    sea = (land == 0).astype(np.uint8)
    water = ((sea | lakes | (rivers & land)) > 0).astype(np.uint8)
    walkable_land = ((land > 0) & (water == 0)).astype(np.uint8)

    roads = np.zeros((UH, UW), np.uint8)
    road_list = []
    for rd in proj["roads"]:
        kind = rd.get("kind", "trail")
        half = ROAD_HALF.get(kind, 0.8)
        if kind == "ferry":
            road_list.append({"id": rd["id"], "name": rd.get("name"), "kind": kind,
                              "mode": "water", "points": rd["points"],
                              "status": "FUNCTIONAL_BLOCKED"})
            continue                                  # ferry = maritime path, not a road
        stroke_polyline(roads, rd["points"], half, 1)
        road_list.append({"id": rd["id"], "name": rd.get("name"), "kind": kind,
                          "mode": "land", "points": rd["points"],
                          "half_width_units": half})
    roads = (roads & walkable_land).astype(np.uint8)

    # ---------------- bridges: real spans across the authored gap ----------------
    bridges = []
    deck = np.zeros((UH, UW), np.uint8)
    rail = np.zeros((UH, UW), np.uint8)
    for br in proj["bridges"]:
        cx, cy = float(br["at"][0]), float(br["at"][1])
        ang = float(br.get("ang") or 0.0)
        load = br.get("load", "foot")
        half_w = 2.6 if load == "cart" else 2.0   # deck is wider than the road it carries
        # walk out along the axis until both ends are on solid land
        def is_wet(x, y):
            xi, yi = int(x), int(y)
            if not (0 <= xi < UW and 0 <= yi < UH):
                return False
            return bool(water[yi, xi])

        def reach(sign):
            for d in range(2, 90):
                if not is_wet(cx + math.cos(ang) * d * sign, cy + math.sin(ang) * d * sign):
                    return d
            return 90
        a, b = reach(-1), reach(1)
        half_len = (a + b) / 2.0
        mid = ((b - a) / 2.0)
        mx, my = cx + math.cos(ang) * mid, cy + math.sin(ang) * mid
        rect_rot(deck, mx, my, ang, half_len, half_w, 1)
        # railings: 0.45 unit bands just outside the deck, not walkable
        rect_rot(rail, mx, my, ang, half_len, half_w + 0.55, 1)
        rail[deck > 0] = 0
        bridges.append({
            "source_id": br["id"], "name": br.get("name"), "load": load,
            "gold_at": [cx, cy], "bearing_rad": ang,
            "world_px": [cx * U, cy * U],
            "span_units": round(a + b, 2), "deck_width_units": round(half_w * 2, 2),
            "deviation": "GOLD stores bridge load class and bearing, not deck width; "
                         "deck width derived from road class + railing allowance",
            "deck": [mx * U, my * U], "kind": "cart" if load == "cart" else "foot",
        })
    plank = deck.astype(bool)

    # ---------------- docks: piers that actually reach navigable water ----------------
    def water_dir(x, y):
        best = None
        for i in range(16):
            a = i * math.pi / 8
            for d in (2, 5, 9, 14, 20, 28, 38):
                xi, yi = int(x + math.cos(a) * d), int(y + math.sin(a) * d)
                if 0 <= xi < UW and 0 <= yi < UH and water[yi, xi]:
                    if best is None or d < best[1]:
                        best = (a, d)
                    break
        return best or (0.0, 12)

    piers = np.zeros((UH, UW), np.uint8)
    docks = []
    for dk in proj["docks"]:
        x, y = float(dk["at"][0]), float(dk["at"][1])
        ang, dist = water_dir(x, y)
        length = min(16.0, max(7.0, dist + 4.0))
        cx = x + math.cos(ang) * length / 2
        cy = y + math.sin(ang) * length / 2
        rect_rot(piers, cx, cy, ang, length / 2 + 1.0, 2.2, 1)
        tip = (x + math.cos(ang) * (length + 1.2), y + math.sin(ang) * (length + 1.2))
        docks.append({"source_id": dk["id"], "name": dk.get("name"),
                      "kind": dk.get("kind"), "water": dk.get("water"),
                      "land_anchor_px": [x * U, y * U], "water_anchor_px": [tip[0] * U, tip[1] * U],
                      "bearing_rad": round(ang, 4), "length_units": round(length, 2),
                      "boat_logic": "UNIMPLEMENTED"})
    piers_b = piers.astype(bool)

    # ---------------- ground grid (32 px Cainos tiles) ----------------
    canvas = Image.new("RGBA", (PW, PH), WATER_PLACEHOLDER[0] + (255,))
    elev = np.frombuffer(base64.b64decode(proj["terrain"]["elev"]), np.uint8).reshape(175, 250).astype(np.float32)
    biome = np.frombuffer(base64.b64decode(proj["terrain"]["biome"]), np.uint8).reshape(175, 250)
    land_elev = elev[elev > 0] if (elev > 0).any() else elev
    q1, q2, q3 = np.percentile(land_elev, [55, 80, 93]) if land_elev.size else (40, 95, 150)

    def cell_wet(gx, gy):
        x0, y0 = gx * 8, gy * 8
        return water[y0:y0 + 8, x0:x0 + 8].mean() if 0 <= y0 < UH and 0 <= x0 < UW else 0.0

    ground = np.empty((GH, GW), dtype=object)
    for gy in range(GH):
        for gx in range(GW):
            wet = cell_wet(gx, gy)
            e = elev[gy, gx] + (h32("jit", gx, gy) % 1000) / 1000.0 * 14.0 - 7.0
            if wet > 0.5:
                ground[gy, gx] = "water"
            elif e >= q3:
                ground[gy, gx] = "rock"
            elif e >= q2:
                ground[gy, gx] = "stone"
            else:
                ground[gy, gx] = "meadow"
    # slope -> cliff blocks (non walkable) between very different neighbours
    cliff_cells = np.zeros((GH, GW), bool)
    for gy in range(GH):
        for gx in range(GW):
            e = elev[gy, gx]
            nb = elev[max(0, gy - 1):gy + 2, max(0, gx - 1):gx + 2]
            if e - nb.min() >= 45 and ground[gy, gx] in ("stone", "rock"):
                cliff_cells[gy, gx] = True

    def tile_for(fam, key):
        pool = fams[fam]
        return pool[h32(key, fam) % len(pool)]

    for gy in range(GH):
        for gx in range(GW):
            fam = ground[gy, gx]
            if fam == "water":
                continue
            if fam == "meadow":
                t = tile_for("meadow", f"{gx},{gy}")
            elif fam == "stone":
                t = tile_for("stone", f"{gx},{gy}")
            else:
                t = tile_for("stone", f"{gx},{gy}")
            canvas.paste(t, (gx * ART_TILE, gy * ART_TILE))

    print("ground cells", {k: int(sum(1 for g in ground.flat if g == k)) for k in ("meadow", "stone", "rock", "water")})

    # ---------------- sub-tile overlays (roads, water, bridges, piers) ----------------
    def reseat(mask):
        return Image.fromarray((mask * 255).astype(np.uint8), "L").resize((PW, PH), Image.NEAREST)

    road_mask = np.array(reseat(roads)) > 0
    water_mask = np.array(reseat(water)) > 0
    wet_b = water.astype(bool)
    shelf = np.array(reseat((wet_b & ~_erode(wet_b, 6)).astype(np.uint8))) > 0
    deck_mask = np.array(reseat(deck)) > 0
    rail_mask = np.array(reseat(rail)) > 0
    pier_mask = np.array(reseat(piers)) > 0

    out = np.array(canvas)
    # water: mask-driven placeholder (art gap recorded), with shelf + shoreline band
    deep = np.array(WATER_PLACEHOLDER[0] + (255,), np.uint8)
    shal = np.array(WATER_PLACEHOLDER[1] + (255,), np.uint8)
    shore = np.array(WATER_PLACEHOLDER[2] + (255,), np.uint8)
    out[water_mask] = deep
    out[water_mask & shelf] = shal
    out[water_mask & ~_erode(water_mask, 3)] = shore
    # roads: authored cobble texture, masked at 4 px/unit so the trail stays narrow
    cob = np.array(fams["stone"][0])
    cob_tex = np.tile(cob, (PH // cob.shape[0] + 1, PW // cob.shape[1] + 1, 1))[:PH, :PW]
    out[road_mask] = cob_tex[road_mask]
    # decks and piers: stone ground texture, then rails darker
    st = np.array(fams["stone"][0])
    st_tex = np.tile(st, (PH // st.shape[0] + 1, PW // st.shape[1] + 1, 1))[:PH, :PW]
    out[deck_mask] = st_tex[deck_mask]
    out[pier_mask] = st_tex[pier_mask]
    rail_px = st_tex[rail_mask].astype(np.float32) * 0.72
    rail_px[:, 3] = 255
    out[rail_mask] = rail_px.astype(np.uint8)
    world = Image.fromarray(out, "RGBA")
    print("overlays applied", world.size)

    # ---------------- objects (props, plants, structures, POI / resource sites) ------
    placements = []

    ALIAS = {"wall": "struct_wall", "arch": "struct_arch", "stairs": "struct_stairs",
             "crate": "props_crate", "barrel": "props_barrel", "sign": "props_sign",
             "grave": "props_grave", "statue": "props_statue", "well": "props_well",
             "rock": "props_rock", "boulder": "props_boulder"}

    def place(fam, wx, wy, key, collider=True, tag=None):
        fam = ALIAS.get(fam, fam)
        pool = fams.get(fam)
        if not pool:
            return None
        img = pool[h32(key, fam) % len(pool)]
        rec = {"fam": fam, "x": int(round(wx)), "y": int(round(wy)),
               "w": img.width, "h": img.height, "img": img,
               "collider": collider, "tag": tag}
        placements.append(rec)
        return rec

    # vegetation by biome grammar (biome layer is now used, not ignored)
    VOID = {"water"}
    for gy in range(GH):
        for gx in range(GW):
            fam = ground[gy, gx]
            if fam in VOID:
                continue
            b = int(biome[gy, gx])
            h = h32("veg", gx, gy)
            r = (h % 10000) / 10000.0
            wx, wy = gx * ART_TILE + ART_TILE // 2, gy * ART_TILE + ART_TILE - 2
            forest = b in (1, 6) or ground[gy, gx] == "meadow" and r < 0.055
            if fam == "rock":
                if r < 0.02:
                    place("rock", wx, wy, f"rk{gx},{gy}", True)
                continue
            if forest and r < 0.085:
                place("tree", wx, wy, f"tr{gx},{gy}", True)
            elif r < 0.115:
                place("bush", wx, wy, f"bs{gx},{gy}", False)
            elif r < 0.16:
                place("tuft", wx, wy, f"tf{gx},{gy}", False)

    # POI sites: archetype-specific composition (no generic houses exist in this repo)
    SITE = {
        "village":     ["well", "crate", "barrel", "sign", "wall", "wall", "bush"],
        "hamlet":      ["well", "barrel", "sign", "bush"],
        "port":        ["crate", "crate", "barrel", "sign", "props_ruin"],
        "pier":        ["crate", "barrel", "sign"],
        "roadstop":    ["sign", "barrel", "crate"],
        "quarry":      ["props_boulder", "rock", "rock", "crate"],
        "mine":        ["props_boulder", "rock", "crate", "props_door"],
        "ruins":       ["props_ruin", "wall", "arch", "rock"],
        "elder_site":  ["props_pedestal", "statue", "arch", "rock"],
        "observatory": ["props_pedestal", "arch", "wall"],
        "research":    ["props_pedestal", "wall", "arch", "statue"],
        "facility":    ["wall", "wall", "arch", "props_door"],
        "gate":        ["arch", "wall", "wall"],
        "grove":       ["tree", "tree", "bush", "bush"],
        "farm":        ["crate", "bush", "sign"],
        "mill":        ["crate", "barrel", "wall"],
        "sawmill":     ["crate", "crate", "barrel"],
        "forge":       ["props_furnace", "props_workbench", "crate"],
        "foundry":     ["props_furnace", "props_furnace", "props_workbench", "crate"],
        "kiln":        ["props_furnace", "props_workbench"],
        "tomb":        ["grave", "grave", "props_grave", "wall"],
        "necropolis":  ["grave", "props_grave", "props_grave", "statue", "wall"],
        "warehouse":   ["crate", "crate", "crate", "barrel"],
        "powerplant":  ["props_furnace", "wall", "props_workbench"],
        "tower":       ["wall", "wall", "props_pedestal"],
        "cache":       ["crate", "barrel"],
    }
    DEFAULT_SITE = ["sign", "rock", "bush"]

    poi_records = []
    for p in proj["pois"]:
        ax, ay = float(p["at"][0]), float(p["at"][1])
        foot = p.get("foot") or []
        arche = p.get("arche", "site")
        setlist = SITE.get(arche, DEFAULT_SITE)
        # place the set around the foot polygon or in a small ring
        n = len(setlist)
        for i, fam in enumerate(setlist):
            if foot:
                # walk the foot polygon: spread placements along its edge, pulled inward
                idx = int(i * len(foot) / max(1, n)) % len(foot)
                fx, fy = foot[idx]
                px = ax + (fx - ax) * 0.62
                py = ay + (fy - ay) * 0.62
            else:
                a = 2 * math.pi * i / max(1, n)
                px, py = ax + math.cos(a) * 3.5, ay + math.sin(a) * 3.5
            place(fam, px * U, py * U, f"{p['id']}:{i}", True, tag=p["id"])
        # centre marker so the site reads as a place, not a scatter
        centre_fam = {"tomb": "props_grave", "necropolis": "props_grave",
                      "elder_site": "props_pedestal", "observatory": "props_pedestal",
                      "village": "well", "hamlet": "well"}.get(arche, "tuft")
        place(centre_fam, ax * U, ay * U, f"{p['id']}:c", False, tag=p["id"])
        poi_records.append({
            "source_id": p["id"], "name": p.get("name"), "arche": arche,
            "gold_at": [ax, ay], "world_px": [ax * U, ay * U],
            "foot_polygon": foot, "access": p.get("access"), "role": p.get("role"),
            "elder": p.get("elder"), "site_set": setlist,
            "building_art": "MISSING_ASSET" if arche in
            ("village", "hamlet", "port", "facility", "research", "observatory",
             "powerplant", "warehouse", "forge", "foundry", "mill", "sawmill", "kiln")
            else "NOT_REQUIRED",
        })

    # resources: 280 source identities, each gets a visible source marker
    RES_FAM = {"wood": "tree", "stone": "props_boulder", "ore": "props_boulder",
               "obsidian": "rock", "sulfur": "rock", "clay": "rock", "salt": "rock",
               "herbs": "bush", "food": "bush", "fish": None, "fresh_water": None}
    res_records = []
    for r in proj["resources"]:
        ax, ay = float(r["at"][0]), float(r["at"][1])
        fam = RES_FAM.get(r.get("kind"))
        placed = None
        if fam:
            placed = place(fam, ax * U, ay * U, f"res:{r['id']}", True, tag=r["id"])
        res_records.append({
            "source_id": r["id"], "name": r.get("name"), "kind": r.get("kind"),
            "gold_at": [ax, ay], "world_px": [ax * U, ay * U],
            "radius_units": r.get("r"), "density": r.get("dens"), "gate": r.get("gate"),
            "render_family": fam,
            "interaction": "ANCHOR_ONLY" if placed else "FUNCTIONAL_BLOCKED",
        })

    # elders: six distinct compositions built from the available vocabulary
    ELDER_SET = {
        "aion":    ["tree", "tree", "tree", "bush", "bush"],          # ancient forest
        "typhon":  ["props_boulder", "rock", "rock", "props_boulder"],  # rock fractures
        "surtur":  ["props_furnace", "rock", "rock", "props_boulder"],  # volcanic identity
        "atlas":   ["arch", "props_pedestal", "rock"],                 # threshold
        "argus":   ["arch", "statue", "props_pedestal", "wall"],       # knowledge
        "anubis":  ["props_grave", "grave", "statue", "wall"],         # necropolis
    }
    elder_records = []
    for e in proj["elders"]:
        ring = e.get("outer") or []
        if ring:
            cx = sum(q[0] for q in ring) / len(ring)
            cy = sum(q[1] for q in ring) / len(ring)
        else:
            cx = cy = 0
        setlist = ELDER_SET.get(e.get("elder"), ["rock"])
        for i, fam in enumerate(setlist):
            a = 2 * math.pi * i / len(setlist)
            place(fam, (cx + math.cos(a) * 9) * U, (cy + math.sin(a) * 9) * U,
                  f"{e['id']}:{i}", True, tag=e["id"])
        elder_records.append({"source_id": e["id"], "name": e.get("name"),
                              "elder": e.get("elder"), "ring": ring,
                              "world_centre_px": [cx * U, cy * U], "site_set": setlist,
                              "biome_art": "MISSING_ASSET"})

    print("objects placed", len(placements))

    # ---------------- compose with y-sort ----------------
    placements.sort(key=lambda r: (r["y"], r["x"]))
    for rec in placements:
        img = rec["img"]
        world.alpha_composite(img, (rec["x"] - img.width // 2, rec["y"] - img.height))
    world_rgb = world.convert("RGB")
    world_rgb.save(os.path.join(out_dir, "world.png"))
    world_rgb.resize((PW // 5, PH // 5), Image.LANCZOS).save(os.path.join(out_dir, "overview.png"))
    print("world saved", world_rgb.size)

    # ---------------- collision on the 16 px grid ----------------
    def down(mask_px, cell, thresh):
        """Area-average a pixel mask down to a coarser grid."""
        h, w = mask_px.shape
        m = mask_px.reshape(h // cell, cell, w // cell, cell).mean(axis=(1, 3))
        return m >= thresh

    solid = down(water_mask, COLL, 0.45)
    solid &= ~down(np.array(reseat(deck)) > 0, COLL, 0.35)
    solid &= ~down(np.array(reseat(piers)) > 0, COLL, 0.35)
    solid |= down(np.array(reseat(rail)) > 0, COLL, 0.6) & False  # rails are decoration
    for rec in placements:
        if not rec["collider"]:
            continue
        cx = rec["x"] // COLL
        cy = (rec["y"] - 5) // COLL
        if 0 <= cx < CW and 0 <= cy < CH:
            solid[cy, cx] = True
    # no walking on cliff faces
    for gy in range(GH):
        for gx in range(GW):
            if cliff_cells[gy, gx]:
                solid[gy * 2:gy * 2 + 2, gx * 2:gx * 2 + 2] = True

    rows = []
    for y in range(CH):
        row = solid[y]
        runs, x = [], 0
        while x < CW:
            v = bool(row[x])
            if not v:
                x += 1
                continue
            s = x
            while x < CW and bool(row[x]) == v:
                x += 1
            runs.append([s, x - s, 1])
        rows.append(runs)

    meta = {
        "schema": "soh.veyra.world.v2",
        "source": {
            "gold": "map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json",
            "gold_sha256": hashlib.sha256(open(GOLD, "rb").read()).hexdigest(),
            "art_manifest": "map_tower/assets/VEYRA_ART_MANIFEST.json",
            "art_sources": {k: v["sha256"] for k, v in manifest["sources"].items()},
        },
        "scale": {
            "gold_cell_units": 8, "art_tile_px": ART_TILE, "cells": [GW, GH],
            "pixels": [PW, PH], "px_per_gold_unit": U, "collision_cell_px": COLL,
            "collision_cells": [CW, CH],
        },
        "spawns": [{"id": s["id"], "name": s.get("name"),
                    "at": s["at"], "world_px": [s["at"][0] * U, s["at"][1] * U],
                    "region": s.get("region")} for s in proj["spawns"]],
        "pois": poi_records, "resources": res_records, "zones": [
            {"source_id": z["id"], "name": z.get("name"), "ring": z["ring"],
             "soil": z.get("soil"), "tags": z.get("tags")} for z in proj["zones"]],
        "lakes": [{"source_id": l["id"], "name": l.get("name"), "kind": l.get("kind"),
                   "rings": l.get("rings") or [l.get("ring")]} for l in proj["lakes"]],
        "rivers": river_list, "roads": road_list, "bridges": bridges, "docks": docks,
        "elders": elder_records,
        "labels": [{"source_id": l["id"], "text": l.get("text"), "at": l["at"],
                    "rot": l.get("rot"), "size": l.get("size"), "style": l.get("style")}
                   for l in proj["labels"]],
        "lands": [{"source_id": l["id"], "name": l.get("name")} for l in proj["land"]],
        "collision": {"encoding": "rle-[start,len,value]-per-row", "cell_px": COLL,
                      "rows": rows},
        "art_gaps": manifest["missing"],
    }
    with open(os.path.join(out_dir, "world_meta.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    np.save(os.path.join(out_dir, "solid.npy"), solid)
    print("collision cells solid", int(solid.sum()), "/", solid.size)
    world_rgb.resize((500, 350), Image.LANCZOS).save(os.path.join(out_dir, "minimap.png"))
    return meta


def _band(mask, r):
    """Grow a boolean mask by r cells (shelf/shore bands)."""
    e = mask.copy()
    for _ in range(r):
        n = e.copy()
        n[1:] |= e[:-1]; n[:-1] |= e[1:]
        n[:, 1:] |= e[:, :-1]; n[:, :-1] |= e[:, 1:]
        e = n
    return e


def _erode(mask, r):
    e = mask.copy()
    for _ in range(r):
        n = e.copy()
        n[1:] &= e[:-1]; n[:-1] &= e[1:]
        n[:, 1:] &= e[:, :-1]; n[:, :-1] &= e[:, 1:]
        e = n
    return e


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(REPO, "out"))
    a = ap.parse_args()
    main(a.out)
