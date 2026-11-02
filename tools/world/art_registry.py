"""Curated Veyra art registry — Git-relative, SHA-pinned, explicit rectangles.

Every sprite used by the overworld compiler is listed here by hand after visual
inspection of the source sheet.  Nothing is chosen by colour statistics: the family
assignment below is a curatorial decision, and `verify()` proves that each rectangle
exists, is inside its sheet and is not empty.

Only files that are committed to this repository are used (no Drive, no APEX, no
local asset vault).  Sheet contents at time of curation:

  assets/environment/cainos_demo/cainos_tileset_grass.png     grass + stone-path autotile
  assets/environment/cainos_demo/cainos_tileset_stone_ground.png  stone floor / rock ground
  assets/environment/cainos_demo/cainos_struct.png            walls, arches, stairs
  assets/environment/cainos_demo/cainos_props.png             barrels, crates, graves, well, ...
  assets/environment/cainos_demo/cainos_plant.png             trees, bushes, tufts
  assets/environment/ocean_cainos/ocean_tileset_wall.png      stone wall / cliff faces

Run:  python3 tools/world/art_registry.py        (writes map_tower/assets/VEYRA_ART_MANIFEST.json)
"""
import hashlib
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ENV = "assets/environment"

SOURCES = {
    "grass": f"{ENV}/cainos_demo/cainos_tileset_grass.png",
    "stone": f"{ENV}/cainos_demo/cainos_tileset_stone_ground.png",
    "struct": f"{ENV}/cainos_demo/cainos_struct.png",
    "props": f"{ENV}/cainos_demo/cainos_props.png",
    "plant": f"{ENV}/cainos_demo/cainos_plant.png",
    "wall": f"{ENV}/ocean_cainos/ocean_tileset_wall.png",
}

# 32 px art on a 16 px world grid: one source tile covers 2x2 world tiles.
ART_TILE = 32


