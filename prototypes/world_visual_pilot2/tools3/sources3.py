"""Pilot 3 source registry.

Every pixel used by the compositor is declared here with:
  * the private archive it comes from (never committed),
  * an explicit rectangle in that PNG,
  * a class that says how the rectangle must be validated,
  * a foot anchor and an intended scale,
  * the reason the frame is in the composition.

Classes
-------
sprite  A complete, standalone object. The rectangle must equal the alpha
        bounding box of the whole PNG (or of one connected component of a
        sprite sheet). A crop that clips the object or swallows a neighbour
        is rejected by `validate()`.
tile    A 16x16 material sample taken from a *uniform interior* region, so it
        repeats without a seam. Alpha coverage must be 100%.
band    A 16x6 edge band that is drawn only on a pavement border, in its
        native orientation; the same band is rotated for the other two sides.

Scale policy: **no resampling anywhere**. Objects are used at their native
pixel size, which is why only frames already inside the world's scale band
(16-73 px, against a 22 px D051 body) are accepted. Atlas downscaling was the
main defect of pilot 2.
"""
import glob
import hashlib
import os

from PIL import Image

VAULT = os.environ.get("SOH_ASSET_VAULT", "/home/user/asset_vault/x")

PACK = {
    # short key : (archive directory glob, human label, craftpix id)
    "road": ("craftpix-net-574220*", "Path & road top-down tileset", "574220"),
    "village": ("craftpix-net-504452*", "Village tileset for top-down defense", "504452"),
    "trees": ("craftpix-net-385863*", "Top-down trees", "385863"),
    "bushes": ("craftpix-net-141354*", "Top-down bushes", "141354"),
    "rocks": ("craftpix-net-974061*", "Rocks and stones top-down", "974061"),
    "supplies": ("craftpix-net-218281*", "Pixel-art dungeon objects", "218281"),
    "male": ("craftpix-net-555940*", "Base 4-direction male character", "555940"),
    "female": ("craftpix-net-419402*", "Base 4-direction female character", "419402"),
}

