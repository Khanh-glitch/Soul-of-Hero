"""GOLD → world coverage audit + build gates.  Writes machine-checkable evidence.

  python3 tools/world/audit.py            # audit + gate A
  python3 tools/world/audit.py --gates    # + determinism (two clean builds, different PYTHONHASHSEED)

Outputs
  docs/map_tower/GOLD_TO_WORLD_OBJECT_AUDIT.json
  docs/map_tower/BUILD_GATES.json
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
GOLD = os.path.join(REPO, "map_tower", "veyra_gold", "VEYRA_GOLD_MAP.sohmap.json")
META = os.path.join(REPO, "out", "world_meta.json")
OUT_DIR = os.path.join(REPO, "docs", "map_tower")

GOLD_SHA = "88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256"
REQUIRED = {"land": 8, "lakes": 5, "rivers": 17, "roads": 92, "bridges": 12,
            "docks": 27, "pois": 81, "zones": 23, "resources": 280, "spawns": 4,
            "elders": 6, "labels": 24}


def sha_file(p):
    with open(p, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def audit():
    gold = json.load(open(GOLD))
    proj = gold["project"]
    meta = json.load(open(META))
    U = meta["scale"]["px_per_gold_unit"]
    rows = []

    def add(source_type, sid, coords, world, render, nav, anchor, status, validation, devs=None):
        rows.append({
            "source_id": sid, "source_type": source_type,
            "gold_coordinates": coords, "world_coordinates": world,
            "render_asset_ids": render, "collision_or_navigation_id": nav,
            "interaction_anchor": anchor, "implementation_status": status,
            "validation_result": validation, "deviations": devs or [],
            "evidence_paths": ["out/world.png", "out/world_meta.json"],
        })

    # landmasses / lakes / rivers / roads
    for l in proj["land"]:
        add("landmass", l["id"], {"rings": len(l["rings"])},
            {"rings_px": [len(r) for r in l["rings"]]}, ["terrain:meadow", "terrain:stone"],
            "land_mask", None, "GEOMETRY_ONLY",
            "polygon filled into land mask at 4 px/unit")
    for lk in proj["lakes"]:
        add("lake", lk["id"], {"rings": len(lk.get("rings") or [1])}, {"mask": "water"},
            ["water:placeholder"], "water_mask", None, "GEOMETRY_ONLY",
            "lake polygon filled; surface art is a reported gap")
    for r in meta["rivers"]:
        add("river", r["id"], {"points": len(r["points"]), "width_units": r["width"]},
            {"half_width_units": r["half_width_units"], "raster": "4 px/unit"},
            ["water:placeholder"], "water_mask", None, "GEOMETRY_ONLY",
            f"authored width preserved ({r['half_width_units']}u half-width, no minimum brush)",
            ["surface art missing (no water tile in repository)"])
    for rd in meta["roads"]:
        status = "FUNCTIONAL_BLOCKED" if rd.get("mode") == "water" else "GEOMETRY_ONLY"
        add("road", rd["id"], {"points": len(rd["points"]), "kind": rd.get("kind")},
            {"half_width_units": rd.get("half_width_units")}, ["road:stone-texture"],
            "road_mask", None, status,
            "land roads stroked at class width; ferry routes are maritime paths and are not"
            " walkable" if status == "FUNCTIONAL_BLOCKED" else "stroked at class width")

    # bridges — real geometry, deck collision
    for b in meta["bridges"]:
        add("bridge", b["source_id"], {"at": b["gold_at"], "load": b["load"],
                                       "bearing_rad": b["bearing_rad"]},
            {"deck_px": b["deck"], "span_units": b["span_units"]},
            ["deck:stone-texture", "rail:stone-texture"], "deck_mask(walkable)",
            {"landing_px": b["world_px"]}, "GEOMETRY_ONLY",
            f"span {b['span_units']}u measured by ray-marching both banks; deck walkable",
            ["deck width derived from load class (GOLD stores no width)",
             "no bridge module art in repository — deck is masked stone texture"])

    # docks — piers + anchors, boat logic blocked
    for d in meta["docks"]:
        add("dock", d["source_id"], {"at": d["land_anchor_px"]},
            {"land_anchor_px": d["land_anchor_px"], "water_anchor_px": d["water_anchor_px"],
             "length_units": d["length_units"]}, ["pier:stone-texture"], "pier_mask(walkable)",
            {"board": d["water_anchor_px"]}, "FUNCTIONAL_BLOCKED",
            "pier built into navigable water with land and water anchors",
            ["boat movement/logistics not implemented", "no pier module art in repository"])

    # POIs
    for p in meta["pois"]:
        status = "VISUAL_ONLY" if p["building_art"] == "MISSING_ASSET" else "GEOMETRY_ONLY"
        add("poi", p["source_id"], {"at": p["gold_at"], "arche": p["arche"]},
            {"world_px": p["world_px"]}, [f"props:{f}" for f in p["site_set"]],
            "site_props(foot colliders)" if status == "VISUAL_ONLY" else "site_props",
            {"centre_px": p["world_px"]}, status,
            f"archetype composition {p['arche']} from curated prop vocabulary",
            ["no building exterior art exists in this repository; site is a prop composition"
             ] if status == "VISUAL_ONLY" else [])

    for r in meta["resources"]:
        add("resource", r["source_id"], {"kind": r["kind"], "at": r["gold_at"]},
            {"world_px": r["world_px"], "radius_units": r["radius_units"]},
            [f"props:{r['render_family']}"] if r["render_family"] else [],
            "anchor_only", {"at_px": r["world_px"]},
            "GEOMETRY_ONLY" if r["render_family"] else "FUNCTIONAL_BLOCKED",
            "source marker placed" if r["render_family"] else
            "no marker family for this kind (fish / fresh water)")

    for e in meta["elders"]:
        add("elder", e["source_id"], {"elder": e["elder"]},
            {"world_centre_px": e["world_centre_px"]}, [f"props:{f}" for f in e["site_set"]],
            "site_props", {"centre_px": e["world_centre_px"]}, "VISUAL_ONLY",
            "elder environment composed from the available vocabulary",
            ["elder biome art (ash / dry / canopy families) missing in repository"])

    for s in meta["spawns"]:
        add("spawn", s["id"], {"at": s["at"]}, {"world_px": s["world_px"]},
            ["terrain"], "collision", {"at_px": s["world_px"]}, "GEOMETRY_ONLY",
            "spawn resolved onto walkable collision")

    for z in meta["zones"]:
        add("build_zone", z["source_id"], {"points": len(z["ring"])}, {"ring_units": len(z["ring"])},
            ["terrain"], "n/a", None, "GEOMETRY_ONLY", "zone ring preserved for build-zone logic")

    for lb in meta["labels"]:
        add("label", lb["source_id"], {"at": lb["at"], "text": lb["text"]},
            {"at_px": [lb["at"][0] * U, lb["at"][1] * U]}, ["debug-overlay"], "n/a",
            None, "GEOMETRY_ONLY", "cartographic label preserved in metadata (not baked into art)")

    # ---- assertions ----
    gold_sha = sha_file(GOLD)
    counts = {k: len(proj[k]) for k in REQUIRED}
    problems = []
    if gold_sha != GOLD_SHA:
        problems.append(f"GOLD sha mismatch: {gold_sha}")
    for k, want in REQUIRED.items():
        if counts[k] != want:
            problems.append(f"{k}: {counts[k]} != {want}")
    ids = [r["source_id"] for r in rows]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        problems.append(f"duplicate ids: {dupes[:5]}")
    expected_ids = set()
    for k in ("land", "lakes", "rivers", "roads", "bridges", "docks", "pois", "zones",
              "resources", "spawns", "elders", "labels"):
        expected_ids |= {o["id"] for o in proj[k]}
    missing = sorted(expected_ids - set(ids))
    extra = sorted(set(ids) - expected_ids)
    if missing:
        problems.append(f"missing from audit: {missing[:5]}")
    if extra:
        problems.append(f"unknown ids in audit: {extra[:5]}")

    by_status = {}
    for r in rows:
        by_status[r["implementation_status"]] = by_status.get(r["implementation_status"], 0) + 1

    out = {
        "schema": "soh.veyra.gold_to_world_audit.v1",
        "gold_path": "map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json",
        "gold_sha256": gold_sha,
        "gold_sha_expected": GOLD_SHA,
        "world_meta": "out/world_meta.json",
        "scale": json.load(open(META))["scale"],
        "class_counts": counts,
        "object_count": len(rows),
        "status_histogram": by_status,
        "assertions": {"problems": problems, "passed": not problems,
                       "duplicates": dupes, "missing": missing, "unknown": extra},
        "objects": rows,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "GOLD_TO_WORLD_OBJECT_AUDIT.json"), "w") as fh:
        json.dump(out, fh, indent=1)
    print("audit objects:", len(rows), "status:", by_status)
    print("assertions passed:", not problems, problems[:3])
    return out


def determinism():
    """Two clean builds in separate processes with different PYTHONHASHSEED."""
    results = []
    for seed in ("1", "987654"):
        env = dict(os.environ, PYTHONHASHSEED=seed)
        subprocess.run([sys.executable, os.path.join(HERE, "veyra_compile.py"),
                        "--out", f"/tmp/veyra_build_{seed}"], check=True, env=env,
                       stdout=subprocess.DEVNULL)
        digests = {}
        for name in ("world.png", "world_meta.json", "solid.npy"):
            digests[name] = sha_file(os.path.join(f"/tmp/veyra_build_{seed}", name))
        results.append({"seed": seed, "digests": digests})
    same = results[0]["digests"] == results[1]["digests"]
    return {"identical": same, "builds": results}


def gates(with_determinism=False):
    out = {"schema": "soh.veyra.build_gates.v1", "gate_a_source_fidelity": None,
           "gate_b_determinism": None}
    a = audit()
    out["gate_a_source_fidelity"] = {
        "passed": a["assertions"]["passed"],
        "problems": a["assertions"]["problems"],
        "class_counts": a["class_counts"],
    }
    if with_determinism:
        b = determinism()
        out["gate_b_determinism"] = {"passed": b["identical"], **b}
    with open(os.path.join(OUT_DIR, "BUILD_GATES.json"), "w") as fh:
        json.dump(out, fh, indent=1)
    print(json.dumps({k: v.get("passed") for k, v in out.items() if isinstance(v, dict)}))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gates", action="store_true")
    args = ap.parse_args()
    if args.gates:
        gates(True)
    else:
        audit()
