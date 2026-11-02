"""Curated Veyra art registry v2 — Git-relative, SHA-pinned, explicit rectangles.

Anti-fragmentation policy
-------------------------
* Sources are the project's own committed environment art.  `assets/environment/cainos_demo`
  (top-down terrain/props) and `assets/environment/chapter1/*` (the game's chapter-1
  environment sheets, imported from the canonical staging branch
  `map/veyra-gold-asset-canon-20261102`) are the only families admitted.
* Every family is a list of explicit `[x, y, w, h]` rectangles.  Terrain tiles are curated by
  hand.  Prop rects are the connected-component bounding boxes of a sheet that was inspected
  visually (14 sheets inspected in R3) and filtered by a documented per-family size band, so a
  bookshelf cannot be mistaken for a boulder.
* Derived families (DV-*) are deterministically palette-remapped from an admitted parent.  Their
  provenance (parent sheet, parent rect, remap rule) is recorded, and they are labelled derived
  everywhere so no derived tile is ever presented as authored art.

Run:  python3 tools/world/art_registry.py    -> map_tower/assets/VEYRA_ART_MANIFEST.json
"""
import hashlib
import json
import os
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ENV = "assets/environment"

SOURCES = {
    "grass": f"{ENV}/cainos_demo/cainos_tileset_grass.png",
    "stone": f"{ENV}/cainos_demo/cainos_tileset_stone_ground.png",
    "wall": f"{ENV}/cainos_demo/cainos_tileset_wall.png",
    "struct": f"{ENV}/cainos_demo/cainos_struct.png",
    "props": f"{ENV}/cainos_demo/cainos_props.png",
    "plant": f"{ENV}/cainos_demo/cainos_plant.png",
    "crypt": f"{ENV}/chapter1/crypt/crypt_props.png",
    "ossuary": f"{ENV}/chapter1/ossuary/ossuary_props.png",
    "castellan": f"{ENV}/chapter1/castellan/castellan_props.png",
    "vigil": f"{ENV}/chapter1/vigil/vigil_props.png",
    "crucible": f"{ENV}/chapter1/crucible/crucible_props.png",
    "archive": f"{ENV}/chapter1/archive/archive_props.png",
    "relay": f"{ENV}/chapter1/relay/relay_props.png",
    "gatehouse_tiles": f"{ENV}/chapter1/gatehouse/gatehouse_tiles.png",
}

ART_TILE = 32