# short key : path inside the pack
FILES = {
    "ground": ("road", "PNG_Tiled/Ground_grass.png"),
    "road1": ("road", "PNG_Tiled/Road1_grass.png"),
    "road2": ("road", "PNG_Tiled/Road2_grass.png"),
    "road3": ("road", "PNG_Tiled/Road3_grass.png"),
    "road4": ("road", "PNG_Tiled/Road4_grass.png"),
    "road5": ("road", "PNG_Tiled/Road5_grass.png"),
    "stall_red": ("village", "2 Objects/6 Tent/1.png"),
    "stall_blue": ("village", "2 Objects/6 Tent/2.png"),
    "stall_green": ("village", "2 Objects/6 Tent/3.png"),
    "barrel_a": ("village", "2 Objects/4 Box/1.png"),
    "barrel_b": ("village", "2 Objects/4 Box/2.png"),
    "crate_small": ("village", "2 Objects/4 Box/3.png"),
    "crate_flat": ("village", "2 Objects/4 Box/4.png"),
    "crate_big": ("village", "2 Objects/4 Box/5.png"),
    "cart": ("village", "2 Objects/3 Decor/1.png"),
    "cart_broken": ("village", "2 Objects/3 Decor/2.png"),
    "planks_a": ("village", "2 Objects/3 Decor/3.png"),
    "plank": ("village", "2 Objects/3 Decor/4.png"),
    "plank_pile": ("village", "2 Objects/3 Decor/5.png"),
    "lantern": ("village", "2 Objects/3 Decor/6.png"),
    "torch_post": ("village", "2 Objects/3 Decor/8.png"),
    "signpost": ("village", "2 Objects/3 Decor/10.png"),
    "signpost_b": ("village", "2 Objects/3 Decor/9.png"),
    "skull_sign": ("village", "2 Objects/3 Decor/12.png"),
    "skull_trophy": ("village", "2 Objects/3 Decor/14.png"),
    "stone_wall": ("village", "2 Objects/3 Decor/13.png"),
    "other_objects": ("supplies", "PNG/Other_objects.png"),
    "tree_a": ("trees", "PNG/Assets_separately/Trees/Moss_tree3.png"),
    "tree_b": ("trees", "PNG/Assets_separately/Trees/Tree3.png"),
    "tree_c": ("trees", "PNG/Assets_separately/Trees/Flower_tree3.png"),
    "tree_d": ("trees", "PNG/Assets_separately/Trees/Moss_tree2.png"),
    "bush_a": ("bushes", "PNG/Assets/Bush_simple1_1.png"),
    "bush_b": ("bushes", "PNG/Assets/Bush_blue_flowers1.png"),
    "burned_a": ("trees", "PNG/Assets_separately/Trees/Burned_tree2.png"),
    "burned_b": ("trees", "PNG/Assets_separately/Trees/Burned_tree3.png"),
    "broken_tree": ("trees", "PNG/Assets_separately/Trees/Broken_tree3.png"),
    "rock_1": ("rocks", "PNG/Objects_separately/Rock1_grass_shadow1.png"),
    "rock_2": ("rocks", "PNG/Objects_separately/Rock2_grass_shadow1.png"),
    "rock_3": ("rocks", "PNG/Objects_separately/Rock1_grass_shadow2.png"),
    "rock_4": ("rocks", "PNG/Objects_separately/Rock2_2_no_shadow.png"),
    "rock_5": ("rocks", "PNG/Objects_separately/Rock3_2_no_shadow.png"),
    "rock_6": ("rocks", "PNG/Objects_separately/Rock3_3_no_shadow.png"),
    "rock_7": ("rocks", "PNG/Objects_separately/Rock4_4.png"),
    "rock_8": ("rocks", "PNG/Objects_separately/Rock1_3_no_shadow.png"),
    "male_idle": ("male", "PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png"),
    "male_walk": ("male", "PNG/Unarmed/Without_shadow/Unarmed_Walk_without_shadow.png"),
    "female_idle": ("female", "PNG/Unarmed/Without_shadow/Unarmed_Idle_without_shadow.png"),
    "female_walk": ("female", "PNG/Unarmed/Without_shadow/Unarmed_Walk_without_shadow.png"),
}

def pack_dir(key):
    hits = sorted(glob.glob(os.path.join(VAULT, PACK[key][0])))
    if not hits:
        raise SystemExit(f"missing archive for pack {key!r} under {VAULT}")
    return hits[0]


def path_of(key):
    pack, rel = FILES[key]
    return os.path.join(pack_dir(pack), rel)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------