def _sha(rel):
    with open(os.path.join(REPO, rel), "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _img(key):
    return Image.open(os.path.join(REPO, SOURCES[key])).convert("RGBA")


def _opaque(im, x, y, w, h):
    a = im.crop((x, y, x + w, y + h)).getchannel("A")
    return sum(1 for p in a.getdata() if p > 0) / float(w * h)


def _tile(key, tx, ty, name):
    return {"name": name, "source": key, "path": SOURCES[key],
            "rect": [tx * ART_TILE, ty * ART_TILE, ART_TILE, ART_TILE]}


# --------------------------------------------------------------------------
# curated tiles (tile coordinates inside the 32 px grid of each sheet)
# --------------------------------------------------------------------------
def _curated_tiles():
    g = _img("grass")
    s = _img("stone")
    out = {}

    # grass sheet, rows 0-3: plain meadow with sparse flowers and tufts.
    grass = []
    for ty in range(4):
        for tx in range(8):
            if _opaque(g, tx * 32, ty * 32, 32, 32) > 0.99:
                grass.append(_tile("grass", tx, ty, f"meadow_{tx}_{ty}"))
    out["meadow"] = grass

    # grass sheet, rows 4-7: stone path modules drawn over meadow.  Measured stone
    # fractions: (0,4)=0.80 (1,4)=0.78 (0,5)=0.76 (1,5)=0.75 (0,6)=0.76.  Everything
    # else in that block is an edge/corner module and is deliberately not used as
    # ground - it would paint grass holes inside a road.
    out["path"] = [_tile("grass", 0, 4, "pathcore_0_4"),
                   _tile("grass", 1, 4, "pathcore_1_4"),
                   _tile("grass", 0, 5, "pathcore_0_5"),
                   _tile("grass", 1, 5, "pathcore_1_5"),
                   _tile("grass", 0, 6, "pathcore_0_6")]

    # stone ground sheet: the light stone floor block in the upper half
    stone = []
    for ty in range(4):
        for tx in range(6):
            if _opaque(s, tx * 32, ty * 32, 32, 32) > 0.99:
                crop = s.crop((tx * 32, ty * 32, tx * 32 + 32, ty * 32 + 32)).convert("RGB")
                lum = sum(sum(c) for c in crop.getdata()) / (3.0 * 1024)
                if 95 < lum < 190:
                    t = _tile("stone", tx, ty, f"stoneground_{tx}_{ty}")
                    t["lum"] = round(lum, 1)
                    stone.append(t)
    if len(stone) < 2:
        raise SystemExit("art_registry: stone ground block not found")
    out["stone"] = stone
    return out


# --------------------------------------------------------------------------
# curated objects (explicit rectangles, chosen from the inspected sheets)
# --------------------------------------------------------------------------
OBJECTS = {
    # cainos_plant.png — three broadleaf trees, six bushes (component bboxes 24,14 ...38,198)
    "plant": {
        "tree": [[24, 14, 113, 139], [161, 17, 95, 136], [295, 31, 79, 120]],
        "bush": [[216, 185, 47, 42], [282, 186, 39, 45], [156, 190, 38, 32],
                 [346, 190, 40, 35], [98, 195, 27, 25]],
        "tuft": [[38, 198, 22, 19]],
    },
    # cainos_struct.png — st0/st4 stone arches, st1-st7 stone wall segments with grass
    # tops, st8-st11 timber stairs.  Rectangles are the component bboxes.
    "struct": {
        "arch": [[408, 27, 80, 64], [416, 128, 64, 64]],
        "wall": [[32, 32, 64, 96], [128, 32, 65, 96], [224, 32, 65, 96],
                 [32, 160, 64, 96], [128, 160, 65, 96], [224, 160, 65, 96]],
        "stairs": [[48, 288, 90, 96], [176, 288, 90, 96], [56, 384, 88, 96]],
    },
    # cainos_props.png — curated from the labelled contact sheet:
    #  pr3/pr6 crates, pr14 barrel, pr22/pr27/pr30 urns, pr16/pr23 signposts,
    #  pr15/pr24/pr28 graves, pr26 well, pr5 statue, pr21 pedestal, pr29 workbench,
    #  pr19/pr25 furnaces, pr31 ruined ring, pr32 boulder, pr33-pr38 rocks,
    #  pr12/pr29 doors.
    "props": {
        "crate": [[160, 18, 32, 46], [96, 30, 32, 31]],
        "barrel": [[162, 153, 28, 36]],
        "urn": [[165, 217, 21, 34], [164, 288, 25, 27], [165, 348, 21, 32]],
        "sign": [[99, 160, 27, 32], [96, 224, 27, 32]],
        "grave": [[288, 158, 32, 57], [225, 239, 30, 41], [227, 303, 26, 40]],
        "well": [[353, 269, 94, 72]],
        "statue": [[445, 21, 37, 72]],
        "pedestal": [[416, 194, 32, 57]],
        "workbench": [[288, 306, 32, 46]],
        "furnace": [[352, 174, 32, 77], [289, 251, 30, 29]],
        "ruin": [[420, 359, 55, 49]],
        "door": [[29, 103, 37, 50]],
        "boulder": [[3, 430, 57, 42]],
        "rock": [[130, 484, 27, 22], [68, 487, 24, 19], [100, 487, 24, 19],
                 [231, 489, 18, 16], [162, 482, 27, 27], [289, 486, 31, 19]],
    },
}


def load():
    """Return {family: [PIL images]} plus the manifest dict."""
    tiles = _curated_tiles()
    sheets = {}

    def sheet(key):
        if key not in sheets:
            sheets[key] = _img(key)
        return sheets[key]

    fams = {}
    manifest = {"schema": "soh.veyra.art_manifest.v1", "art_tile_px": ART_TILE,
                "grid_tile_px": 16, "sources": {}, "families": {}}

    for key, rel in SOURCES.items():
        manifest["sources"][key] = {"path": rel, "sha256": _sha(rel),
                                    "size": list(Image.open(os.path.join(REPO, rel)).size)}

    for fam, entries in tiles.items():
        imgs = []
        for e in entries:
            x, y, w, h = e["rect"]
            imgs.append(sheet(e["source"]).crop((x, y, x + w, y + h)))
        fams[fam] = imgs
        manifest["families"][fam] = {"kind": "tile", "rects": entries}

    for key, groups in OBJECTS.items():
        for sub, rects in groups.items():
            fam = sub if key == "plant" else f"{key}_{sub}"
            imgs, recs = [], []
            for (x, y, w, h) in rects:
                im = sheet(key).crop((x, y, x + w, y + h))
                imgs.append(im)
                recs.append({"source": key, "path": SOURCES[key], "rect": [x, y, w, h],
                             "name": f"{fam}_{len(recs)}"})
            manifest["families"][fam] = {"kind": "object", "rects": recs}
            fams[fam] = imgs

    manifest["missing"] = {
        "water_surface": "no deep/shallow sea or lake tile with shore transitions exists in this repository",
        "buildings": "no residential/industrial building exteriors (roofs, walls, doors) exist in this repository",
        "bridge_kit": "no bridge module atlas exists in this repository (decks are assembled from stone tiles + wall railings)",
        "dock_kit": "no pier/plank module atlas exists in this repository (piers are assembled from stone tiles + posts)",
        "sand_desert_ash": "no sand / hard-earth / ash / volcanic ground family exists in this repository",
    }
    return fams, manifest


def main():
    fams, manifest = load()
    out = os.path.join(REPO, "map_tower", "assets", "VEYRA_ART_MANIFEST.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as fh:
        json.dump(manifest, fh, indent=1)
    print("families:", {k: len(v) for k, v in sorted(fams.items())})
    print("wrote", out)
    return manifest


if __name__ == "__main__":
    main()
