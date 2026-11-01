"""VEYRA world compiler: gold map -> 16px-tile overworld with collision and props.

SCALE (derived from the map and the assets, not from any previous world):
  * the gold map carries a 250x175 terrain raster at 8 authoring units per cell;
  * the ground kits are 16 px tiles and the D051 body is 22 px tall (1.4 tiles);
  * the smallest authored feature that must stay readable is a river of 2.5-4
    units, i.e. half a gold cell. Rendering it as two 16 px tiles needs 2 tiles
    per gold cell, which also puts a 40x30-unit POI footprint at 20x15 tiles -
    one house (116-157 px) plus a yard fits inside it;
  * 2 tiles per gold cell => 500x350 tiles => 8000x5600 px. The D051 body is then
    1/364 of the world's width, which is the Last Island reference proportion
    (its authored 8000 px world against a ~24 px character).

Everything is deterministic: same input JSON -> same world, byte for byte.
"""
import base64
import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "out")
VAULT = os.environ.get("SOH_ASSET_VAULT", "/home/user/asset_vault/x")

GOLD = os.path.join(HERE, "data", "veyra_gold_map.json")
MATS = json.load(open(os.path.join(HERE, "data", "materials.json")))

TILE = 16
UP = 2                      # tiles per gold cell
CELL_U = 8                  # authoring units per gold cell
W, H = 250 * UP, 175 * UP   # 500 x 350 tiles
PXW, PXH = W * TILE, H * TILE

PACKS = {
    "road": "574220-roads-reference-only",
    "fields": "665131-fields",
    "island": "351300-island",
    "bridges": "668008-bridges",
    "cursed": "craftpix-net-958568-free-cursed-land-top-down-pixel-art-tileset*",
    "village": "craftpix-net-504452-free-village-pixel-tileset-for-top-down-defense*",
    "trees": "craftpix-net-385863-free-top-down-trees-pixel-art*",
    "bushes": "craftpix-net-141354-free-top-down-bushes-pixel-art*",
    "rocks": "craftpix-net-974061-free-rocks-and-stones-top-down-pixel-art*",
    "rocky": "craftpix-net-639143-free-rocky-area-objects-pixel-art*",
    "ruins": "craftpix-net-934618-free-top-down-ruins-pixel-art*",
    "forest": "craftpix-net-505052-free-forest-objects-top-down-pixel-art*",
    "farm": "200380-farm-plants",
}


def pdir(key):
    hits = sorted(glob.glob(os.path.join(VAULT, PACKS[key])))
    if not hits:
        raise SystemExit(f"missing pack {key}")
    return hits[0]


# --------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------
def fill_polygon(mask, ring, value, cell=CELL_U / UP):
    """Scanline fill of a closed ring (authoring units) into a tile-resolution mask."""
    pts = np.array(ring, dtype=float) / cell
    ys = np.arange(mask.shape[0]) + 0.5
    n = len(pts)
    for y in range(mask.shape[0]):
        yc = ys[y]
        xs = []
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            if (y0 > yc) != (y1 > yc):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        if not xs:
            continue
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            i0 = max(0, int(round(a)))
            i1 = min(mask.shape[1], int(round(b)))
            if i1 > i0:
                mask[y, i0:i1] = value
    return mask


