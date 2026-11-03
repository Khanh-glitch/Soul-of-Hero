#!/usr/bin/env python3
"""
VEYRA GOLD conversion contract tests.

Pure-Python (no Godot, no PIL) so it runs anywhere. Verifies:
  1. Source canon (data/survival/veyra_gold_map.source.json) matches the
     REAL_MAP_CONVERSION_CONTRACT object classes and counts.
  2. Converted world data (data/content/levels/veyra_gold/veyra_gold_world.json)
     preserves every original GOLD ID and field verbatim.
Run:  python3 tools/tests/veyra_gold_contract_test.py
"""

import base64
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = f"{REPO}/data/survival/veyra_gold_map.source.json"
OUT = f"{REPO}/data/content/levels/veyra_gold/veyra_gold_world.json"

CONTRACT = {
    "land": 8, "lakes": 5, "rivers": 17, "roads": 92, "bridges": 12,
    "docks": 27, "pois": 81, "zones": 23, "resources": 280, "spawns": 4,
    "elders": 6, "labels": 24,
}
PREFIX = {
    "land": "ld_", "lakes": "lk_", "rivers": "rv_", "roads": "rd_",
    "bridges": "br_", "docks": "dk_", "pois": "po_", "zones": "bz_",
    "resources": "rs_", "spawns": "sp_", "elders": "el_", "labels": "lb_",
}
WORLD_W, WORLD_H = 2000, 1400
GW, GH, CELL = 250, 175, 8

failures = []
checks = 0


def check(name, ok, detail=""):
    global checks
    checks += 1
    flag = "PASS" if ok else "FAIL"
    print(f"  [{flag}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(name)


def all_points(obj):
    pts = []
    for key in ("ring", "points", "at", "outer"):
        if key in obj:
            v = obj[key]
            if key in ("ring", "points", "outer"):
                pts.extend(v)
            else:
                pts.append(v)
    if "rings" in obj:
        for ring in obj["rings"]:
            pts.extend(ring)
    return pts


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    proj = src["project"]
    out = json.load(open(OUT, encoding="utf-8"))

    print("== Source canon vs conversion contract ==")
    p = proj["world"]
    check("world 2000x1400", p["w"] == WORLD_W and p["h"] == WORLD_H)
    t = proj["terrain"]
    check("terrain gw=250 gh=175 cell=8",
          t["gw"] == GW and t["gh"] == GH and t["cell"] == CELL)
    elev = base64.b64decode(t["elev"])
    biome = base64.b64decode(t["biome"])
    check("terrain rasters 43750 cells", len(elev) == GW * GH == len(biome))
    check("elevation 0..255", min(elev) >= 0 and max(elev) <= 255,
          f"min={min(elev)} max={max(elev)}")
    check("biome 0..11", min(biome) >= 0 and max(biome) <= 11,
          f"min={min(biome)} max={max(biome)}")

    lake_ids = {o["id"] for o in proj["lakes"]}
    river_ids = {r["id"] for r in proj["rivers"]}
    water_refs = lake_ids | river_ids

    for class_name, expected in CONTRACT.items():
        arr = proj[class_name]
        check(f"{class_name} count == {expected}", len(arr) == expected,
              f"actual={len(arr)}")
        seen = set()
        for obj in arr:
            oid = obj.get("id")
            ok = oid not in seen and oid.startswith(PREFIX[class_name])
            check(f"{class_name} id well-formed: {oid}", ok)
            seen.add(oid)
            for pt in all_points(obj):
                ok = 0 <= pt[0] <= WORLD_W and 0 <= pt[1] <= WORLD_H
                check(f"{class_name} {oid} coords in world", ok,
                      f"pt={pt}")
    for riv in proj["rivers"]:
        for ref_kind in ("mouth", "source"):
            ref = riv.get(ref_kind, {}).get("ref")
            if ref is None:
                continue
            check(f"river {riv['id']} {ref_kind} -> known water body",
                  ref in water_refs, f"ref={ref}")
    for res in proj["resources"]:
        check(f"resource {res['id']} gate==none (A0/A3 no free loot)",
              res.get("gate") == "none", f"gate={res.get('gate')}")
    for br in proj["bridges"]:
        check(f"bridge {br['id']} load in {{cart,foot}}",
              br.get("load") in ("cart", "foot"), f"load={br.get('load')}")
    for dk in proj["docks"]:
        w = dk.get("water")
        check(f"dock {dk['id']} water=sea or known ref", w == "sea" or w in water_refs,
              f"water={w}")

    print("\n== Converted data preserves original IDs & fields verbatim ==")
    check("project name preserved", out["project"]["name"] == proj["name"])
    check("world preserved", out["project"]["world"] == proj["world"])
    check("terrain gw/gh/cell/seed preserved",
          {k: out["terrain"][k] for k in ("gw", "gh", "cell", "seed")} ==
          {k: t[k] for k in ("gw", "gh", "cell", "seed")})
    check("terrain elev bytes identical",
          list(out["terrain"]["elev"]) == list(elev))
    check("terrain biome bytes identical",
          list(out["terrain"]["biome"]) == list(biome))

    for class_name in CONTRACT:
        src_arr = proj[class_name]
        out_arr = out[class_name]
        check(f"{class_name} count preserved", len(src_arr) == len(out_arr),
              f"src={len(src_arr)} out={len(out_arr)}")
        # order + id + full field equality
        same = True
        diff = None
        for a, b in zip(src_arr, out_arr):
            if a.get("id") != b.get("id"):
                same = False; diff = f"id {a.get('id')} vs {b.get('id')}"; break
            if a != b:
                same = False
                for k in set(list(a.keys()) + list(b.keys())):
                    if a.get(k) != b.get(k):
                        diff = f"{a.get('id')} field {k}: {a.get(k)!r} vs {b.get(k)!r}"; break
                break
        check(f"{class_name} all objects field-identical to source", same, diff)

    print(f"\n== RESULT: {checks} checks, {len(failures)} failures ==")
    if failures:
        print("FAILURES:", failures)
        sys.exit(1)
    print("ALL CONTRACT TESTS PASSED")


if __name__ == "__main__":
    main()
