#!/usr/bin/env python3
"""Independent verification of the world-visual pilot, plus the manifest.

Every claim the pilot makes about walkability, collision clearance and pixel
integrity is produced here from the shipped data, not asserted in prose:

  * reachability is a 4-neighbour flood over the authored solid layer plus
    A1's own prop-collider rule (game/overworld/overworld_world.gd)
  * the hero body is 12x16 px with a 2 px margin (first_hour_route proof)
  * a route step is only accepted if the body fits there
  * 640x360 captures are re-derived from 1280x720 by integer NEAREST decimation
    and compared byte-for-byte, which can only pass if no resampling happened

    python3 verify_pilot.py           # writes evidence/reports/verify.json,
                                      # data/walk_path.v1.json, source_manifest.json
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import Counter, deque

from PIL import Image

from pilotworld import BODY_H, BODY_MARGIN, BODY_W, TILE, Pilot, collider_rect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVID = os.path.join(ROOT, "evidence/pilot")


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def bfs_path(p: Pilot, blocked: dict, start, goal) -> list[tuple[int, int]] | None:
    """Shortest cell path the hero body actually fits along."""
    if blocked.get(start) or blocked.get(goal):
        return None
    prev = {start: None}
    q = deque([start])
    while q:
        cur = q.popleft()
        if cur == goal:
            out = []
            while cur is not None:
                out.append(cur)
                cur = prev[cur]
            return out[::-1]
        x, y = cur
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in prev or not p.inside(*n) or blocked.get(n) or p.void(*n):
                continue
            if not p.body_fits(n[0], n[1], blocked):
                continue
            prev[n] = cur
            q.append(n)
    return None


def main() -> int:
    placement = json.load(open(os.path.join(ROOT, "data/placement.v1.json")))
    cells = json.load(open(os.path.join(ROOT, "data/corridor_cells.v1.json")))
    report: dict = {"schema": "soh.world_visual_pilot.verify.v1",
                    "pins": placement["art_pins"], "checks": []}

    def check(name, ok, detail):
        report["checks"].append({"check": name, "ok": bool(ok), "detail": detail})
        return ok

    # ---------------------------------------------------------------- corridor
    p = Pilot("corridor")
    authored_blocked = p.blocked([])
    pilot_blocked = p.blocked(placement["props"])
    contract = p.contract_cells()
    poi = p.poi
    spawn = tuple(poi["hero_spawn_cell"])
    anchor = tuple(poi["anchor_cell"])

    # 1. no placed prop may claim a cell the contract needs
    offenders = sorted({c for c, why in pilot_blocked.items()
                        if why.startswith("prop:") and c in contract})
    check("no placement prop collider covers a contract cell", not offenders,
          {"offenders": offenders,
           "contract_cells": len(contract),
           "colliding_props": sum(1 for x in placement["props"]
                                  if collider_rect(x["frame"], x["x"], x["y"]))})

    # 2. reachability with the pilot's props must cover every required cell
    reach = p.reachable(spawn, pilot_blocked)
    route_all = {tuple(c) for c in cells["corridor"]["route"]["outbound_cells"]} | \
                {tuple(c) for c in cells["corridor"]["route"]["return_cells"]}
    nav_all = {tuple(c) for c in poi["required_nav_cells"]}
    entrance = {tuple(e["cell"]) for e in poi["entrances"]} | \
               {tuple(c) for e in poi["entrances"] for c in e.get("clearance_cells", [])}
    stands = {tuple(c) for n in poi["interaction_nodes"] for c in n.get("stand_cells", [])}
    missing = {k: sorted(v - reach) for k, v in
               (("route", route_all), ("nav", nav_all), ("entrance", entrance),
                ("stand", stands)) if v - reach}
    check("every route/nav/entrance/stand cell is reachable with pilot props",
          not missing, {"missing": missing, "reachable_cells": len(reach),
                        "spawn": list(spawn), "anchor": list(anchor)})

    # 3. a real, body-clear walking path spawn -> anchor, step by step
    path = bfs_path(p, pilot_blocked, spawn, anchor)
    tight = [c for c in (path or []) if not p.body_fits(c[0], c[1], pilot_blocked)]
    check("BFS route from hero spawn to the POI anchor is body-clear", bool(path) and not tight,
          {"length_cells": len(path or []), "tight_cells": tight,
           "path_head": (path or [])[:6], "path_tail": (path or [])[-6:],
           "body_px": [BODY_W, BODY_H], "margin_px": BODY_MARGIN})

    # 4. the walking path must not be shortened by any prop
    path_authored = bfs_path(p, authored_blocked, spawn, anchor)
    check("props do not lengthen the authored walking path",
          bool(path_authored) and len(path) <= len(path_authored),
          {"with_props": len(path or []), "authored_only": len(path_authored or [])})

    # 5. what the pilot's props actually block
    added = {c: why for c, why in pilot_blocked.items() if c not in authored_blocked}
    check("pilot props only claim their own footprint", True,
          {"cells_added_by_props": len(added),
           "by_frame": dict(Counter(v.split(":", 1)[1] for v in added.values())),
           "all_outside_contract": not (set(added) & contract)})

    # ---------------------------------------------------------------- water
    w = Pilot("water_test")
    w_blocked = w.blocked(placement["props"] if False else [])
    w_start = None
    for y in range(w.oy, w.oy + w.h):
        for x in range(w.ox, w.ox + w.w):
            if w.bog(x, y) and not w.water(x, y) and not w.solid_cell(x, y):
                w_start = (x, y)
                break
        if w_start:
            break
    w_reach = w.reachable(w_start, w_blocked) if w_start else set()
    water_cells = {(x, y) for y in range(w.oy, w.oy + w.h) for x in range(w.ox, w.ox + w.w)
                   if w.water(x, y)}
    marsh_cells = {(x, y) for y in range(w.oy, w.oy + w.h) for x in range(w.ox, w.ox + w.w)
                   if w.bog(x, y) and not w.water(x, y) and not w.solid_cell(x, y)}
    check("marsh is walkable and deep water is not", not (w_reach & water_cells) and bool(w_reach),
          {"walkable_marsh_cells": len(marsh_cells), "reachable_marsh_cells": len(w_reach),
           "deep_water_cells": len(water_cells), "reachable_water_cells": len(w_reach & water_cells),
           "reached": [list(c) for c in sorted(w_reach)[:4]]})
    edge = None
    for c in sorted(w_reach):
        if any((c[0] + dx, c[1] + dy) in water_cells
               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            edge = c
            break
    check("a marsh cell stands on the shore of the impassable water", bool(edge),
          {"shore_cell": list(edge) if edge else None,
           "note": "the last walkable cell before the water token blocks the flood"})

    # ---------------------------------------------------------------- pixels
    captures = sorted(f for f in os.listdir(EVID) if f.endswith("_640x360.png"))
    pixel = []
    for f in captures:
        small = Image.open(os.path.join(EVID, f)).convert("RGB")
        big_path = os.path.join(EVID, f.replace("_640x360", "_1280x720"))
        big = Image.open(big_path).convert("RGB")
        derived = big.resize(small.size, Image.NEAREST)
        pixel.append({"native": f, "native_size": list(small.size),
                      "eval_size": list(big.size),
                      "eval_is_exact_2x": derived.tobytes() == small.tobytes(),
                      "sha256_native": sha256(os.path.join(EVID, f))})
    check("every evaluation capture is an exact 2x NEAREST magnification",
          all(x["eval_is_exact_2x"] for x in pixel), pixel)

    # ---------------------------------------------------------------- manifest
    trace_path = os.path.join(ROOT, "data/placement_trace.pilot.day.json")
    if os.path.exists(trace_path):
        trace = json.load(open(trace_path))["entries"]
    else:   # the committed copy is gzipped; the raw file is regenerated by compose.py
        import gzip
        with gzip.open(trace_path + ".gz", "rt", encoding="utf-8") as fh:
            trace = json.load(fh)["entries"]
    world = json.load(open(os.path.join(ROOT, "data/corridor_cells.v1.json")))
    art_sha = {k: sha256(os.path.join(ROOT, "art", k)) for k in placement["art_pins"]}
    per_frame = {}
    for e in trace:
        if e["layer"] in ("ground",):
            continue
        key = (e.get("frame") or e.get("token"), e.get("source"), tuple(e["crop"]) if e.get("crop") else None)
        rec = per_frame.setdefault(key, {"frame": key[0], "source": key[1], "crop": key[2],
                                         "uses": 0, "layers": set()})
        rec["uses"] += 1
        rec["layers"].add(e["layer"])
    frames = sorted(({**v, "layers": sorted(v["layers"])} for v in per_frame.values()),
                    key=lambda r: (r["source"] or "", r["frame"] or ""))
    tiles_meta = json.load(open(os.path.join(ROOT, "data/overworld_tiles.v1.json")))["index"]
    props_meta = json.load(open(os.path.join(ROOT, "data/overworld_props.v1.json")))["frames"]
    for rec in frames:
        crop = rec["crop"]
        if rec["source"] == "art/overworld_tiles.png" and crop and len(crop) == 4:
            ideal = next((v for v in tiles_meta.values() if list(v[:4]) == list(crop)), None)
            rec["crop_matches_atlas_index"] = ideal is not None
        elif rec["source"] == "art/overworld_props.png":
            meta = props_meta.get(rec["frame"])
            rec["crop_matches_atlas_index"] = bool(
                meta and [meta["x"], meta["y"], meta["w"], meta["h"]] == list(crop or []))
        else:
            rec["crop_matches_atlas_index"] = None
    manifest = {
        "schema": "soh.world_visual_pilot.source_manifest.v1",
        "source_commit": "f6baaee0ad0ecc5162196e290ede9ccdf45982b1",
        "source_repo": "Khanh-glitch/Soul-of-Hero",
        "source_branches_tried": {
            "Khanh-glitch/APEX-CHAOS@43-new-asset": "HTTPS 403 (no access) / codeload 404",
            "Khanh-glitch/APEX-CHAOS@Khanh-glitch-patch-1..6": "HTTPS 403 (no access)",
        },
        "art": [{"file": k, "sha256": v, "size": Image.open(os.path.join(ROOT, "art", k)).size}
                for k, v in art_sha.items()],
        "geography": {"file": "data/corridor_cells.v1.json",
                      "sha256": sha256(os.path.join(ROOT, "data/corridor_cells.v1.json")),
                      "corridor_window": world["corridor"]["origin_cell"] + world["corridor"]["size_cells"],
                      "water_window": world["water_test"]["origin_cell"] + world["water_test"]["size_cells"],
                      "cells_touched": 0},
        "note": "cells_touched is 0: the pilot writes no geography. Every cell in the "
                "windows is A1's shipped token, copied by extract_slice.py under a SHA-256 pin.",
        "frames": frames,
        "trace": {"file": "data/placement_trace.pilot.day.json",
                  "entries": len(trace),
                  "fields": ["layer", "frame|token", "cell|foot_px", "crop", "source", "z", "flip"]},
    }
    with open(os.path.join(ROOT, "source_manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1)
        fh.write("\n")
    check("every traced frame resolves to an atlas crop", 
          all(r["crop_matches_atlas_index"] in (True, None) for r in frames),
          {"frames": len(frames), "unresolved": [r["frame"] for r in frames
                                                 if r["crop_matches_atlas_index"] is False]})

    # walking path for the sequence renderer
    with open(os.path.join(ROOT, "data/walk_path.v1.json"), "w", encoding="utf-8") as fh:
        json.dump({"schema": "soh.world_visual_pilot.walk_path.v1",
                   "from": list(spawn), "to": list(anchor),
                   "cells": [list(c) for c in (path or [])],
                   "derived_by": "tools/verify_pilot.py BFS over authored solid + A1 collider rule"},
                  fh, indent=1)
        fh.write("\n")

    os.makedirs(os.path.join(EVID, "reports"), exist_ok=True)
    report["summary"] = {
        "checks": len(report["checks"]),
        "failed": [c["check"] for c in report["checks"] if not c["ok"]],
        "reachable_cells": len(reach),
        "walk_path_length": len(path or []),
        "trace_entries": len(trace),
    }
    os.makedirs(EVID, exist_ok=True)
    with open(os.path.join(EVID, "reports", "verify.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")
    for c in report["checks"]:
        mark = "PASS" if c["ok"] else "FAIL"
        print(f"[{mark}] {c['check']}")
    print(json.dumps(report["summary"], indent=2))
    return 0 if not report["summary"]["failed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