# whole-object frames: (file key, rect or None for "alpha bbox of the file")
# sheets use one connected component each, addressed by its exact bbox.
# --------------------------------------------------------------------------
SPRITES = {
    # stalls: market canopy, posts and a counter - native 64-73 px
    "stall_red": ("stall_red", None, "foot", "waystation counter, candidate A landmark"),
    "stall_blue": ("stall_blue", None, "foot", "alternate canopy tint, unused"),
    "stall_green": ("stall_green", None, "foot", "alternate canopy tint, unused"),
    "barrel_a": ("barrel_a", None, "foot", "water barrel beside the counter"),
    "barrel_b": ("barrel_b", None, "foot", "second barrel, candidate B wreck"),
    "crate_small": ("crate_small", None, "foot", "supply crate at the cache node"),
    "crate_flat": ("crate_flat", None, "foot", "flattened crate, candidate B"),
    "crate_big": ("crate_big", None, "foot", "ledger crate at the ledger node"),
    "cart": ("cart", None, "foot", "hand cart parked on the plaza, candidate A"),
    "cart_broken": ("cart_broken", None, "foot", "abandoned cart, candidate B"),
    "planks_a": ("planks_a", None, "foot", "loose planks, candidate B"),
    "plank": ("plank", None, "foot", "single plank, candidate B"),
    "plank_pile": ("plank_pile", None, "foot", "stacked planks on the delivery cart"),
    "lantern": ("lantern", None, "foot", "small lantern on the counter"),
    "torch_post": ("torch_post", None, "foot", "light post at the yard entrance"),
    "signpost": ("signpost", None, "foot", "route sign at the west approach"),
    "signpost_b": ("signpost_b", None, "foot", "second sign at the plaza east edge"),
    "skull_sign": ("skull_sign", None, "foot", "death mark on a post, candidate B"),
    "skull_trophy": ("skull_trophy", None, "foot", "skull trophy on the counter, candidate A"),
    "stone_wall": ("stone_wall", None, "foot", "collapsed stonework at the cliff foot"),
    "trophy_skull": ("other_objects", (7, 5, 34, 43), "foot",
                     "bracketed trophy skull, candidate B landmark"),
    "banner": ("other_objects", (164, 64, 23, 30), "foot", "hanging banner, both candidates"),
    "tree_a": ("tree_a", None, "foot", "small moss tree framing the east edge"),
    "tree_b": ("tree_b", None, "foot", "small tree north of the yard"),
    "tree_c": ("tree_c", None, "foot", "flowering tree at the moor margin"),
    "tree_d": ("tree_d", None, "foot", "mid tree on the north verge"),
    "bush_a": ("bush_a", None, "foot", "bush at the plaza margin"),
    "bush_b": ("bush_b", None, "foot", "berry bush at the layby"),
    "burned_a": ("burned_a", None, "foot", "burned snag at the authored deadfall"),
    "burned_b": ("burned_b", None, "foot", "second burned snag, candidate B"),
    "broken_tree": ("broken_tree", None, "foot", "broken trunk at the deadfall"),
    "rock_1": ("rock_1", None, "foot", "cliff boulder, grass shadow variant"),
    "rock_2": ("rock_2", None, "foot", "cliff boulder, grass shadow variant"),
    "rock_3": ("rock_3", None, "foot", "cliff boulder"),
    "rock_4": ("rock_4", None, "foot", "cliff boulder"),
    "rock_5": ("rock_5", None, "foot", "cliff boulder"),
    "rock_6": ("rock_6", None, "foot", "mid boulder"),
    "rock_7": ("rock_7", None, "foot", "small boulder"),
    "rock_8": ("rock_8", None, "foot", "small boulder"),
}

# materials, resolved at run time from uniform interiors (see resolve_tiles)
TILES = {
    "grass": ("ground", 24, "moor ground, 20 independent uniform interior samples"),
    "pave": [("road1",), ("road2",), ("road3",), ("road4",), ("road5",)],
}
BANDS = {"pave_top": ("road1", (17, 377, 96, 6)), "pave_bot": ("road1", (17, 399, 96, 6))}

# --------------------------------------------------------------------------
# pilot 2 crops kept only so the inspection sheet can show what was wrong
# --------------------------------------------------------------------------
REJECTED = [
    {"name": "fence_h", "pack": "village", "file": "1.1 Tiles/Tileset2.png",
     "rect": (0, 8, 144, 46),
     "why": "the rectangle overlaps the gate rectangle (96,4,64,46) and clips the "
            "fence run at x=144; Tileset2's palisade pieces touch, so no connected "
            "component exists that isolates one run."},
    {"name": "gate", "pack": "village", "file": "1.1 Tiles/Tileset2.png",
     "rect": (96, 4, 64, 46),
     "why": "shares 32 px of its column range with fence_h; the arch is also cut on "
            "its right side where the next fence bay starts."},
    {"name": "spikes", "pack": "village", "file": "1.1 Tiles/Tileset2.png",
     "rect": (192, 192, 48, 40),
     "why": "not a spike run: at world scale it renders as a loose red plank. Withdrawn."},
    {"name": "road_strip_fill", "pack": "road", "file": "PNG_Tiled/Road1_grass.png",
     "rect": (0, 6, 96, 16),
     "why": "the strip has fully transparent columns that were patched by "
            "'heal_columns'; the fill is replaced by an opaque interior sample."},
    {"name": "clay_auto", "pack": "village", "file": "1 Tiles/FieldsTileset.png",
     "rect": None,
     "why": "bare clay was chosen by a warm-pixel ratio over the whole pre-rendered "
            "scene, so the tile was whatever scored highest, not a designed material. "
            "The cliff is now drawn as boulders from the rock pack."},
    {"name": "tree_big@0.5", "pack": "trees", "file": "PNG/Assets_separately/Trees/Tree1.png",
     "rect": None,
     "why": "128 px tree against a 22 px body (5.8x) had to be halved by NEAREST, "
            "which is resampling. Replaced by native 32-48 px frames."},
    {"name": "burned_dup", "pack": "trees",
     "file": "PNG/Assets_separately/Trees/Burned_tree1.png", "rect": None,
     "why": "placed twice at the same world coordinates (398.6,203.4) by two edits; "
            "candidate layouts now assert unique positions."},
]