def stroke_polyline(mask, pts, radius, value=1):
    """Round-brush stroke of a polyline in authoring units."""
    cell = CELL_U / UP
    r = max(1, int(round(radius / cell)))
    c = np.array(pts, dtype=float) / cell
    for (x0, y0), (x1, y1) in zip(c[:-1], c[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for s in range(steps + 1):
            t = s / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            ix, iy = int(round(cx)), int(round(cy))
            y0i, y1i = max(0, iy - r), min(mask.shape[0], iy + r + 1)
            x0i, x1i = max(0, ix - r), min(mask.shape[1], ix + r + 1)
            if y1i > y0i and x1i > x0i:
                mask[y0i:y1i, x0i:x1i] = value
    return mask


def edge_band(mask):
    """Tiles that have at least one 4-neighbour of a different value (coast/border)."""
    m = mask.astype(bool)
    n = np.zeros_like(m)
    n[1:] |= m[:-1] != m[1:]
    n[:-1] |= m[1:] != m[:-1]
    n[:, 1:] |= m[:, :-1] != m[:, 1:]
    n[:, :-1] |= m[:, 1:] != m[:, :-1]
    return n


# --------------------------------------------------------------------------
# assets
# --------------------------------------------------------------------------
class Props:
    """Whole-sprite library. Every sprite is cropped to its own alpha bbox."""

    GROUPS = {
        "tree_meadow": [("trees", "PNG/Assets_separately/Trees/Tree2.png"),
                        ("trees", "PNG/Assets_separately/Trees/Tree3.png")],
        "tree_forest": [("trees", "PNG/Assets_separately/Trees/Moss_tree1.png"),
                        ("trees", "PNG/Assets_separately/Trees/Moss_tree2.png"),
                        ("trees", "PNG/Assets_separately/Trees/Autumn_tree2.png"),
                        ("forest", "PNG/Assets/Blue-green_balls_tree2.png")],
        "tree_rock": [("trees", "PNG/Assets_separately/Trees/Palm_tree2_3.png"),
                      ("trees", "PNG/Assets_separately/Trees/Tree3.png")],
        "tree_dead": [("trees", "PNG/Assets_separately/Trees/Burned_tree2.png"),
                      ("trees", "PNG/Assets_separately/Trees/Broken_tree3.png"),
                      ("trees", "PNG/Assets_separately/Trees/Burned_tree3.png")],
        "bush": [("bushes", "PNG/Assets/Bush_simple1_1.png"),
                 ("bushes", "PNG/Assets/Bush_red_flowers2.png"),
                 ("bushes", "PNG/Assets/Fern1_1.png")],
        "rock": [("rocks", "PNG/Objects_separately/Rock1_grass_shadow3.png"),
                 ("rocks", "PNG/Objects_separately/Rock2_3_no_shadow.png"),
                 ("rocks", "PNG/Objects_separately/Rock3_3_no_shadow.png"),
                 ("rocky", "PNG/Objects_separately/Rock1_2_no_shadow.png")],
        "rock_big": [("rocks", "PNG/Objects_separately/Rock1_grass_shadow1.png"),
                     ("rocks", "PNG/Objects_separately/Rock2_grass_shadow1.png"),
                     ("rocky", "PNG/Objects_separately/Rock3_1.png")],
        "ruin": [("ruins", "PNG/Assets/Brown-gray_ruins3.png"),
                 ("ruins", "PNG/Assets/Blue-gray_ruins4.png"),
                 ("ruins", "PNG/Assets/Brown-gray_ruins5.png")],
        "house": [("village", "2 Objects/7 House/1.png"),
                  ("village", "2 Objects/7 House/2.png")],
        "stall": [("village", "2 Objects/6 Tent/1.png"),
                  ("village", "2 Objects/6 Tent/3.png")],
        "crate": [("village", "2 Objects/4 Box/3.png"),
                  ("village", "2 Objects/4 Box/5.png"),
                  ("village", "2 Objects/4 Box/1.png")],
        "crop": [("farm", "PNG/Plants.png")],
    }

    def __init__(self):
        self.sheets = {}
        self.items = {}
        for fam, entries in self.GROUPS.items():
            out = []
            for pack, rel in entries:
                p = os.path.join(pdir(pack), rel)
                if not os.path.exists(p):
                    continue
                if fam == "crop":
                    out += self._crops(p)
                    continue
                out += self._sprites(p)
            if out:
                self.items[fam] = out

    def _sprites(self, path):
        im = Image.open(path).convert("RGBA")
        bb = im.getbbox()
        if not bb:
            return []
        return [{"img": im.crop(bb), "src": path, "rect": list(bb), "size": list(im.size)}]

    def _crops(self, path):
        """The farm sheet is a grid of plants; each standalone component is one crop sprite."""
        im = Image.open(path).convert("RGBA")
        a = np.array(im)[:, :, 3] > 0
        seen = np.zeros_like(a)
        out = []
        Hh, Ww = a.shape
        for y in range(0, Hh, 2):
            for x in range(0, Ww, 2):
                if not a[y, x] or seen[y, x]:
                    continue
                stack = [(x, y)]
                seen[y, x] = True
                mnx = mxx = x
                mny = mxy = y
                n = 0
                while stack:
                    cx, cy = stack.pop()
                    n += 1
                    mnx = min(mnx, cx); mxx = max(mxx, cx)
                    mny = min(mny, cy); mxy = max(mxy, cy)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < Ww and 0 <= ny < Hh and a[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                stack.append((nx, ny))
                if 8 <= n <= 900 and 8 <= mxx - mnx <= 40 and 8 <= mxy - mny <= 40:
                    out.append({"img": im.crop((mnx, mny, mxx + 1, mxy + 1)), "src": path,
                                "rect": [mnx, mny, mxx - mnx + 1, mxy - mny + 1],
                                "size": list(im.size)})
        return out[:16]


def tone(im):
    a = np.array(im.convert("RGB")).astype(float)
    return a.reshape(-1, 3).mean(axis=0)


def cluster(imgs, tol=13.0):
    """Keep only tiles whose mean colour is close to the family median.

    The source sheets contain several green/soil variants. Mixing all of them per
    tile produced a visible checkerboard (see PILOT notes); clustering keeps the
    material one tone and lets decals carry the texture.
    """
    tones = np.array([tone(i) for i in imgs])
    med = np.median(tones, axis=0)
    keep = [im for im, t in zip(imgs, tones) if np.abs(t - med).max() <= tol]
    return keep or imgs[:1]


def water_tones():
    """Sample the source's own ocean palette.

    The island sheet has no foam-free 16x16 window (every water tile carries a
    wave or foam line), so the sea is drawn as two flat depths taken from that
    sheet's own water pixels - deep median and shallow median. Nothing is tinted;
    the colours are the source's.
    """
    im = Image.open(os.path.join(pdir("island"), "Tileset/Tiled.png")).convert("RGB")
    a = np.array(im).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    water = (b > r + 45) & (b > 140)
    px = a[water]
    lum = px.mean(axis=1)
    order = np.argsort(lum)                 # the palette is discrete, so take real entries
    deep = px[order[int(len(order) * 0.18)]]
    shallow = px[order[int(len(order) * 0.55)]]
    deep_t = Image.new("RGBA", (16, 16), tuple(int(v) for v in deep) + (255,))
    shallow_t = Image.new("RGBA", (16, 16), tuple(int(v) for v in shallow) + (255,))
    return deep_t, shallow_t, [int(v) for v in deep], [int(v) for v in shallow]


def load_decals():
    out = {"tuft": [], "pebble": [], "flower": []}
    for f in sorted(glob.glob(os.path.join(pdir("village"), "2 Objects/5 Grass/*.png"))):
        im = Image.open(f).convert("RGBA"); bb = im.getbbox()
        if bb: out["tuft"].append(im.crop(bb))
    for f in sorted(glob.glob(os.path.join(pdir("village"), "2 Objects/2 Stone/*.png"))):
        im = Image.open(f).convert("RGBA"); bb = im.getbbox()
        if bb: out["pebble"].append(im.crop(bb))
    for f in sorted(glob.glob(os.path.join(pdir("bushes"), "PNG/Assets/Bush_*flowers2.png"))):
        im = Image.open(f).convert("RGBA"); bb = im.getbbox()
        if bb: out["flower"].append(im.crop(bb))
    return out


def load_tiles():
    tiles = {}
    for fam, entries in MATS.items():
        if fam.startswith("_"):
            continue
        imgs = []
        for e in entries:
            base = pdir(e["name"]) if e["name"] in PACKS else None
            if base is None:
                base = sorted(glob.glob(os.path.join(VAULT, PACKS[e["name"]])))[0]
            if e.get("flat"):
                imgs.append(Image.new("RGBA", (16, 16), tuple(e["flat"]) + (255,)))
                continue
            base = sorted(glob.glob(os.path.join(VAULT, PACKS[e["name"]])))[0]
            im = Image.open(os.path.join(base, e["file"])).convert("RGBA")
            imgs.append(im.crop((e["x"], e["y"], e["x"] + 16, e["y"] + 16)))
        tiles[fam] = imgs if fam == "water" else cluster(imgs)
    return tiles


# --------------------------------------------------------------------------
# world model
# --------------------------------------------------------------------------
ZONE_GRAMMAR = {
    # zone tag / soil -> (ground family, tree family or None, decal density, prop density)
    "forest": ("grass_dark", "tree_forest", 0.16, 0.055),
    "hill": ("grass_dark", "tree_rock", 0.09, 0.018),
    "high rock": ("stone", "tree_rock", 0.05, 0.020),
    "summit": ("stone", None, 0.10, 0.010),
    "coast": ("sand", None, 0.06, 0.010),
    "lakeshore": ("grass", "tree_meadow", 0.14, 0.030),
    "riverside": ("grass", "tree_meadow", 0.12, 0.028),
    "plain": ("grass", "tree_meadow", 0.10, 0.020),
    "dry": ("sand", "tree_dead", 0.05, 0.012),
    "blight": ("blight", "tree_dead", 0.07, 0.022),
}


def zone_grammar(zone):
    tags = set(zone.get("tags") or [])
    soil = (zone.get("soil") or "").lower()
    if "xỉ" in soil or "độc" in soil:
        return "blight"
    if "tro" in soil:
        return "blight"
    if "đá" in soil or "nền đá" in soil or "đá vụn" in soil or "đá nổi" in soil:
        return "high rock"
    if "cát cứng" in soil:
        return "dry"
    if "cát" in soil and "ven biển" in tags:
        return "coast"
    if "trong rừng" in tags or "đất rừng" in soil:
        return "forest"
    if "bờ hồ" in tags:
        return "lakeshore"
    if "ven sông" in tags:
        return "riverside"
    if "ven biển" in tags:
        return "coast"
    return "plain"


def build_grammar_grid(project):
    """Zone polygons -> per-tile grammar key. Unzoned land falls back to plain."""
    key = np.full((H, W), "plain", dtype=object)
    zr = np.zeros((H, W), dtype=np.int16)
    zones = project["zones"]
    for i, z in enumerate(zones, start=1):
        fill_polygon(zr, z["ring"], i)
    lut = {0: None}
    for i, z in enumerate(zones, start=1):
        lut[i] = z
    gram = np.empty((H, W), dtype=object)
    for i in range(len(zones) + 1):
        if i == 0:
            continue
        m = zr == i
        if m.any():
            gram[m] = zone_grammar(lut[i])
    gram[zr == 0] = "plain"
    return gram, zr


def main(preview=None):
    os.makedirs(OUT, exist_ok=True)
    project = json.load(open(GOLD))["project"]

    # ---- masks -----------------------------------------------------------
    land = np.zeros((H, W), dtype=np.uint8)
    for l in project["land"]:
        for ring in l["rings"]:
            fill_polygon(land, ring, 1)
    lakes = np.zeros((H, W), dtype=np.uint8)
    for l in project["lakes"]:
        fill_polygon(lakes, l["ring"], 1)
    rivers = np.zeros((H, W), dtype=np.uint8)
    for r in project["rivers"]:
        stroke_polyline(rivers, r["points"], max(2.0, (r.get("width") or 3) / 2))
    land_only = land.copy()
    water = (1 - land_only) | lakes | (rivers & land_only)
    land_walk = ((land_only == 1) & (lakes == 0) & (rivers == 0)).astype(np.uint8)

    roads = np.zeros((H, W), dtype=np.uint8)
    road_kind = np.zeros((H, W), dtype=np.uint8)
    kinds = {"cart": 2, "trail": 2, "riverside": 2, "foot": 1}
    for i, rd in enumerate(project["roads"]):
        k = rd.get("kind", "trail")
        if k == "ferry":
            continue
        stroke_polyline(roads, rd["points"], 1.6 if kinds.get(k, 2) == 2 else 0.9, 1)
        road_kind[roads.astype(bool) & (roads == 1)] = kinds.get(k, 2)

    # bridges force a land crossing
    for br in project["bridges"]:
        x, y = br["at"]
        ix, iy = int(x / (CELL_U / UP)), int(y / (CELL_U / UP))
        roads[max(0, iy - 2):iy + 3, max(0, ix - 3):ix + 4] = 1
        land_walk[max(0, iy - 1):iy + 2, max(0, ix - 2):ix + 3] = 1

    # ---- terrain grammar -------------------------------------------------
    gram, zr = build_grammar_grid(project)
    elev = np.frombuffer(base64.b64decode(project["terrain"]["elev"]),
                         dtype=np.uint8).reshape(175, 250)
    elev_t = np.repeat(np.repeat(elev, UP, axis=0), UP, axis=1)
    # relief comes from the gold raster, not from a decision here: high ground is rock,
    # the highest ground has no canopy at all, mid ground is thin-soil hill.
    land_only = land.astype(bool) & ~water.astype(bool) & ~roads.astype(bool)
    land_elev = elev[land.astype(bool)[::UP, ::UP]]
    q = np.percentile(land_elev, [45, 75, 92]) if land_elev.size else np.array([40, 95, 150])
    print("land elevation quintiles 45/75/92:", q.round(0).tolist())
    gram[elev_t >= q[2]] = "summit"
    gram[(elev_t >= q[1]) & (elev_t < q[2])] = "high rock"
    gram[(elev_t >= q[0]) & (elev_t < q[1]) & ~np.isin(gram, ["high rock", "blight", "summit"])] = "hill"
    for k in ("hill", "high rock", "summit"):
        print(f"relief grammar {k:10s} {100*(gram == k).mean():.1f}% of tiles")

    # ---- ground pass -----------------------------------------------------
    tiles = load_tiles()
    rng = np.random.default_rng(20261102)
    ground = np.zeros((H, W), dtype=np.uint8)   # index into a flat tile list
    palette = []
    fam_index = {}
    for fam, imgs in tiles.items():
        for t in imgs:
            fam_index.setdefault(fam, []).append(len(palette))
            palette.append(t)
    # ocean: deeper tone further from shore
    shore = edge_band(water)
    canvas = Image.new("RGBA", (PXW, PXH), (18, 26, 34, 255))

    tone_groups = {}
    for fam, idxs in fam_index.items():
        if len(idxs) < 3:
            tone_groups[fam] = [idxs]
            continue
        order = sorted(idxs, key=lambda k: np.array(palette[k].convert("RGB")).mean())
        thirds = np.array_split(np.array(order), 3)
        tone_groups[fam] = [list(map(int, t)) for t in thirds if len(t)]

    def pick(fam, i, j):
        groups = tone_groups.get(fam) or [fam_index[fam]]
        coarse = (i // 14) * 92821 ^ (j // 14) * 68917
        band = groups[coarse % len(groups)]
        h = (i * 73856093 ^ j * 19349663) & 0xFFFFFFFF
        return band[h % len(band)]

    # beaches are a band along the water, not a whole zone
    # a beach belongs to the sea: rivers and lakes keep grassy banks with pebbles
    sea = np.asarray(water).astype(bool) & ~np.asarray(lakes, dtype=bool) & ~np.asarray(rivers, dtype=bool)
    beach = sea.copy()
    for _ in range(4):
        nb = beach.copy()
        nb[1:] |= beach[:-1]; nb[:-1] |= beach[1:]
        nb[:, 1:] |= beach[:, :-1]; nb[:, :-1] |= beach[:, 1:]
        beach = nb
    shore_band = beach

    # ground arrays
    ground_maps = {}
    for y in range(H):
        for x in range(W):
            if water[y, x]:
                fam = "water"
            elif roads[y, x]:
                fam = "road"
            else:
                fam = ZONE_GRAMMAR[gram[y, x]][0]
                if fam == "sand" and not shore_band[y, x]:
                    fam = "grass"
            ground_maps[(y, x)] = fam

    # blit ground row by row (per-tile paste keeps seams exact)
    deep_t, shallow_t, deep_rgb, shallow_rgb = water_tones()
    near_land = np.zeros((H, W), dtype=bool)
    lm = land_walk.astype(bool) | roads.astype(bool)
    d = lm.copy()
    for _ in range(2):                      # 2-tile shallow shelf around every shore
        nb = d.copy()
        nb[1:] |= d[:-1]; nb[:-1] |= d[1:]
        nb[:, 1:] |= d[:, :-1]; nb[:, :-1] |= d[:, 1:]
        d = nb
    near_land = d & ~lm
    ford = np.zeros((H, W), bool)
    # a ford is a short shallow crossing; a road that runs far out over open water is
    # a sea route and stays water (it is not walkable in either case)
    from collections import deque as _dq
    wet_road = (roads.astype(bool) & water.astype(bool))
    seen_ford = np.zeros((H, W), bool)
    for sy in range(H):
        for sx in range(W):
            if not wet_road[sy, sx] or seen_ford[sy, sx]:
                continue
            comp = []
            q = _dq([(sx, sy)])
            seen_ford[sy, sx] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and wet_road[ny, nx] and not seen_ford[ny, nx]:
                        seen_ford[ny, nx] = True
                        q.append((nx, ny))
            if len(comp) <= 36:
                for x, y in comp:
                    ford[y, x] = True
    for y in range(H):
        for x in range(W):
            fam = ground_maps[(y, x)]
            if fam == "water":
                if ford[y, x]:
                    # a road that meets a river crosses at a ford: shallow water you
                    # can wade, not a beach and not a bridge
                    canvas.paste(shallow_t, (x * TILE, y * TILE))
                    continue
                canvas.paste(shallow_t if near_land[y, x] else deep_t, (x * TILE, y * TILE))
                continue
            t = palette[pick(fam, x, y)]
            canvas.paste(t, (x * TILE, y * TILE))
    print("ground blitted", canvas.size)

    # ---- props -----------------------------------------------------------
    props = Props()
    decals = load_decals()
    DECAL_P = {"grass": 0.14, "grass_dark": 0.16, "soil": 0.05, "sand": 0.05,
               "stone": 0.07, "blight": 0.09}
    print("prop families:", {k: len(v) for k, v in props.items.items()})
    placements = []

    def place(fam, wx, wy, collider=True):
        items = props.items.get(fam)
        if not items:
            return
        h = (wx * 2654435761 ^ wy * 40503) & 0xFFFFFFFF
        it = items[h % len(items)]
        placements.append({"fam": fam, "img": it["img"], "x": wx, "y": wy,
                           "collider": collider, "src": it["src"]})

    # POI yards are plazas: nothing that scatters is allowed inside one, so a
    # settlement keeps a walkable centre instead of being buried by its own trees.
    yard = np.zeros((H, W), bool)
    for p in project["pois"]:
        ax, ay = p["at"]
        tx, ty = ax / (CELL_U / UP), ay / (CELL_U / UP)
        foot = p.get("foot")
        radius_t = 3
        if foot:
            xs = [q[0] for q in foot]
            radius_t = max(2, int((max(xs) - min(xs)) / (2 * CELL_U / UP)))
        radius_t = min(6, radius_t)
        y0, y1 = max(0, int(ty - radius_t - 1)), min(H, int(ty + radius_t + 2))
        x0, x1 = max(0, int(tx - radius_t - 1)), min(W, int(tx + radius_t + 2))
        yard[y0:y1, x0:x1] = True

    # ground decals: the texture that flat source tiles cannot provide
    for y in range(H):
        for x in range(W):
            if not land_walk[y, x] or roads[y, x] or yard[y, x]:
                continue
            fam = ZONE_GRAMMAR[gram[y, x]][0]
            h = (x * 40503 ^ y * 2654435761) & 0xFFFFFFFF
            if (h % 1000) / 1000.0 > DECAL_P.get(fam, 0.05):
                continue
            kinds = ["tuft", "tuft", "flower", "pebble"] if fam in ("grass", "grass_dark") else \
                    ["pebble", "pebble", "tuft"] if fam == "soil" else \
                    ["pebble", "flower"] if fam == "sand" else \
                    ["pebble"] if fam == "stone" else ["tuft", "pebble"]
            k = kinds[(h >> 9) % len(kinds)]
            pool = decals.get(k) or []
            if not pool:
                continue
            im = pool[(h >> 17) % len(pool)]
            placements.append({"fam": "decal", "img": im, "x": x * TILE + (h >> 4) % 14 + 1,
                               "y": y * TILE + (h >> 7) % 14 + 2, "collider": False, "src": ""})

    # scattered vegetation per grammar
    step = 2
    for y in range(0, H, 1):
        for x in range(0, W, 1):
            if not land_walk[y, x] or yard[y, x]:
                continue
            g = gram[y, x]
            _, tree_fam, decal_p, prop_p = ZONE_GRAMMAR[g]
            h = (x * 73856093 ^ y * 19349663 ^ 0x9E3779B9) & 0xFFFFFFFF
            r = (h % 10000) / 10000.0
            wx = x * TILE + TILE // 2
            wy = y * TILE + TILE - 2
            if r < prop_p:
                if tree_fam and (r * 3) % 1 < 0.72:
                    place(tree_fam, wx, wy)
                elif r * 5 % 1 < 0.5:
                    place("bush", wx, wy, collider=False)
                else:
                    place("rock", wx, wy, collider=False)

    # rocks and ruins in high rock / blight regardless of scatter
    for y in range(0, H):
        for x in range(0, W):
            if not land_walk[y, x] or yard[y, x]:
                continue
            g = gram[y, x]
            h = (x * 2654435761 ^ y * 40503) & 0xFFFFFFFF
            if g == "high rock" and h % 37 == 0:
                place("rock_big", x * TILE + 8, y * TILE + 14)
            if g == "blight" and h % 53 == 0:
                place("rock", x * TILE + 8, y * TILE + 14)

    # ---- POIs ------------------------------------------------------------
    poi_out = []
    for p in project["pois"]:
        ax, ay = p["at"]
        tx, ty = ax / (CELL_U / UP), ay / (CELL_U / UP)
        arche = p.get("arche")
        foot = p.get("foot")
        radius_t = 3
        if foot:
            xs = [q[0] for q in foot]; ys = [q[1] for q in foot]
            radius_t = min(6, max(2, int((max(xs) - min(xs)) / (2 * CELL_U / UP))))
        # flatten the yard: soil pad
        if not water[int(ty), int(tx)]:
            y0, y1 = int(ty - radius_t), int(ty + radius_t)
            x0, x1 = int(tx - radius_t), int(tx + radius_t)
            for yy in range(max(0, y0), min(H, y1)):
                for xx in range(max(0, x0), min(W, x1)):
                    if land_walk[yy, xx] and not roads[yy, xx]:
                        t = palette[pick("soil" if arche in ("farm", "grove", "mill") else "stone",
                                          xx, yy)]
                        canvas.paste(t, (xx * TILE, yy * TILE))
            # structures
            build = {"hamlet": 2, "village": 3, "port": 2, "pier": 1, "roadstop": 1,
                     "quarry": 1, "mine": 1, "ruins": 2, "elder_site": 1,
                     "observatory": 1, "research": 1, "facility": 1, "gate": 1}
            n = build.get(arche, 1)
            for k in range(n):
                ang = (k / max(1, n)) * 6.283 + (hash(p["id"]) % 100) / 100
                ox = int(tx + np.cos(ang) * radius_t * 0.8)
                oy = int(ty + np.sin(ang) * radius_t * 0.8)
                fam = "ruin" if arche in ("ruins", "tomb", "elder_site") else "house"
                place(fam, ox * TILE + 8, oy * TILE + 14)
            if arche in ("grove", "farm", "mill"):
                for k in range(3):
                    place("crop", (int(tx) + k - 1) * TILE + 8, (int(ty) + 1) * TILE + 14,
                          collider=False)
        poi_out.append({"id": p["id"], "name": p["name"], "arche": arche,
                        "cell": [round(tx, 1), round(ty, 1)],
                        "tile": [int(tx), int(ty)], "elder": p.get("elder"),
                        "access": p.get("access"), "role": p.get("role")})

    # ---- resources -------------------------------------------------------
    res_out = []
    RES_FAM = {"wood": "tree_meadow", "stone": "rock_big", "ore": "rock_big",
               "obsidian": "rock", "sulfur": "rock", "clay": "rock",
               "herbs": "bush", "food": "bush", "fish": None, "fresh_water": None,
               "salt": "rock"}
    for r in project["resources"]:
        fam = RES_FAM.get(r.get("kind"))
        ax, ay = r["at"]
        tx, ty = ax / (CELL_U / UP), ay / (CELL_U / UP)
        if fam and 0 <= int(ty) < H and 0 <= int(tx) < W and land_walk[int(ty), int(tx)]:
            place(fam, int(tx) * TILE + 8, int(ty) * TILE + 14, collider=False)
        res_out.append({"id": r["id"], "kind": r.get("kind"), "tile": [int(tx), int(ty)]})

    # docks as plank platforms
    for d in project["docks"]:
        ax, ay = d["at"]
        tx, ty = ax / (CELL_U / UP), ay / (CELL_U / UP)
        if 0 <= int(ty) < H and 0 <= int(tx) < W:
            place("crate", int(tx) * TILE + 8, int(ty) * TILE + 14, collider=False)

    # ---- draw props (y-sorted) ------------------------------------------
    placements.sort(key=lambda p: (p["y"], p["x"]))
    for p in placements:
        im = p["img"]
        canvas.alpha_composite(im, (int(p["x"] - im.width / 2), int(p["y"] - im.height)))

    print("props placed", len(placements))
    canvas.convert("RGB").save(os.path.join(OUT, "world.png"))
    canvas.convert("RGB").resize((W * 2, H * 2), Image.NEAREST).save(
        os.path.join(OUT, "world_half.png"))
    canvas.convert("RGB").resize((W, H), Image.NEAREST).save(os.path.join(OUT, "minimap.png"))

    # ---- collision -------------------------------------------------------
    solid = np.zeros((H, W), dtype=np.uint8)
    solid[water.astype(bool)] = 1
    solid[roads.astype(bool) & ~water.astype(bool)] = 0
    solid[ford] = 0
    for br in project["bridges"]:
        x, y = br["at"]
        ix, iy = int(x / (CELL_U / UP)), int(y / (CELL_U / UP))
        solid[max(0, iy - 1):iy + 2, max(0, ix - 2):ix + 3] = 0
    for p in placements:
        if not p["collider"]:
            continue
        tx, ty = int(p["x"] // TILE), int((p["y"] - 6) // TILE)
        if 0 <= ty < H and 0 <= tx < W:
            solid[ty, tx] = 1
    np.save(os.path.join(OUT, "solid.npy"), solid)
    rows = []
    for y in range(H):
        row = solid[y]
        runs = []
        val = int(row[0]); start = 0
        for x in range(1, W):
            if int(row[x]) != val:
                runs.append([start, x - start, val]); val = int(row[x]); start = x
        runs.append([start, W - start, val])
        rows.append(runs)

    meta = {
        "schema": "soh.veyra.world.v1",
        "source": {"gold": os.path.basename(GOLD), "gold_sha256": hashlib_sha(GOLD)},
        "scale": {"gold_cell_units": CELL_U, "tiles_per_gold_cell": UP,
                  "tile_px": TILE, "tiles": [W, H], "pixels": [PXW, PXH],
                  "px_per_gold_unit": TILE / (CELL_U / UP)},
        "spawns": project["spawns"],
        "pois": poi_out,
        "resources": res_out,
        "zones": [{"id": z["id"], "name": z["name"], "grammar": zone_grammar(z),
                   "ring": [[round(q[0], 1), round(q[1], 1)] for q in z["ring"]],
                   "soil": z.get("soil"), "tags": z.get("tags")} for z in project["zones"]],
        "lands": [{"id": l["id"], "name": l["name"], "kind": l["kind"]} for l in project["land"]],
        "collision": {"encoding": "rows of [start,len,value]", "rows": rows},
    }
    json.dump(meta, open(os.path.join(OUT, "world_meta.json"), "w"), separators=(",", ":"))
    print("world", canvas.size, "collision rows", H)


def hashlib_sha(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


if __name__ == "__main__":
    main()
