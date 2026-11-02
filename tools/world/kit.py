"""Source-backed kit modules extracted from the raw packs committed on
`map/veyra-gold-asset-canon-20261102` (map_tower/assets/raw_packs/*.zip).

Nothing here is hand-drawn: every rect below is a crop of a committed PNG whose zip is
SHA-256 pinned in map_tower/assets/RAW_PACK_INVENTORY.json.  The kit exists so the world
compiler can compose bridges, piers and shorelines out of real sprite geometry instead of
painting stone masks over them.

Module coordinates were found by alpha connected-component analysis of the sheets and then
verified visually (see docs/map_tower/ART_GRAMMAR.md for the contact sheet).
"""
import hashlib
import json
import os
import zipfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(REPO, "map_tower", "assets", "raw_packs")
EXTRACT = os.path.join(REPO, "assets", "environment", "packs")
INVENTORY = os.path.join(REPO, "map_tower", "assets", "RAW_PACK_INVENTORY.json")

PACKS = {
    "bridges": {"zip": "668008-bridges.zip", "pack_id": "668008",
                "sheets": ["PNG_n_Tiled/Bridges.png"]},
    "island": {"zip": "351300-island.zip", "pack_id": "351300",
               "sheets": ["Tileset/Tiled.png"]},
    "fields": {"zip": "665131-fields.zip", "pack_id": "665131",
               "sheets": ["1 Tiles/FieldsTileset.png", "2 Objects/4 Stone/Stone_1.png"]},
    "roads": {"zip": "574220-roads-reference-only.zip", "pack_id": "574220",
              "sheets": []},
}

# --- bridges pack (PNG_n_Tiled/Bridges.png, 656x672) --------------------------------------
# (x, y, w, h) crops verified against the alpha-component table in ART_GRAMMAR.md
BRIDGE_MODULES = {
    # stone span with tiled deck, stone curb and corner posts, east-west
    "stone": {"rect": (498, 192, 139, 47), "cap": 15, "kind": "cart"},
    # heavier arched stone viaduct (two arches) for the widest river crossings
    "arch": {"rect": (498, 0, 139, 77), "cap": 15, "kind": "cart"},
    # log-deck bridge, low railing
    "wood": {"rect": (292, 356, 103, 36), "cap": 12, "kind": "foot"},
    # rope footbridge with hanging planks
    "rope": {"rect": (277, 81, 119, 33), "cap": 16, "kind": "foot"},
}
# north-south spans (drawn as-is, no rotation) and plank walkways for piers
VERT_MODULES = {
    "stone_v": (13, 326, 38, 133),
    "plank": (231, 504, 17, 104),
    "plank_wide": (441, 496, 30, 112),
}

# --- island pack (Tileset/Tiled.png) : 32x16 shore/beach strips ---------------------------
# the sheet stacks 32-wide, 16-tall strips with 16 px transparent separators
SHORE_MODULES = {
    "n_crest": (272, 16, 32, 16),    # water at the top edge, wave crest, sand below
    "n_soft": (272, 48, 32, 16),     # calm water line, sand below
    "n_dune": (272, 80, 32, 16),     # thin water line, dune sand
    "w_crest": (272, 112, 32, 16),   # water at the left edge
    "w_soft": (272, 144, 32, 16),
    "w_dune": (272, 176, 32, 16),
}
SAND_RECT = (288, 54, 24, 10)        # bone-dry sand band from the same strip


def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_extracted(force=False):
    """Extract the committed raw packs next to the art library and write the inventory."""
    os.makedirs(EXTRACT, exist_ok=True)
    inv = {"schema": "soh.veyra.raw_pack_inventory.v1",
           "source": "map/veyra-gold-asset-canon-20261102:map_tower/assets/raw_packs",
           "packs": {}, "modules": {}}
    for name, spec in PACKS.items():
        zpath = os.path.join(RAW, spec["zip"])
        if not os.path.exists(zpath):
            inv["packs"][name] = {"zip": spec["zip"], "missing": True}
            continue
        inv["packs"][name] = {"zip": spec["zip"], "pack_id": spec["pack_id"],
                              "sha256": _sha(zpath),
                              "bytes": os.path.getsize(zpath),
                              "files": {}, "sheets": {}}
        with zipfile.ZipFile(zpath) as zf:
            names = [n for n in zf.namelist()
                     if n.lower().endswith(".png") and "__macosx" not in n.lower()]
            for n in names:
                dest = os.path.join(EXTRACT, spec["zip"][:-4], n)
                if force or not os.path.exists(dest):
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with zf.open(n) as src, open(dest, "wb") as dst:
                        dst.write(src.read())
                if n in spec["sheets"]:
                    inv["packs"][name]["sheets"][n] = {
                        "path": os.path.relpath(dest, REPO),
                        "sha256": _sha(dest),
                        "size": list(Image.open(dest).size)}
            inv["packs"][name]["files"] = {n: _sha(os.path.join(EXTRACT, spec["zip"][:-4], n))
                                           for n in names}
    inv["modules"]["bridges"] = {k: {"rect": list(v["rect"]), "cap": v["cap"], "kind": v["kind"]}
                                for k, v in BRIDGE_MODULES.items()}
    inv["modules"]["bridges_vertical"] = {k: list(v) for k, v in VERT_MODULES.items()}
    inv["modules"]["shore"] = {k: list(v) for k, v in SHORE_MODULES.items()}
    inv["modules"]["sand"] = list(SAND_RECT)
    with open(INVENTORY, "w") as fh:
        json.dump(inv, fh, indent=1)
    return inv