SHEET_FILES = {"other_objects"}


def validate_rects(imgs, sprites):
    """Return per-sprite verdicts: whole-object checks against source alpha."""
    out = {}
    for name, (key, rect, anchor, why) in sprites.items():
        im = imgs[key]
        bbox = im.getbbox()
        if bbox is None:
            out[name] = {"file": key, "rect": None, "issues": ["empty_source"],
                         "ok": False, "purpose": why, "anchor": anchor,
                         "source_size": list(im.size), "size": [0, 0], "bbox": []}
            continue
        # SPRITES rectangles are (x, y, w, h); PIL wants (x0, y0, x1, y1)
        crop = im.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3])) \
            if rect else im.crop(bbox)
        issues = []
        if rect is not None and key in SHEET_FILES:
            comps = _components(im.split()[-1], 40)
            if tuple(rect) not in {tuple(c[:4]) for c in comps}:
                issues.append("not_an_exact_component")
        elif rect is not None:
            x, y, w, h = rect
            # a whole sprite must sit inside the PNG and must not be clipped:
            # the crop rectangle has to contain the component's own bbox.
            if bbox and (x > bbox[0] or y > bbox[1]
                         or x + w < bbox[2] or y + h < bbox[3]):
                issues.append("clips_or_swallows") if (x < bbox[0] or y < bbox[1]) \
                    else issues.append("includes_neighbour_bbox")
        a = crop.split()[-1]
        lo, hi = a.getextrema()
        if hi == 0:
            issues.append("empty")
        # alpha touching both axes means the rectangle cut through art
        px = a.load()
        w, h = crop.size
        edges = 0
        for x in range(w):
            if px[x, 0] > 0 or px[x, h - 1] > 0:
                edges += 1
                break
        for y in range(h):
            if px[0, y] > 0 or px[w - 1, y] > 0:
                edges += 1
                break
        # only a *sub*-rectangle of a larger sprite can cut art; a rectangle that is
        # exactly a component's bounding box touches both axes by definition.
        if rect is not None and edges >= 2 and key not in SHEET_FILES:
            issues.append("alpha_on_two_axes")
        out[name] = {"file": key, "rect": list(rect) if rect else None,
                     "source_size": list(im.size), "bbox": list(crop.getbbox() or ()),
                     "size": list(crop.size), "anchor": anchor, "purpose": why,
                     "issues": issues, "ok": not issues}
    return out


def load_images():
    imgs = {}
    for key in FILES:
        imgs[key] = Image.open(path_of(key)).convert("RGBA")
    return imgs


