#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VEYRA GOLD canon -> SOH world data converter.

Source of truth (creator-approved, paper-only design):
  data/survival/veyra_gold_map.source.json
  (VEYRA_GOLD_MAP.sohmap.json, branch map/veyra-gold-asset-canon-20261102)

Conversion contract enforced (REAL_MAP_CONVERSION_CONTRACT):
  land[8], terrain(250x175 cell=8), lakes[5], rivers[17], roads[92],
  bridges[12], docks[27], pois[81], zones[23], resources[280], spawns[4],
  elders[6], labels[24]

Outputs (every original GOLD ID preserved; geography never reinterpreted):
  data/content/levels/veyra_gold/veyra_gold_world.json   engine-agnostic data
  game/levels/veyra_gold_world.tscn                        Godot 4.7 preview scene
"""

import base64
import json
import math
import os
import sys
import uuid

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_PATH = os.path.join(REPO_ROOT, "data", "survival", "veyra_gold_map.source.json")
WORLD_JSON_PATH = os.path.join(REPO_ROOT, "data", "content", "levels", "veyra_gold",
                               "veyra_gold_world.json")
TSCN_PATH = os.path.join(REPO_ROOT, "game", "levels", "veyra_gold_world.tscn")

# Contract counts from REAL_MAP_CONVERSION_CONTRACT.md
CONTRACT_COUNTS = {
    "land": 8, "lakes": 5, "rivers": 17, "roads": 92, "bridges": 12,
    "docks": 27, "pois": 81, "zones": 23, "resources": 280, "spawns": 4,
    "elders": 6, "labels": 24,
}
# ID prefix per class (observed in canon: ld_veyra, lk_tarn, rv_grey_up, ...)
ID_PREFIX = {
    "land": "ld_", "lakes": "lk_", "rivers": "rv_", "roads": "rd_",
    "bridges": "br_", "docks": "dk_", "pois": "po_", "zones": "bz_",
    "resources": "rs_", "spawns": "sp_", "elders": "el_", "labels": "lb_",
}

WORLD_W, WORLD_H = 2000, 1400
TERRAIN_GW, TERRAIN_GH, TERRAIN_CELL = 250, 175, 8
TERRAIN_CELLS = TERRAIN_GW * TERRAIN_GH  # 43750

VALIDATIONS = []  # list of (check, ok, detail)


def check(name, ok, detail=""):
    VALIDATIONS.append((name, bool(ok), detail))
    status = "OK" if ok else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))


def fail(msg):
    raise SystemExit(f"CONVERSION FAILED: {msg}")


def uid() -> str:
    return "uid://" + uuid.uuid4().hex


def clamp_coord(value, axis):
    return 0.0 <= float(value) <= (WORLD_W if axis == "x" else WORLD_H)


def validate_coords(obj, kind):
    """Every point/ring/at coordinate must lie inside the 2000x1400 world."""
    pts = []
    if "ring" in obj:
        pts = obj["ring"]
    elif "points" in obj:
        pts = obj["points"]
    elif "at" in obj:
        pts = [obj["at"]]
    elif "outer" in obj:
        pts = obj["outer"]
    bad = []
    for pt in pts:
        if not clamp_coord(pt[0], "x") or not clamp_coord(pt[1], "y"):
            bad.append(pt)
    if bad:
        fail(f"{kind} {obj.get('id')} has coordinates outside the world: {bad[:4]}")


def validate_id_prefix(class_name, obj):
    oid = obj.get("id", "")
    if not oid.startswith(ID_PREFIX[class_name]):
        fail(f"{class_name} id {oid!r} missing prefix {ID_PREFIX[class_name]!r}")


def load_source():
    with open(SOURCE_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    proj = data["project"]
    check("project world 2000x1400",
          proj["world"]["w"] == WORLD_W and proj["world"]["h"] == WORLD_H)
    t = proj["terrain"]
    check("terrain 250x175 cell=8",
          t["gw"] == TERRAIN_GW and t["gh"] == TERRAIN_GH and t["cell"] == TERRAIN_CELL)
    elev = base64.b64decode(t["elev"])
    biome = base64.b64decode(t["biome"])
    check("terrain rasters 43750 cells each",
          len(elev) == TERRAIN_CELLS and len(biome) == TERRAIN_CELLS)
    check("elevation bytes 0..255", min(elev) >= 0 and max(elev) <= 255,
          f"min={min(elev)} max={max(elev)}")
    check("biome bytes 0..11", min(biome) >= 0 and max(biome) <= 11,
          f"min={min(biome)} max={max(biome)}")
    return proj, list(elev), list(biome)


def validate_classes(proj):
    lake_ids = {o["id"] for o in proj["lakes"]}
    river_ids = {r["id"] for r in proj["rivers"]}
    water_refs = lake_ids | river_ids
    for class_name, expected in CONTRACT_COUNTS.items():
        arr = proj[class_name]
        check(f"{class_name} count == {expected}", len(arr) == expected,
              f"actual={len(arr)}")
        seen = set()
        for obj in arr:
            oid = obj.get("id")
            check(f"{class_name} id unique/prefixed: {oid}",
                  oid not in seen and oid.startswith(ID_PREFIX[class_name]))
            seen.add(oid)
            validate_coords(obj, class_name)
    for riv in proj["rivers"]:
        for ref_kind in ("mouth", "source"):
            ref = riv.get(ref_kind, {}).get("ref")
            if ref is None:
                continue  # springs/sea/terminus: canon allows no ref
            check(f"river {riv['id']} {ref_kind} ref -> existing lake/river",
                  ref in lake_ids or ref in water_refs, f"ref={ref}")
    for res in proj["resources"]:
        check(f"resource {res['id']} gate == none (A0/A3: no free loot gates)",
              res.get("gate") == "none", f"gate={res.get('gate')}")
    for br in proj["bridges"]:
        check(f"bridge {br['id']} load in {{cart,foot}}",
              br.get("load") in ("cart", "foot"), f"load={br.get('load')}")
    for dk in proj["docks"]:
        w = dk.get("water")
        check(f"dock {dk['id']} water is sea or a ref to an existing water body",
              w == "sea" or w in water_refs, f"water={w}")


def build_world_json(proj, elev, biome):
    world = {
        "source_map": "VEYRA_GOLD_MAP.sohmap.json",
        "source_branch": "map/veyra-gold-asset-canon-20261102",
        "source_status": "GOLD MAP DESIGN - PAPER ONLY - NOT NATIVE PRODUCTION",
        "project": {
            "name": proj["name"],
            "version": proj.get("v"),
            "world": {"w": WORLD_W, "h": WORLD_H},
            "units": "authoring units = engine pixels at native scale (1:1)",
            "meta": proj.get("meta", {}),
        },
        "terrain": {
            "gw": TERRAIN_GW,
            "gh": TERRAIN_GH,
            "cell": TERRAIN_CELL,
            "seed": proj["terrain"]["seed"],
            "note": "elev/biome are flat row-major arrays over the 250x175 cell grid; "
                    "cell covers 8x8 authoring units; engine world grid = 8 px cells "
                    "(exact match to GOLD; 16 px dungeon TILE_SIZE is dungeon-only)",
            "elev": elev,
            "biome": biome,
        },
    }
    for class_name in CONTRACT_COUNTS:
        world[class_name] = proj[class_name]  # deep-copy-equivalent; original IDs + fields intact
    world["contract"] = {
        "counts_expected": dict(CONTRACT_COUNTS),
        "counts_actual": {k: len(proj[k]) for k in CONTRACT_COUNTS},
        "counts_match": all(len(proj[k]) == v for k, v in CONTRACT_COUNTS.items()),
        "validations": [{"check": n, "ok": ok, "detail": d} for n, ok, d in VALIDATIONS],
        "all_valid": all(ok for _, ok, _ in VALIDATIONS),
    }
    return world


# ---------------------------------------------------------------- Godot tscn

def hex_color(r, g, b, a=1.0):
    return f"Color({r/255:.3f}, {g/255:.3f}, {b/255:.3f}, {a})"


def pf32(values):
    """PackedFloat32Array for Line2D points: flat x,y sequence."""
    return "PackedFloat32Array(" + ", ".join(f"{float(v):.3f}" for v in values) + ")"


def pv2(points):
    """PackedVector2Array for Polygon2D."""
    return "PackedVector2Array(" + ", ".join(f"Vector2({x:.3f}, {y:.3f})" for x, y in points) + ")"


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def arche_color(arche):
    h = sum(ord(c) for c in arche) * 2654435761 % 256
    r = (h * 1103515245 + 12345) % 256
    g = (h * 7 + 31) % 256
    b = (h * 13 + 97) % 256
    return f"Color({r/255:.3f}, {g/255:.3f}, {b/255:.3f}, 0.9)"


def kind_color(kind):
    table = {
        "fish": "Color(0.4, 0.75, 1.0, 0.85)",
        "ore": "Color(0.85, 0.85, 0.9, 0.85)",
        "wood": "Color(0.7, 0.5, 0.25, 0.85)",
        "herb": "Color(0.5, 0.85, 0.45, 0.85)",
        "food": "Color(1.0, 0.6, 0.3, 0.85)",
    }
    return table.get(kind, "Color(0.8, 0.8, 0.8, 0.85)")


def style_color(style):
    table = {"region": "Color(1, 0.85, 0.4, 1)", "poi": "Color(0.9, 0.9, 1, 1)",
             "route": "Color(0.8, 1, 0.8, 1)", "water": "Color(0.7, 0.9, 1, 1)"}
    return table.get(style, "Color(1, 1, 1, 1)")


def build_tscn(proj):
    lines = []
    lines.append(f"[gd_scene format=3 uid=\"{uid()}\"]")
    lines.append("")
    lines.append("[ext_resource type=\"Texture2D\" uid=\"uid://veyragold-terrain-tex\" "
                 "path=\"res://assets/environment/veyra/veyra_terrain_render.png\" id=\"1\"]")
    lines.append("")
    lines.append("[node name=\"VeyraGoldWorld\" type=\"Node2D\"]")
    lines.append("global_position = Vector2(0, 0)")
    lines.append("")
    lines.append("[node name=\"OverviewCamera\" type=\"Camera2D\" parent=\".\"]")
    lines.append("global_position = Vector2(1000, 700)")
    lines.append("zoom = Vector2(0.26, 0.26)")
    lines.append("current = true")
    lines.append("")
    lines.append("[node name=\"Terrain\" type=\"Sprite2D\" parent=\".\"]")
    lines.append("texture = ExtResource(\"1\")")
    lines.append("global_position = Vector2(1000, 700)")
    lines.append("filter = false")  # pixel-art: nearest-neighbor
    lines.append("")

    # Land rings — outlines only (geography preserved, no filled symbols)
    for land in proj["land"]:
        for ring_index, ring in enumerate(land["rings"]):
            closed = ring + [ring[0]]
            flat = [v for pt in closed for v in pt]
            name = land["id"] if len(land["rings"]) == 1 else f"{land['id']}_r{ring_index}"
            lines.append(f"[node name=\"{name}\" type=\"Line2D\" parent=\".\"]")
            lines.append(f"points = {pf32(flat)}")
            lines.append("width = 1.5")
            lines.append("default_color = Color(0.55, 0.5, 0.42, 0.8)")
            lines.append("")

    # Lakes — translucent fill polygon + outline
    for lk in proj["lakes"]:
        lines.append(f"[node name=\"{lk['id']}\" type=\"Polygon2D\" parent=\".\"]")
        lines.append(f"polygon = {pv2(lk['ring'])}")
        lines.append("color = Color(0.25, 0.45, 0.7, 0.35)")
        lines.append("")
        closed = lk["ring"] + [lk["ring"][0]]
        flat = [v for pt in closed for v in pt]
        lines.append(f"[node name=\"{lk['id']}_outline\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append("width = 1.5")
        lines.append("default_color = Color(0.35, 0.6, 0.9, 0.9)")
        lines.append("")

    # Rivers — width-scaled lines; mouth/source kept as GOLD refs (data only)
    for riv in proj["rivers"]:
        flat = [v for pt in riv["points"] for v in pt]
        lines.append(f"[node name=\"{riv['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append(f"width = {float(riv.get('width', 4))}")
        lines.append("default_color = Color(0.3, 0.55, 0.85, 0.85)")
        lines.append("")

    # Roads
    for rd in proj["roads"]:
        flat = [v for pt in rd["points"] for v in pt]
        lines.append(f"[node name=\"{rd['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append("width = 5")
        lines.append("default_color = Color(0.6, 0.52, 0.42, 0.9)")
        lines.append("")

    # Bridges — short rotated span at `at`
    for br in proj["bridges"]:
        x, y = br["at"]
        ang = float(br.get("ang", 0.0))
        length = 48.0 if br.get("load") == "cart" else 30.0
        dx = math.cos(ang) * length / 2
        dy = math.sin(ang) * length / 2
        flat = [x - dx, y - dy, x + dx, y + dy]
        lines.append(f"[node name=\"{br['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append("width = 3")
        lines.append("default_color = Color(0.75, 0.72, 0.68, 0.95)")
        lines.append("")

    # Docks — pier marker at `at`
    for dk in proj["docks"]:
        x, y = dk["at"]
        flat = [x, y - 10, x, y + 10, x - 8, y, x + 8, y]
        lines.append(f"[node name=\"{dk['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append("width = 2")
        lines.append("default_color = Color(0.35, 0.75, 0.85, 0.95)")
        lines.append("")

    # POIs — footprint quad outline + center marker
    for po in proj["pois"]:
        foot = po.get("foot") or []
        if foot:
            closed = foot + [foot[0]]
            flat = [v for pt in closed for v in pt]
            lines.append(f"[node name=\"{po['id']}\" type=\"Line2D\" parent=\".\"]")
            lines.append(f"points = {pf32(flat)}")
            lines.append("width = 1.5")
            lines.append(f"default_color = {arche_color(po.get('arche', '?'))}")
        at = po["at"]
        lines.append(f"[node name=\"{po['id']}_mark\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32([at[0]-3, at[1], at[0]+3, at[1], at[0], at[1]-3, at[0], at[1]+3])}")
        lines.append("width = 2")
        lines.append(f"default_color = {arche_color(po.get('arche', '?'))}")
        lines.append("")

    # Zones — ring outlines
    for zn in proj["zones"]:
        closed = zn["ring"] + [zn["ring"][0]]
        flat = [v for pt in closed for v in pt]
        lines.append(f"[node name=\"{zn['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append("width = 1.5")
        lines.append("default_color = Color(0.4, 0.75, 0.45, 0.8)")
        lines.append("")

    # Resources — radius dots sized by `r`, capped
    for rs in proj["resources"]:
        x, y = rs["at"]
        radius = min(float(rs.get("r", 6)), 14)
        steps = 8
        pts = []
        for i in range(steps):
            a = 2 * math.pi * i / steps
            pts.extend([x + radius * math.cos(a), y + radius * math.sin(a)])
        pts.extend([pts[0], pts[1]])
        lines.append(f"[node name=\"{rs['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(pts)}")
        lines.append("width = 1.5")
        lines.append(f"default_color = {kind_color(rs.get('kind', '?'))}")
        lines.append("")

    # Spawns — cross marker
    for sp in proj["spawns"]:
        x, y = sp["at"]
        lines.append(f"[node name=\"{sp['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32([x-10, y, x+10, y, x, y-10, x, y+10])}")
        lines.append("width = 2")
        lines.append("default_color = Color(0.5, 1, 0.5, 1)")
        lines.append("")

    # Elders — outer ring
    for el in proj["elders"]:
        closed = el["outer"] + [el["outer"][0]]
        flat = [v for pt in closed for v in pt]
        lines.append(f"[node name=\"{el['id']}\" type=\"Line2D\" parent=\".\"]")
        lines.append(f"points = {pf32(flat)}")
        lines.append("width = 2")
        lines.append("default_color = Color(0.85, 0.5, 1, 0.85)")
        lines.append("")

    # Labels — text nodes at `at`
    for lb in proj["labels"]:
        x, y = lb["at"]
        size = float(lb.get("size", 24))
        lines.append(f"[node name=\"{lb['id']}\" type=\"Label2D\" parent=\".\"]")
        lines.append(f"text = \"{esc(lb.get('text', lb.get('name', '')))}\"")
        lines.append(f"global_position = Vector2({x:.2f}, {y:.2f})")
        lines.append(f"scale = Vector2({size/16.0:.3f}, {size/16.0:.3f})")
        lines.append(f"modulate = {style_color(lb.get('style', '?'))}")
        lines.append("")

    lines.append("")
    return "\n".join(lines)


def main():
    proj, elev, biome = load_source()
    validate_classes(proj)

    os.makedirs(os.path.dirname(WORLD_JSON_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(TSCN_PATH), exist_ok=True)

    world = build_world_json(proj, elev, biome)
    with open(WORLD_JSON_PATH, "w", encoding="utf-8") as fh:
        json.dump(world, fh, ensure_ascii=False, indent=1)
    print(f"\nWrote {WORLD_JSON_PATH}")

    tscn = build_tscn(proj)
    with open(TSCN_PATH, "w", encoding="utf-8") as fh:
        fh.write(tscn)
    print(f"Wrote {TSCN_PATH}")

    print("\n=== CONTRACT REPORT ===")
    print(f"counts_match={world['contract']['counts_match']}")
    print(f"all_valid={world['contract']['all_valid']}")
    fails = [c for c, ok, _ in VALIDATIONS if not ok]
    if fails:
        print("FAILED CHECKS:", fails)
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