class Kit:
    def __init__(self):
        self.bridge_sheet = Image.open(os.path.join(
            EXTRACT, "668008-bridges", "PNG_n_Tiled", "Bridges.png")).convert("RGBA")
        self.island_sheet = Image.open(os.path.join(
            EXTRACT, "351300-island", "Tileset", "Tiled.png")).convert("RGBA")
        self.cache = {}

    # ---------------- bridges ----------------
    def bridge_strip(self, kind, length_px, width_px):
        """Horizontal bridge of the requested length/width composed from a real module:
        left cap + tiled middle + right cap.  Length is honoured by tiling the middle so the
        deck never stretches; width is a nearest-neighbour resize of the whole strip."""
        key = (kind, int(length_px), int(width_px))
        if key in self.cache:
            return self.cache[key]
        spec = BRIDGE_MODULES[kind]
        x, y, w, h = spec["rect"]
        cap = min(spec["cap"], w // 3)
        mod = self.bridge_sheet.crop((x, y, x + w, y + h))
        left = mod.crop((0, 0, cap, h))
        mid = mod.crop((cap, 0, w - cap, h))
        right = mod.crop((w - cap, 0, w, h))
        target = max(cap * 2 + 4, int(length_px))
        out = Image.new("RGBA", (target, h), (0, 0, 0, 0))
        out.alpha_composite(left, (0, 0))
        inner_w = target - cap * 2
        done = 0
        while done < inner_w:
            piece = mid.crop((0, 0, min(mid.width, inner_w - done), h))
            out.alpha_composite(piece, (cap + done, 0))
            done += piece.width
        out.alpha_composite(right, (target - cap, 0))
        if abs(h - int(width_px)) > 1:
            out = out.resize((target, max(6, int(width_px))), Image.NEAREST)
        self.cache[key] = out
        return out

    def bridge_vertical(self, kind, length_px, width_px):
        x, y, w, h = VERT_MODULES[kind]
        mod = self.bridge_sheet.crop((x, y, x + w, y + h))
        out = mod.rotate(-90, expand=True, resample=Image.NEAREST)  # becomes horizontal
        return out.resize((int(length_px), max(6, int(width_px))), Image.NEAREST)

    # ---------------- piers ----------------
    def pier_strip(self, length_px, width_px):
        x, y, w, h = VERT_MODULES["plank_wide"]
        mod = self.bridge_sheet.crop((x, y, x + w, y + h))
        top = mod.crop((0, 0, w, 10))           # end post
        mid = mod.crop((0, 10, w, h - 10))
        bot = mod.crop((0, h - 10, w, h))
        target = max(18, int(length_px))
        out = Image.new("RGBA", (w, target), (0, 0, 0, 0))
        out.alpha_composite(top, (0, 0))
        done = 0
        inner = target - 20
        while done < inner:
            piece = mid.crop((0, 0, w, min(mid.height, inner - done)))
            out.alpha_composite(piece, (0, 10 + done))
            done += piece.height
        out.alpha_composite(bot, (0, target - 10))
        out = out.rotate(-90, expand=True)
        return out.resize((target, max(6, int(width_px))), Image.NEAREST)

    # ---------------- shore / sand ----------------
    def shore(self, direction, variant=0):
        """32x16 real beach band, rotated so the water edge faces `direction`
        (n = water to the north)."""
        names = {("n", 0): "n_crest", ("n", 1): "n_soft", ("n", 2): "n_dune",
                 ("w", 0): "w_crest", ("w", 1): "w_soft", ("w", 2): "w_dune"}
        base_dir, rot = "n", {"n": 0, "w": 90, "s": 180, "e": 270}
        key = (base_dir, variant % 3)
        name = names.get(key, "n_soft")
        x, y, w, h = SHORE_MODULES[name]
        tile = self.island_sheet.crop((x, y, x + w, y + h))
        return tile.rotate(rot[direction], expand=True)

    def sand(self, variant=0):
        x, y, w, h = SAND_RECT
        return self.island_sheet.crop((x, y, x + w, y + h))

    def sand_tile(self, variant=0):
        """Seamless 32x32 beach tile built by tiling the pack's pure-sand band."""
        base = self.sand()
        if variant == 1:
            base = base.transpose(Image.FLIP_LEFT_RIGHT)
        elif variant == 2:
            base = base.transpose(Image.FLIP_TOP_BOTTOM)
        out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        for y in range(0, 32, base.height):
            for x in range(0, 32, base.width):
                out.alpha_composite(base, (x, y))
        return out

    # ---------------- road material (574220-road tilesheets) ----------------
    def road_tile(self, which="dirt"):
        """32x32 tileable interior sampled from the committed road tilesheets.

        `dirt`  <- Road2_grass.png (packed sand/earth brick roadway, freight character)
        `cobble` <- Road1_grass.png (cobblestone, maintained track character)
        The interior of the largest opaque piece is used so the tile has no grass fringe and
        tiles seamlessly; edges are drawn by the compiler from the corridor boundary.
        """
        key = ("road", which)
        if key in self.cache:
            return self.cache[key]
        name = "Road2_grass.png" if which == "dirt" else "Road1_grass.png"
        sheet = Image.open(os.path.join(EXTRACT, "574220-roads-reference-only",
                                        "PNG_Tiled", name)).convert("RGBA")
        a = np.array(sheet)[:, :, 3] > 250
        H, W = a.shape
        best = (-1, 0, 0, 0, 0)
        lab = np.zeros((H, W), np.int32)
        n = 0
        for y in range(H):
            for x in range(W):
                if a[y, x] and not lab[y, x]:
                    n += 1
                    q = [(x, y)]
                    lab[y, x] = n
                    x0 = x1 = x
                    y0 = y1 = y
                    cnt = 0
                    while q:
                        cx, cy = q.pop()
                        cnt += 1
                        x0, x1 = min(x0, cx), max(x1, cx)
                        y0, y1 = min(y0, cy), max(y1, cy)
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < W and 0 <= ny < H and a[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n
                                q.append((nx, ny))
                    if cnt > best[0]:
                        best = (cnt, x0, y0, x1, y1)
        _, x0, y0, x1, y1 = best
        # centred interior crop, guaranteed inside the piece
        size = min(32, max(16, min(x1 - x0, y1 - y0) - 12))
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2
        tile = sheet.crop((cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2))
        tile = tile.resize((32, 32), Image.NEAREST)
        self.cache[key] = tile
        return tile

    def soil_tiles(self, n=4):
        """Opaque soil tiles from 665131-fields (chosen by measured zero-grass fraction)."""
        key = ("soil", n)
        if key in self.cache:
            return self.cache[key]
        sheet = Image.open(os.path.join(EXTRACT, "665131-fields", "1 Tiles",
                                        "FieldsTileset.png")).convert("RGBA")
        cands = []
        for ty in range(sheet.height // 32):
            for tx in range(sheet.width // 32):
                t = sheet.crop((tx * 32, ty * 32, tx * 32 + 32, ty * 32 + 32))
                a = np.array(t).astype(int)
                if (a[:, :, 3] > 240).mean() < 0.999:
                    continue
                r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
                grass = ((g > r + 6) & (g > b + 6)).mean()
                cands.append((grass, tx, ty, t))
        cands.sort(key=lambda c: (c[0], c[1], c[2]))
        tiles = [c[3] for c in cands[:n]]
        self.cache[key] = tiles
        return tiles

    # ---------------- crops (fields pack) ----------------
    def crop_rows(self):
        sheet = Image.open(os.path.join(EXTRACT, "665131-fields", "1 Tiles",
                                        "FieldsTileset.png")).convert("RGBA")
        return sheet


def load_kit():
    ensure_extracted()
    return Kit()


if __name__ == "__main__":
    inv = ensure_extracted(force=True)
    for name, p in inv["packs"].items():
        print(name, p.get("sha256", "MISSING")[:16], len(p.get("files", {})), "png")
    print("modules ->", INVENTORY)