def _components(alpha, minpx):
    import collections
    import numpy as np
    al = np.array(alpha) > 0
    H, W = al.shape
    seen = np.zeros_like(al)
    out = []
    for y in range(H):
        for x in range(W):
            if al[y, x] and not seen[y, x]:
                q = collections.deque([(x, y)])
                seen[y, x] = True
                mnx = mxx = x
                mny = mxy = y
                n = 0
                while q:
                    cx, cy = q.popleft()
                    n += 1
                    mnx = min(mnx, cx); mxx = max(mxx, cx)
                    mny = min(mny, cy); mxy = max(mxy, cy)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < W and 0 <= ny < H and al[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                q.append((nx, ny))
                if n >= minpx:
                    out.append((mnx, mny, mxx - mnx + 1, mxy - mny + 1, n))
    out.sort(key=lambda c: (c[1], c[0]))
    return out


def resolve_materials(imgs):
    """Pick opaque, uniform 16x16 material samples and prove they tile.

    A sample is accepted only if it is 100% opaque and, for the pavement, has a
    low green fraction (it must be stone, not verge). Every candidate is
    recorded so the inspection sheet can show the chosen rectangle in context.
    """
    import numpy as np
    materials = {"grass": [], "pave": []}
    pave_seen = set()

    g = imgs["ground"]
    comps = _components(g.split()[-1], 900)
    seen = set()
    for (x, y, w, h, n) in comps:
        if w < 40 or h < 40:
            continue
        ins = 10
        for sx, sy in ((x + ins, y + ins), (x + w - 16 - ins, y + ins),
                       (x + ins, y + h - 16 - ins), (x + w - 16 - ins, y + h - 16 - ins)):
            tile = g.crop((sx, sy, sx + 16, sy + 16))
            if tile.split()[-1].getextrema()[0] < 255:
                continue
            px = list(tile.convert("RGB").getdata())
            r_ = sum(q[0] for q in px) / len(px)
            g_ = sum(q[1] for q in px) / len(px)
            b_ = sum(q[2] for q in px) / len(px)
            # moor material only: a grass-green sample, never the pack's water blobs
            if not (g_ > r_ + 6 and g_ > b_ + 30):
                continue
            key = tile.tobytes()
            if key in seen:
                continue
            seen.add(key)
            materials["grass"].append({"file": "ground", "rect": [sx, sy, 16, 16],
                                       "from_component": [x, y, w, h]})
    for name in ("road1", "road3"):
        im = imgs[name]
        arr = np.array(im)
        a = arr[:, :, 3]
        for yy in range(0, im.height - 16, 2):
            for xx in range(0, im.width - 16, 2):
                if a[yy:yy + 16, xx:xx + 16].min() < 255:
                    continue
                win = arr[yy:yy + 16, xx:xx + 16, :3]
                tile = Image.fromarray(win)
                if tile.tobytes() in pave_seen:
                    continue
                w = win.astype(int)
                r, gg, b = w[:, :, 0], w[:, :, 1], w[:, :, 2]
                green = float(((gg > r + 10) & (gg > b + 25)).mean())
                blue = float((b > r + 6).mean())
                spread = float((w.max(axis=2) - w.min(axis=2)).mean())
                if green < 0.02 and blue > 0.35 and spread < 90:
                    pave_seen.add(tile.tobytes())
                    materials["pave"].append({"file": name, "rect": [xx, yy, 16, 16],
                                              "blue_ratio": round(blue, 3),
                                              "spread": round(spread, 1)})
                    if len(materials["pave"]) >= 6:
                        break
            if len(materials["pave"]) >= 6:
                break
    # traversed track: the pack's own earth roads, warm (r > b), opaque, no verge
    track_seen = set()
    materials["track"] = []
    for name in ("road2", "road4", "road5"):
        im = imgs[name]
        arr = np.array(im)
        a = arr[:, :, 3]
        for yy in range(0, im.height - 16, 2):
            for xx in range(0, im.width - 16, 2):
                if a[yy:yy + 16, xx:xx + 16].min() < 255:
                    continue
                win = arr[yy:yy + 16, xx:xx + 16, :3]
                tile = Image.fromarray(win)
                if tile.tobytes() in track_seen:
                    continue
                w = win.astype(int)
                r, gg, b = w[:, :, 0], w[:, :, 1], w[:, :, 2]
                green = float(((gg > r + 10) & (gg > b + 25)).mean())
                warm = float((r > b + 20).mean())
                if green < 0.02 and warm > 0.75:
                    track_seen.add(tile.tobytes())
                    materials["track"].append({"file": name, "rect": [xx, yy, 16, 16]})
                    break
            if len(materials["track"]) >= 3:
                break
    if not materials["pave"]:
        raise SystemExit("no stone pavement sample found")
    return materials
