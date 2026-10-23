#!/usr/bin/env python3
"""Gate 1: derive a separate experimental Level 3 and visual-art placement pack.

Never edits canonical campaign files. Only the CI runner temporarily installs
the resulting level to the ordinary game path for genuine gameplay rendering.
"""
import argparse
import copy
import hashlib
import json
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "prototypes/gate0/level_data/chapter_1_level_3_a.json"
GATE0 = ROOT / "prototypes/gate0/overlay_level3_archive.json"
OUT = ROOT / "prototypes/gate1/level_data/chapter_1_level_3_trial.json"
ART = ROOT / "prototypes/gate0/art/props.json"
VIS = ROOT / "prototypes/gate1/visual_placement.json"
BASE_SHA = "5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"
EDIT_BOUNDS = (16, 21, 34, 30)

def key(x, y):
    return (int(x), int(y))

def sets(level):
    return [set((int(v["x"]), int(v["y"])) for v in level["layers"][n])
            for n in ("Backdrop", "Geometry")]

def flood(cells, start):
    seen = {start}
    todo = deque([start])
    while todo:
        x, y = todo.popleft()
        for v in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if v in cells and v not in seen:
                seen.add(v)
                todo.append(v)
    return seen

def run():
    if hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError("Candidate A level source has changed")
    base = json.loads(BASE.read_text(encoding="utf-8"))
    level = copy.deepcopy(base)
    layers = level["layers"]
    floor = {key(c["x"], c["y"]): c for c in layers["Backdrop"]}
    geom = {key(c["x"], c["y"]): c for c in layers["Geometry"]}
    floor_ref = copy.deepcopy(floor[(17,21)])
    geom_ref = copy.deepcopy(geom[(16,22)])
    original_floor, original_geom = sets(base)
    original_open = original_floor - original_geom
    original_reach = flood(original_open, (17,13))

    def cell(ref, x, y):
        out = copy.deepcopy(ref)
        out["x"], out["y"] = x, y
        return out
    def carve(x, y):
        floor[(x,y)] = cell(floor_ref, x, y)
        geom.pop((x,y),None)
    def masonry(x, y):
        floor[(x,y)] = cell(floor_ref, x, y)
        geom[(x,y)] = cell(geom_ref, x, y)

    # A real annex cut into a previously empty south chasm: framed recess
    # rather than a flat wall receiving a cabinet it cannot physically support.
    # Open a three-tile threshold from A's existing lower entry gallery.
    for x in range(17,21):
        carve(x,22)
    # Main gallery and the two-tile-wide approach around the western side.
    for y in range(23,30):
        for x in range(17,34):
            carve(x,y)
    # Robust perimeter / retaining masonry, preserving the east crossfire hall.
    for y in range(22,31):
        masonry(16,y)
        masonry(34,y)
    for x in range(16,35):
        masonry(x,30)
    # Backing wall three courses deep behind one 136x64 armarium.
    for y in range(23,26):
        for x in range(22,31):
            masonry(x,y)
    # Legible end-piers to visually and physically frame the recess.
    for y in range(23,26):
        masonry(21,y)
        masonry(31,y)
    # Structural top corners do not close the actual west-access route.
    masonry(22,22)
    masonry(30,22)

    layers["Backdrop"] = [floor[k] for k in sorted(floor, key=lambda v:(v[1],v[0]))]
    layers["Geometry"] = [geom[k] for k in sorted(geom, key=lambda v:(v[1],v[0]))]
    assert level["entities"] == base["entities"], "Any entity alteration is forbidden"
    assert (level["width"],level["height"]) == (116,96)
    for name in ("Backdrop","Geometry","Decor"):
        old = {key(v["x"],v["y"]):v for v in base["layers"][name]}
        new = {key(v["x"],v["y"]):v for v in level["layers"][name]}
        for p in set(old) | set(new):
            if old.get(p) != new.get(p):
                x,y=p
                if not (EDIT_BOUNDS[0]<=x<=EDIT_BOUNDS[2] and EDIT_BOUNDS[1]<=y<=EDIT_BOUNDS[3]):
                    raise ValueError("Unauthorized out-of-region edit at %s/%s" % (name,p))
    new_floor,new_geom=sets(level)
    new_open=new_floor-new_geom
    reach=flood(new_open,(17,13))
    lost=original_reach - reach
    if lost:
        raise ValueError("Existing reachable tiles lost: %r" % sorted(lost)[:20])
    if (27,29) not in reach or (18,22) not in reach:
        raise ValueError("Annex or threshold unreachable")
    for entity in level["entities"]:
        px,py=entity["position"]
        pos=(int(px)//16,int(py)//16)
        if pos in original_reach and pos not in reach:
            raise ValueError("Entity route blocked: "+entity["id"])

    frames=json.loads(ART.read_text(encoding="utf-8"))["frames"]
    overlay=copy.deepcopy(json.loads(GATE0.read_text(encoding="utf-8")))
    for sprite,x,y,width in [
        ("armarium_open",424,448,102),
        ("column",344,448,21),
        ("column",504,448,21)
    ]:
        image=frames[sprite]
        bbox=[x-width/2,y-12,x+width/2,y]
        for cy in range(int(bbox[1])//16,(int(bbox[3])-1)//16+1):
            for cx in range(int(bbox[0])//16,(int(bbox[2])-1)//16+1):
                if (cx,cy) not in new_open:
                    raise ValueError("Furniture collides with masonry: "+sprite+str((cx,cy)))
        overlay["props"].append({
            "id":"gate1_%s_%d" % (sprite,x),
            "sprite":sprite, "x":x, "base_y":y,
            "source":[image[k] for k in ("x","y","w","h")],
            "cells":[int((x-image["w"]/2)//16),int((y-image["h"])//16),
                     int((x+image["w"]/2-1)//16)+1,int((y-1)//16)+1],
            "solid":True,
            "collider":[x,y-6,width,12],
            "intent":"structurally framed manuscript destination" if sprite=="armarium_open" else "full-height sanctuary pier",
            "provenance":{"art":"Candidate B e7cad36 original props atlas frame "+sprite}
        })
    overlay["props"].sort(key=lambda p:(p["base_y"],p["x"]))
    overlay["level_sha256"]=""  # CI controls derived level, never canonical.
    overlay["gate1_source"] = BASE_SHA
    overlay["region"]={"x":16,"y":21,"w":19,"h":10}
    # Construct only a small architecturally meaningful 2D material zone.
    # B floor and wall face assets are drawn in dedicated prototype TileMapLayers,
    # never fed through A's limited 0x72 two-source schema.
    floor_art=[]
    face_art=[]
    for y in range(12,30):
        for x in range(11,34):
            if (x,y) in new_open and (
               (12<=y<=21 and 11<=x<=25) or (22<=y<=29 and 17<=x<=33)):
                if 22<=y<=29 and 17<=x<=33:
                    col = 0 if 20<=x<=29 and y in (27,28,29) else ((x+3*y)%4)
                else:
                    col = (x+2*y)%4
                floor_art.append([x,y,col,0])
            if (x,y) in new_geom and 21<=x<=31 and 22<=y<=25:
                face_art.append([x,y,(x+y)%3,1])
    overlay["material"]={"atlas":"res://prototypes/gate1/art/archive_tiles.png",
                         "floor":floor_art, "wall_face":face_art}
    overlay["lights"]=[{"x":424,"y":413,"energy":0.65,"scale":0.58},
                       {"x":304,"y":310,"energy":0.35,"scale":0.45}]
    level["metadata"]=dict(level.get("metadata",{}))
    level["metadata"]["gate1_trial_from"]=BASE_SHA
    level["metadata"]["gate1_original_entity_count"]=len(base["entities"])
    stats={"newly_reachable":len(reach-original_reach),
           "original_reachable":len(original_reach),"trial_reachable":len(reach),
           "Backdrop":len(layers["Backdrop"]),"Geometry":len(layers["Geometry"]),
           "Decor":len(layers["Decor"]),"entities":len(base["entities"]),
           "props":len(overlay["props"])}
    return level,overlay,stats

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--check",action="store_true")
    args=p.parse_args()
    level,overlay,stats=run()
    items=[(OUT,level),(VIS,overlay)]
    for path,doc in items:
        text=json.dumps(doc,ensure_ascii=False,sort_keys=True,indent=2)+"\n"
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8")!=text:
                raise SystemExit("Non-deterministic/stale file: "+str(path))
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(text,encoding="utf-8")
    print("GATE1 ARCHITECTURE PASSED",json.dumps(stats,sort_keys=True))
if __name__=="__main__":
    main()