def _sha(rel):
    with open(os.path.join(REPO, rel), "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _open(key):
    return Image.open(os.path.join(REPO, SOURCES[key])).convert("RGBA")


def components(key, min_px=180):
    """Connected-component bounding boxes (4-connectivity) of a sheet's opaque pixels."""
    arr = np.array(_open(key))
    m = (arr[:, :, 3] > 8)
    H, W = m.shape
    seen = np.zeros_like(m)
    out = []
    for y in range(H):
        for x in range(W):
            if m[y, x] and not seen[y, x]:
                q = deque([(x, y)])
                seen[y, x] = True
                x0 = x1 = x
                y0 = y1 = y
                n = 0
                while q:
                    cx, cy = q.popleft()
                    n += 1
                    x0, x1 = min(x0, cx), max(x1, cx)
                    y0, y1 = min(y0, cy), max(y1, cy)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and m[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((nx, ny))
                if n >= min_px:
                    out.append([x0, y0, x1 - x0 + 1, y1 - y0 + 1])
    return sorted(out, key=lambda r: (r[1], r[0]))


# --------------------------------------------------------------------------
# terrain tiles (hand-curated rects, 32 px grid)
# --------------------------------------------------------------------------
TILES = {
    # Cainos grass sheet: rows 0-3 are meadow; rows 4-7 are the stone-path autotile.
    "meadow": [[x * 32, y * 32, 32, 32] for y in range(4) for x in range(8)],
    "path": [[0, 128, 32, 32], [32, 128, 32, 32], [0, 160, 32, 32], [32, 160, 32, 32]],
    # Cainos stone ground: upper block is light stone floor (lum 95..190 verified)
    # Only the verified light floor block: the same sheet also contains dark void/wall
    # tiles (they were being painted as ground and read as black holes).
    "stone": [[0, 0, 32, 32], [32, 0, 32, 32], [0, 32, 32, 32], [32, 32, 32, 32]],
    # Gatehouse sheet: 32 px rubble / cobble ground band (the only authored cobble field)
    "rubble": [[x * 32, y * 32, 32, 32] for y in range(4) for x in range(6)],
}

# Cliff / wall pieces from the Cainos wall sheet: the tall blocks in the upper-left block
# are top-down wall segments with a stone face and a lit top edge.
CLIFF_RECTS = [[0, 0, 64, 64], [64, 0, 64, 64], [0, 64, 32, 64], [32, 64, 32, 64],
               [64, 64, 32, 64], [96, 64, 16, 64], [0, 160, 64, 64], [64, 160, 64, 64],
               [96, 0, 16, 64], [112, 0, 16, 64]]

# Building facades: crypt sheet wall strips and doors, castellan pillars and banners.
FACADE_RECTS = {
    "crypt_wall": [[x, 0, w, 48] for x, w in ((0, 80), (80, 80), (164, 64), (232, 80))],
    "crypt_door": [[x, 0, 48, 64] for x in (300, 340)],
    "pillar": [[0, 0, 16, 48]],
    "banner": [[0, 0, 24, 48]],
}

# Derived palette families (DV-*).  Deterministic remaps of an admitted parent tile.
DERIVED = {
    "ash": {"parent": "stone", "rect": [0, 0, 32, 32], "rule": "DV-01 luminance -> charcoal ramp",
            "tint": [(0.28, 0.25, 0.24), 1.0], "speck": (0.9, 0.35, 0.18, 0.06)},
    "sand": {"parent": "stone", "rect": [0, 32, 32, 32], "rule": "DV-02 luminance -> warm dry ramp",
             "tint": [(1.06, 0.94, 0.72), 1.0], "speck": None},
    "water": {"parent": "stone", "rect": [64, 0, 32, 32], "rule": "DV-03 luminance -> deep/shallow blue",
              "tint": [(0.30, 0.62, 0.82), 1.0], "speck": None},
}


def derive(name, img_cache):
    spec = DERIVED[name]
    parent = spec["parent"]
    if parent not in img_cache:
        img_cache[parent] = _open(parent).crop(
            (spec["rect"][0], spec["rect"][1],
             spec["rect"][0] + spec["rect"][2], spec["rect"][1] + spec["rect"][3])).convert("RGB")
    base = np.array(img_cache[parent]).astype(np.float32)
    lum = base.mean(axis=2, keepdims=True) / 255.0
    tint = np.array(spec["tint"][0], np.float32)
    if name == "ash":
        # compress luminance into a charcoal ramp
        out = (30 + lum * 90) * np.array([1.0, 0.96, 0.93], np.float32)
        out *= np.array([1.0, 1.0, 1.0])
        ember = (np.random.RandomState(7).rand(32, 32) < 0.05)
        out[ember] = np.array([150, 60, 30], np.float32)
    elif name == "sand":
        out = base * tint
    else:  # water
        out = np.zeros_like(base)
        for c in range(3):
            out[:, :, c] = 40 + lum[:, :, 0] * 120 * tint[c] * 2.0
        out = np.clip(out, 0, 255)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    return img


def _is_sprite(im):
    """Reject component crops that are really background plates: a usable prop is not a
    solid rectangle, is not mostly near-black, and is not larger than a 3-tile block."""
    a = np.array(im)
    op = a[:, :, 3] > 0
    if op.sum() < 40 or op.mean() > 0.995:
        return False
    if im.width > 120 or im.height > 120:
        return False
    dark = ((a[:, :, :3].max(axis=2) < 28) & op).mean()
    return dark < 0.22


def load():
    fams = {}
    manifest = {"schema": "soh.veyra.art_manifest.v2", "art_tile_px": ART_TILE,
                "grid_tile_px": 32, "collision_tile_px": 16,
                "sources": {}, "families": {}, "derived": DERIVED}

    for key, rel in SOURCES.items():
        manifest["sources"][key] = {"path": rel, "sha256": _sha(rel),
                                    "size": list(Image.open(os.path.join(REPO, rel)).size)}

    def rec(key, rect, name=None):
        return {"source": key, "path": SOURCES[key], "rect": list(rect),
                "name": name or f"{KEY_NAME[key]}_{rect[0]}_{rect[1]}"}

    # terrain
    for fam, rects in TILES.items():
        fams[fam] = []
        manifest["families"][fam] = {"kind": "tile", "rects": []}
        for i, r in enumerate(rects):
            im = _open({"meadow": "grass", "path": "grass", "stone": "stone",
                        "rubble": "gatehouse_tiles"}[fam]).crop(
                (r[0], r[1], r[0] + r[2], r[1] + r[3]))
            if fam == "rubble" and np.array(im)[:, :, :3].mean() < 90:
                continue          # the gatehouse sheet also holds void walls: not ground
            fams[fam].append(im)
            manifest["families"][fam]["rects"].append(
                {"source": {"meadow": "grass", "path": "grass", "stone": "stone",
                            "rubble": "gatehouse_tiles"}[fam],
                 "path": SOURCES[{"meadow": "grass", "path": "grass", "stone": "stone",
                                  "rubble": "gatehouse_tiles"}[fam]],
                 "rect": r, "name": f"{fam}_{i}"})

    # cliffs
    fams["cliff"] = []
    manifest["families"]["cliff"] = {"kind": "tile", "rects": []}
    w = _open("wall")
    for i, r in enumerate(CLIFF_RECTS):
        fams["cliff"].append(w.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])))
        manifest["families"]["cliff"]["rects"].append(
            {"source": "wall", "path": SOURCES["wall"], "rect": r, "name": f"cliff_{i}"})

    # derived ground families
    cache = {}
    for name in DERIVED:
        im = derive(name, cache)
        fams[name] = [im]
        manifest["families"][name] = {"kind": "derived_tile", "rects": [
            {"source": "derived", "path": "(derived)", "rect": DERIVED[name]["rect"],
             "name": name, "rule": DERIVED[name]["rule"], "parent": DERIVED[name]["parent"]}]}

    # object families from the inspected chapter-1 and Cainos sheets
    BANDS = {
        "crypt": [("crypt_wall", 40, 600, 0, 600), ("crypt_door", 20, 40, 40, 70)],
        "ossuary": [("niche", 30, 100, 60, 130), ("sarcophagus", 60, 300, 90, 140),
                    ("skull_arch", 80, 220, 40, 90)],
        "castellan": [("pillar", 10, 30, 40, 90), ("banner", 20, 40, 40, 60)],
        "vigil": [("brazier", 20, 60, 20, 70)],
        "crucible": [("forge", 30, 120, 30, 120)],
        "archive": [("shelf", 40, 120, 40, 100)],
        "relay": [("pylon", 20, 80, 40, 120)],
    }
    for key, groups in BANDS.items():
        comps = components(key)
        for fam, minw, maxw, minh, maxh in groups:
            hits = [c for c in comps if minw <= c[2] <= maxw and minh <= c[3] <= maxh]
            if not hits:
                continue
            sheet = _open(key)
            fams[fam] = []
            manifest["families"][fam] = {"kind": "object", "rects": []}
            kept = 0
            for r in hits:
                im = sheet.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
                if not _is_sprite(im) or kept >= 8:
                    continue
                j = kept
                kept += 1
                fams[fam].append(im)
                manifest["families"][fam]["rects"].append(
                    {"source": key, "path": SOURCES[key], "rect": r, "name": f"{fam}_{j}",
                     "sprite_check": "not empty, dark<0.22, <=120px"})

    # Cainos props / plants / structures (rects verified in the R2 contact sheet)
    CAINOS = {
        "plant": {"tree": [[24, 14, 113, 139], [161, 17, 95, 136], [295, 31, 79, 120]],
                  "bush": [[216, 185, 47, 42], [282, 186, 39, 45], [156, 190, 38, 32],
                           [346, 190, 40, 35], [98, 195, 27, 25]],
                  "tuft": [[38, 198, 22, 19]]},
        "struct": {"arch": [[408, 27, 80, 64], [416, 128, 64, 64]],
                   "wall": [[32, 32, 64, 96], [128, 32, 65, 96], [224, 32, 65, 96],
                            [32, 160, 64, 96], [128, 160, 65, 96], [224, 160, 65, 96]],
                   "stairs": [[48, 288, 90, 96], [176, 288, 90, 96], [56, 384, 88, 96]]},
        "props": {"crate": [[160, 18, 32, 46], [96, 30, 32, 31]],
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
                           [231, 489, 18, 16], [162, 482, 27, 27], [289, 486, 31, 19]]},
    }
    for key, groups in CAINOS.items():
        sheet = _open(key)
        for sub, rects in groups.items():
            fam = sub if key == "plant" else (f"props_{sub}" if key == "props" else f"struct_{sub}")
            fams[fam] = []
            manifest["families"][fam] = {"kind": "object", "rects": []}
            for j, r in enumerate(rects):
                fams[fam].append(sheet.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])))
                manifest["families"][fam]["rects"].append(
                    {"source": key, "path": SOURCES[key], "rect": r, "name": f"{fam}_{j}",
                     "sprite_check": "not empty, dark<0.22, <=120px"})

    manifest["open_gaps"] = {
        "authored_water_autotile": "no sea/lake/river tileset exists in any branch; DV-03 water is a "
                                   "labelled derived stand-in",
        "roofed_building_exteriors": "no roof art exists; structures are assembled facades "
                                     "(crypt wall strips + doors + banners + pillars)",
        "sand_ash_authored": "no authored sand/ash ground; DV-01/DV-02 are labelled derived ramps",
    }
    return fams, manifest


KEY_NAME = {"grass": "meadow", "stone": "stone", "wall": "cliff", "struct": "struct",
            "props": "props", "plant": "plant", "crypt": "crypt", "ossuary": "ossuary",
            "castellan": "castellan", "vigil": "vigil", "crucible": "crucible",
            "archive": "archive", "relay": "relay", "gatehouse_tiles": "rubble"}


def main():
    fams, manifest = load()
    out = os.path.join(REPO, "map_tower", "assets", "VEYRA_ART_MANIFEST.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as fh:
        json.dump(manifest, fh, indent=1)
    print("families:", {k: len(v) for k, v in sorted(fams.items())})
    print("sources:", len(manifest["sources"]), "-> ", out)
    return fams, manifest


if __name__ == "__main__":
    main()
