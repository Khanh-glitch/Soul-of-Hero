#!/usr/bin/env python3
"""Author the eight regional scene studies from canonical geography.

This is tracked art direction, not a screenshot paint-over. It rewrites the
region-window entries in biome_studies.v1.json with:
  - narrow maintained pier/causeway spines snapped to source road cells,
  - causal ecological detail clusters (transparent decals),
  - hand-placed foreground/midground/background prop clusters,
  - night capture views that keep destination + hazard cues in frame.
It never changes world_plan/chunks/walk/stands/rewards/POI ids.
"""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from compile_world_art import Layers, load_plan, ROOT, ART, in_shape

MATFRAME = {
    "silica_sand": "silica_placer", "storm_glass": "storm_glass", "timber": "hardwood_log",
    "sulfur": "sulfur_vent", "copper": "copper_vein", "obsidian": "obsidian_shard",
    "salt": "salt_crust_prop", "fibre": "reed_bundle", "hardwood": "hardwood_log",
    "venom_sac": "venom_sac", "rubber_sap": "rubber_tap", "pearl": "pearl_bed",
    "abyssal_pearl": "abyssal_pearl", "reed_fibre": "reed_bundle", "clay": "clay_lens",
    "limestone": "limestone_chunk", "rare_herb": "karst_herb", "peat": "peat_cut",
    "bog_iron": "bog_iron", "basalt": "basalt_chunk",
}
LM = {
    "mirrormere": "lm_mere_causeway", "glasswind_coast": "lm_glasswind_light",
    "ember_steppe": "lm_ember_forge", "saffron_coast": "lm_saffron_salt_works",
    "verdant_fold": "lm_verdant_temple", "pearl_mangroves": "lm_pearl_customs",
    "sunken_orchard": "lm_sunken_cenote", "ashwater_fen": "lm_ashwater_pump",
}
WATER = {"water", "bridge"}
TALL = {"mangrove_tree", "canopy_tree", "karst_boulder", "root_arch", "palm", "jungle_canopy",
        "karst_pinnacle", "tree_orchard", "tree_frost_small", "keeper_shed", "vent_stack",
        "pump_tank", "forge_slag_heap", "cooling_trough", "orchard_wall", "shade_sail"}
AQUATIC = {"reed_bed", "reed_clump", "fish_trap", "dock_small", "ferry_boat", "tidal_wrack", "shell_bar"}


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def write(p: Path, d: dict) -> None:
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def nearest_road(c, road, radius=5):
    c = tuple(c)
    if c in road:
        return c
    best = None
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            q = (c[0] + dx, c[1] + dy)
            if q in road:
                d = abs(dx) + abs(dy)
                if best is None or d < best[0]:
                    best = (d, q)
    if best is None:
        raise ValueError(f"no source road near {c}")
    return best[1]


def bfs(road, a, b):
    a = nearest_road(a, road); b = nearest_road(b, road)
    q = deque([a]); prev = {a: None}
    while q:
        c = q.popleft()
        if c == b:
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if n in road and n not in prev:
                prev[n] = c; q.append(n)
    if b not in prev:
        raise ValueError(f"source road disconnected {a}->{b}")
    path = []
    while b is not None:
        path.append(b); b = prev[b]
    return list(reversed(path))


def compress(path):
    if len(path) < 3:
        return [list(p) for p in path]
    out = [path[0]]
    for i in range(1, len(path) - 1):
        a, b, c = path[i - 1], path[i], path[i + 1]
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
            out.append(b)
    out.append(path[-1])
    return [list(p) for p in out]


def ellipse(cx, cy, rx, ry):
    return {"type": "ellipse", "center": [cx, cy], "radii": [rx, ry]}


def polygon(points):
    return {"type": "polygon", "points": points}


def detail(id, kind, shape, materials, density=0.18, seed=101, reason=""):
    return {"id": id, "kind": kind, "shape": shape, "materials": materials,
            "density": density, "seed": seed, "reason": reason or kind}


class Scene:
    def __init__(self, study, layers, plan):
        self.study = study
        self.layers = layers
        self.plan = plan
        self.key = study["study_id"].replace("_region_window", "")
        self.region = study["region_id"]
        self.window = study["window"]
        self.ox, self.oy = self.window["origin_cell"]
        self.w, self.h = self.window["size_cells"]
        self.road = set()
        for y in range(self.oy, self.oy + self.h):
            for x in range(self.ox, self.ox + self.w):
                if layers.value([x, y], "road"):
                    self.road.add((x, y))
        self.props = []
        self.used = set()
        self.pois = {p["poi_id"]: p for p in plan["pois"] if p["region_id"] == self.region}
        self.nodes = [n for n in plan["resource_nodes"] if n["region_id"] == self.region]

    def inwin(self, c):
        return self.ox <= c[0] < self.ox + self.w and self.oy <= c[1] < self.oy + self.h

    def surface(self, c):
        return self.layers.surface_name(list(c))

    def add(self, frame, cell, role="background_scenery", light=None, allow_water=False, allow_road=False, poi_id=None, node_id=None, site_id=None):
        c = tuple(cell)
        if not self.inwin(c) or c in self.used:
            return False
        s = self.surface(c)
        if s in WATER and not allow_water and frame not in AQUATIC:
            return False
        if c in self.road and not allow_road and frame not in {"lantern_post", "pier_rail"} and role != "return_route":
            return False
        # Keep canonical POI cells reserved for their landmark.
        if any(p["cell"] == list(c) for p in self.pois.values()) and not poi_id:
            return False
        p = {"frame": frame, "cell": list(c), "role": role}
        if light: p["light"] = light
        if poi_id: p["poi_id"] = poi_id
        if node_id: p["node_id"] = node_id
        if site_id: p["site_id"] = site_id
        self.props.append(p); self.used.add(c)
        return True

    def cluster(self, frame, centers, offsets, role="background_scenery", **kw):
        for cx, cy in centers:
            for dx, dy in offsets:
                self.add(frame, (cx + dx, cy + dy), role, **kw)

    def landmark(self):
        anchor = self.study["canonical_anchors"]["poi_id"]
        p = self.pois[anchor]
        self.add(LM[self.key], p["cell"], "authored_landmark", light="warm", allow_road=True, poi_id=anchor)
        if self.key == "mirrormere":
            q = self.pois["poi_mirrormere_ferry"]
            self.add("lm_mere_boathouse", q["cell"], "authored_landmark", light="warm", allow_road=True, poi_id="poi_mirrormere_ferry")

    def resources(self):
        sites = sorted({n["site_id"] for n in self.nodes})
        for site in sites:
            cnt = 0
            for n in self.nodes:
                if n["site_id"] != site or not self.inwin(n["cell"]) or cnt >= 3:
                    continue
                frame = MATFRAME.get(n["material_key"])
                if frame and self.add(frame, n["cell"], "ordinary_harvestable", node_id=n["node_id"], site_id=site):
                    cnt += 1

    def spine(self, id, points, reason):
        cells = []
        pts = [nearest_road(p, self.road) for p in points]
        for a, b in zip(pts, pts[1:]):
            seg = bfs(self.road, a, b)
            if cells and seg[0] == cells[-1]:
                seg = seg[1:]
            cells.extend(seg)
        return {"id": id, "points": compress(cells), "reason": reason}

    def lanterns(self, spine, every=7):
        cells = []
        for a, b in zip(spine["points"], spine["points"][1:]):
            # sample along compressed orthogonal segment
            x, y = a; x2, y2 = b
            dx = (x2 > x) - (x2 < x); dy = (y2 > y) - (y2 < y)
            while True:
                cells.append((x, y))
                if (x, y) == (x2, y2): break
                x += dx; y += dy
        for i, c in enumerate(cells):
            if i % every == 3:
                # place beside path, not on the walking cell
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if self.add("lantern_post", (c[0] + dx, c[1] + dy), "return_route", light="warm", allow_road=False):
                        break

    def scatter_material(self, frame, shape, materials, count, role="background_scenery", seed=900, **kw):
        from compile_world_art import h01
        cells = []
        for y in range(self.oy, self.oy + self.h):
            for x in range(self.ox, self.ox + self.w):
                c = (x, y)
                if not in_shape(c, shape):
                    continue
                # material from source legend/biome is approximated by surface here;
                # compiler still validates final placement. Use surface families.
                s = self.surface(c)
                if s in WATER and frame not in AQUATIC:
                    continue
                if c in self.road and frame in TALL:
                    continue
                cells.append((h01(x, y, seed), c))
        cells.sort()
        placed = 0
        for _, c in cells:
            if placed >= count:
                break
            if self.add(frame, c, role, **kw):
                placed += 1

    def finish(self, rules, views):
        self.study["ground_rules"].update(rules)
        self.study["add_props"] = self.props
        ox, oy = self.ox, self.oy
        for v in views:
            cx, cy = v["center_cell"]
            v["center_cell"] = [max(ox + 20, min(cx, ox + self.w - 20)), max(oy + 12, min(cy, oy + self.h - 12))]
        self.study["capture_views"] = views
        return self.study


OFF5 = [(0, 0), (2, 1), (-2, 2), (1, -2), (-1, -1)]
OFF8 = [(0, 0), (3, 1), (-3, 2), (1, -3), (-2, -2), (4, -1), (-4, 3), (2, 4)]
OFF12 = [(0, 0), (3, 1), (-3, 2), (1, -3), (-2, -2), (4, -1), (-4, 3), (2, 4), (-5, -1), (5, 2), (-1, 5), (0, -5)]


def design_mirrormere(s):
    s.landmark(); s.resources()
    main = s.spine("mere_causeway_spine", [[360, 485], [360, 500], [360, 507]], "Maintained stone causeway to the drowned causeway POI.")
    ferry = s.spine("mere_ferry_spine", [[390, 469], [396, 474], [400, 480]], "Ferry approach from the north road to Mirror Ferry.")
    s.lanterns(main, 8); s.lanterns(ferry, 6)
    s.cluster("reed_bed", [(356, 494), (368, 502), (392, 478), (404, 482)], OFF8, allow_water=True)
    s.cluster("reed_clump", [(354, 498), (370, 496), (396, 476), (402, 484)], OFF5, allow_water=True)
    s.cluster("dock_small", [(362, 498), (398, 482)], [(0, 0), (3, 1)], "return_route", allow_water=True)
    s.cluster("ferry_boat", [(400, 482)], [(2, 1)], "return_route", allow_water=True)
    s.cluster("fish_trap", [(364, 502), (396, 484)], OFF5, allow_water=True)
    s.cluster("fen_snag", [(358, 490), (372, 504), (394, 474)], OFF5)
    s.cluster("net_rack", [(398, 478)], [(1, 0), (3, 1)], "return_route")
    s.cluster("mooring_post", [(362, 500), (400, 480)], OFF5, "return_route", allow_water=True)
    s.cluster("sluice_gate", [(360, 504)], [(0, 0), (2, 0)], "background_scenery")
    s.cluster("bleached_reeds", [(368, 500)], OFF5, "physical_danger", allow_water=True)
    rules = {
        "road_style": "causeway", "water_material": "lake", "preserve_source_water": True,
        "pier_spines": [main, ferry],
        "detail_clusters": [
            detail("mere_reed_shelf_detail", "reed_tuft", ellipse(362, 498, 12, 8), ["reedpeat", "silt"], 0.28, 11),
            detail("mere_ferry_shallows", "reed_tuft", ellipse(398, 480, 8, 6), ["reedpeat", "silt"], 0.24, 12),
            detail("mere_open_water", "water_ripple", ellipse(376, 488, 26, 18), ["lake"], 0.10, 13),
            detail("mere_peat_cuts", "peat_cut", ellipse(368, 504, 10, 6), ["reedpeat", "fen"], 0.16, 14),
        ],
    }
    views = [{"id": "mere_causeway_day", "center_cell": [362, 496], "time_of_day": 0.3},
             {"id": "mere_ferry_night", "center_cell": [398, 480], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_pearl(s):
    s.landmark(); s.resources()
    main = s.spine("pearl_customs_pier", [[820, 589], [830, 594], [840, 600], [848, 606], [856, 612]], "Narrow stilt pier follows the tidal channel to Customs.")
    branch = s.spine("pearl_tide_gauge_branch", [[840, 600], [836, 596], [832, 596]], "Short inspection spur to the tide gauge.")
    s.lanterns(main, 8); s.lanterns(branch, 5)
    s.cluster("mangrove_tree", [(808, 588), (852, 612), (816, 624), (860, 592), (824, 572)], OFF8)
    s.cluster("mangrove_root", [(812, 592), (848, 608), (820, 620), (856, 596)], OFF8)
    s.cluster("reed_bed", [(828, 568), (844, 632), (806, 604)], OFF8, allow_water=True)
    s.cluster("dock_small", [(842, 602), (830, 596)], [(0, 0), (3, 0)], "return_route", allow_water=True)
    s.cluster("ferry_boat", [(844, 604)], [(2, 1)], "return_route", allow_water=True)
    s.cluster("tide_gauge_large", [(832, 596)], [(0, 0), (2, 1)], "physical_danger", allow_water=True)
    s.cluster("warning_stakes", [(824, 616), (852, 604)], OFF5, "physical_danger")
    s.cluster("tidal_wrack", [(824, 616), (840, 624), (856, 600)], OFF8, allow_water=True)
    s.cluster("pearl_bed", [(816, 624)], OFF5, "background_scenery", allow_water=True)
    s.cluster("pier_rail", [(834, 596), (846, 604)], OFF5, "return_route", allow_road=True)
    rules = {
        "road_style": "boardwalk", "water_material": "tidal", "preserve_source_water": True,
        "biome_materials": {"mangrove": "mangrove", "tidal_flat": "mud", "ocean": "mud", "riverine": "mud", "freshwater_marsh": "reedpeat"},
        "pier_spines": [main, branch],
        "detail_clusters": [
            detail("pearl_channel_ripples", "water_ripple", polygon([[820, 580], [850, 590], [840, 620], [810, 610]]), ["tidal", "lake"], 0.16, 21),
            detail("pearl_mud_cracks", "mud_crack", ellipse(828, 612, 18, 14), ["mud"], 0.20, 22),
            detail("pearl_shell_bar", "shell_hash", ellipse(816, 624, 12, 8), ["shell", "mud"], 0.22, 23),
            detail("pearl_root_peat", "reed_tuft", ellipse(840, 588, 16, 10), ["mangrove", "reedpeat"], 0.18, 24),
        ],
    }
    views = [{"id": "pearl_customs_day", "center_cell": [840, 600], "time_of_day": 0.35},
             {"id": "pearl_tide_night", "center_cell": [836, 604], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_ashwater(s):
    s.landmark(); s.resources()
    main = s.spine("ashwater_pump_spine", [[340, 613], [340, 620], [344, 624], [350, 628], [356, 636], [362, 644], [368, 652]], "Pump inspection pier follows the peat ridge, not the whole bog.")
    west = s.spine("ashwater_west_spur", [[340, 624], [330, 626], [320, 628]], "West retreat spur toward the fen edge.")
    toxic = s.spine("ashwater_toxic_lookout", [[356, 636], [360, 640], [364, 644]], "Short marked lookout over the toxic pool; not a harvest shortcut.")
    s.lanterns(main, 6); s.lanterns(west, 6); s.lanterns(toxic, 4)
    s.cluster("pump_tank", [(344, 618)], [(0, 0), (3, 1)], "background_scenery")
    s.cluster("pipe_run", [(348, 612), (336, 624), (352, 632)], OFF5, "background_scenery")
    s.cluster("vent_stack", [(356, 640), (344, 652)], OFF5, "physical_danger")
    s.cluster("warning_stakes", [(352, 636), (368, 644), (336, 628)], OFF5, "physical_danger")
    s.cluster("reed_bed", [(352, 600), (372, 624), (312, 640), (388, 648)], OFF8, allow_water=True)
    s.cluster("reed_clump", [(360, 608), (380, 632), (328, 652)], OFF8, allow_water=True)
    s.cluster("fen_snag", [(316, 608), (384, 616), (332, 664), (392, 668)], OFF8)
    s.cluster("bleached_reeds", [(356, 648), (340, 636), (368, 640)], OFF8, "physical_danger", allow_water=True)
    s.cluster("toxic_pool_edge", [(368, 644)], OFF5, "physical_danger", allow_water=True)
    s.cluster("bog_pool", [(372, 652)], OFF5, "background_scenery", allow_water=True)
    s.cluster("peat_cut", [(360, 660)], OFF5, "background_scenery")
    s.cluster("pier_rail", [(344, 624), (356, 636)], OFF5, "return_route", allow_road=True)
    rules = {
        "road_style": "boardwalk", "water_material": "tidal", "preserve_source_water": True,
        "pier_spines": [main, west, toxic],
        "detail_clusters": [
            detail("ashwater_peat_cuts", "peat_cut", ellipse(360, 660, 16, 10), ["fen"], 0.22, 31),
            detail("ashwater_toxic_film", "toxic_film", ellipse(360, 640, 18, 12), ["toxic"], 0.26, 32),
            detail("ashwater_reed_margin", "reed_tuft", ellipse(352, 620, 20, 14), ["reedpeat", "fen"], 0.18, 33),
            detail("ashwater_silt_cracks", "mud_crack", ellipse(336, 628, 14, 10), ["silt", "mud"], 0.16, 34),
        ],
    }
    views = [{"id": "ashwater_pump_day", "center_cell": [340, 624], "time_of_day": 0.35},
             {"id": "ashwater_miasma_night", "center_cell": [348, 628], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_ember(s):
    s.landmark(); s.resources()
    main = s.spine("ember_forge_approach", [[570, 320], [580, 320], [590, 320], [600, 318]], "Forge approach along the cooled flow margin.")
    south = s.spine("ember_gas_route", [[580, 320], [580, 330], [584, 340], [590, 350], [596, 360], [602, 370], [608, 376]], "Lee route past fumaroles toward the convict mine.")
    s.lanterns(main, 6); s.lanterns(south, 8)
    s.cluster("forge_slag_heap", [(576, 324), (588, 324), (584, 316)], OFF5)
    s.cluster("pipe_run", [(584, 322), (576, 318), (592, 328)], OFF5)
    s.cluster("vent_stack", [(600, 368), (616, 388), (596, 344)], OFF5, "physical_danger")
    s.cluster("cooling_trough", [(588, 318)], [(0, 0), (3, 0)], "background_scenery")
    s.cluster("cinder_cone", [(628, 308), (652, 368), (572, 372)], OFF8)
    s.cluster("tree_dead", [(566, 316), (600, 308), (648, 312), (572, 372)], OFF8)
    s.cluster("sulfur_vent", [(600, 368), (616, 388)], OFF5, "background_scenery")
    s.cluster("sulfur_crust", [(616, 388), (596, 344)], OFF5, "physical_danger")
    s.cluster("gas_vent", [(600, 368), (596, 344)], OFF5, "physical_danger")
    s.cluster("warning_stakes", [(592, 336), (604, 360)], OFF5, "physical_danger")
    s.cluster("gas_vent", [(590, 330), (596, 332)], OFF5, "physical_danger")
    s.cluster("sulfur_crust", [(592, 332)], OFF5, "physical_danger")
    rules = {
        "road_style": "dirt", "water_material": "lake", "preserve_source_water": True,
        "pier_spines": [main, south],
        "detail_clusters": [
            detail("ember_scoria", "cinder_scoria", ellipse(590, 340, 26, 20), ["cinder", "lava"], 0.20, 41),
            detail("ember_forge_slag", "forge_slag", ellipse(582, 322, 10, 8), ["cinder", "soil"], 0.24, 42),
            detail("ember_lava_crust", "cinder_scoria", polygon([[600, 340], [640, 330], [660, 360], [620, 380]]), ["lava"], 0.18, 43),
        ],
    }
    views = [{"id": "ember_forge_day", "center_cell": [582, 324], "time_of_day": 0.35},
             {"id": "ember_gas_night", "center_cell": [582, 328], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_verdant(s):
    s.landmark(); s.resources()
    main = s.spine("verdant_temple_terrace", [[602, 580], [610, 584], [620, 590], [630, 596], [640, 600], [646, 606], [650, 612]], "Temple terrace approach through the canopy.")
    south = s.spine("verdant_spore_lane", [[640, 600], [646, 606], [650, 612], [654, 618]], "Marked descent toward the spore hollow; filter lane.")
    s.lanterns(main, 6); s.lanterns(south, 7)
    s.cluster("canopy_tree", [(592, 568), (612, 588), (652, 568), (600, 616), (648, 624), (660, 600)], OFF12)
    s.cluster("jungle_canopy", [(600, 568), (656, 588), (620, 608)], OFF8)
    s.cluster("understory_fern", [(608, 592), (636, 608), (652, 616), (616, 632)], OFF12)
    s.cluster("root_arch", [(628, 596), (644, 612)], OFF5)
    s.cluster("liana_curtain", [(620, 580), (636, 616), (652, 592)], OFF8)
    s.cluster("karst_boulder", [(660, 588), (588, 632), (640, 584)], OFF8)
    s.cluster("karst_pinnacle", [(660, 572), (600, 640)], OFF5)
    s.cluster("spore_mushroom", [(616, 636), (626, 646), (612, 644)], OFF8, "physical_danger")
    s.cluster("spore_cluster", [(616, 636), (626, 646)], OFF5, "physical_danger")
    s.cluster("warning_stakes", [(624, 628), (632, 620)], OFF5, "physical_danger")
    s.cluster("spore_mushroom", [(628, 616), (636, 612)], OFF5, "physical_danger")
    s.cluster("stilt_walk", [(636, 608)], [(0, 0), (2, 0)], "return_route", allow_road=True)
    rules = {
        "road_style": "stone", "water_material": "river", "preserve_source_water": True,
        "pier_spines": [main, south],
        "detail_clusters": [
            detail("verdant_litter", "jungle_litter", ellipse(620, 600, 26, 22), ["jungle"], 0.24, 51),
            detail("verdant_karst_fissures", "karst_fissure", ellipse(640, 584, 20, 14), ["karst"], 0.20, 52),
            detail("verdant_spore_hollow", "toxic_film", ellipse(620, 640, 14, 10), ["toxic"], 0.22, 53),
            detail("verdant_terrace_grass", "orchard_grass", ellipse(646, 608, 12, 8), ["soil", "jungle"], 0.18, 54),
        ],
    }
    views = [{"id": "verdant_temple_day", "center_cell": [640, 600], "time_of_day": 0.35},
             {"id": "verdant_spore_night", "center_cell": [636, 608], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_glasswind(s):
    s.landmark(); s.resources()
    main = s.spine("glass_light_approach", [[904, 116], [914, 117], [924, 119], [930, 120], [936, 120]], "Sheltered dune approach to the signal light.")
    s.lanterns(main, 6)
    s.cluster("keeper_shed", [(926, 116)], [(0, 0), (4, 1)], "background_scenery")
    s.cluster("driftwood_pile", [(928, 92), (938, 78), (912, 108)], OFF8)
    s.cluster("driftwood", [(926, 96), (934, 84)], OFF5)
    s.cluster("storm_glass_cluster", [(906, 92), (918, 100)], OFF8)
    s.cluster("shell_bar", [(934, 84), (908, 96)], OFF8)
    s.cluster("salt_windbreak", [(912, 112), (896, 104)], OFF5)
    s.cluster("tree_frost_small", [(890, 76), (902, 100), (914, 70)], OFF8)
    s.cluster("understory_fern", [(896, 96), (908, 108)], OFF8)
    s.cluster("karst_boulder", [(936, 108), (920, 124)], OFF5)
    s.cluster("warning_stakes", [(916, 114)], OFF5, "physical_danger")
    rules = {
        "road_style": "stone", "water_material": "lake", "preserve_source_water": True,
        "pier_spines": [main],
        "detail_clusters": [
            detail("glass_shell_bench", "shell_hash", ellipse(906, 92, 16, 12), ["shell"], 0.24, 61),
            detail("glass_dune_ridges", "dune_ripple", ellipse(894, 108, 12, 8), ["dune"], 0.22, 62),
            detail("glass_strand", "water_ripple", ellipse(930, 84, 18, 10), ["lake", "river"], 0.12, 63),
        ],
    }
    views = [{"id": "glass_light_day", "center_cell": [924, 112], "time_of_day": 0.3},
             {"id": "glass_storm_night", "center_cell": [924, 112], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_saffron(s):
    s.landmark(); s.resources()
    main = s.spine("saffron_pan_walk", [[880, 360], [882, 364], [884, 368], [886, 372]], "Raised salt-pan walk to the works; brine stays non-walkable.")
    s.lanterns(main, 5)
    # Worked salt crust, shade and rakes belong on the dry crust margins, not on
    # the impassable brine. Scatter deterministically inside authored pan shapes.
    s.scatter_material("salt_heap", ellipse(880, 356, 18, 12), ["salt", "dune"], 14, seed=701)
    s.scatter_material("salt_rake", ellipse(880, 352, 20, 14), ["salt", "dune"], 10, seed=702)
    s.scatter_material("shade_sail", ellipse(874, 362, 12, 8), ["salt", "dune"], 6, seed=703)
    s.scatter_material("palm", ellipse(862, 338, 14, 10), ["dune", "sand"], 8, seed=704)
    s.scatter_material("salt_windbreak", ellipse(892, 352, 12, 10), ["salt", "dune"], 8, seed=705)
    s.cluster("awning", [(872, 368)], [(0, 0), (3, 0)], "background_scenery")
    s.cluster("heat_shimmer", [(884, 332), (872, 344)], OFF5, "physical_danger")
    s.cluster("warning_stakes", [(884, 356)], OFF5, "physical_danger")
    rules = {
        "road_style": "causeway", "water_material": "brine", "preserve_source_water": True,
        "pier_spines": [main],
        "detail_clusters": [
            detail("saffron_salt_crust", "salt_crust", ellipse(880, 352, 22, 16), ["salt", "brine"], 0.30, 71),
            detail("saffron_dune_margin", "dune_ripple", ellipse(862, 336, 12, 8), ["dune"], 0.22, 72),
            detail("saffron_brine", "water_ripple", ellipse(880, 360, 18, 12), ["brine"], 0.10, 73),
        ],
    }
    views = [{"id": "saffron_pan_day", "center_cell": [880, 358], "time_of_day": 0.3},
             {"id": "saffron_shade_night", "center_cell": [880, 360], "time_of_day": 0.85}]
    return s.finish(rules, views)


def design_sunken(s):
    s.landmark(); s.resources()
    main = s.spine("sunken_cenote_terrace", [[100, 640], [110, 640], [120, 640], [130, 641], [140, 642]], "Orchard terrace route to the cenote rim.")
    orchard = s.spine("sunken_orchard_row", [[140, 644], [148, 644], [154, 644]], "Ruined orchard row above the sinkhole.")
    s.lanterns(main, 6); s.lanterns(orchard, 6)
    s.cluster("cenote_steps", [(120, 644)], [(0, 0), (3, 0)], "return_route")
    s.cluster("cenote_rim", [(112, 648), (128, 636)], OFF5, "physical_danger")
    s.cluster("karst_pinnacle", [(100, 616), (140, 656), (96, 640), (148, 608)], OFF8)
    s.cluster("karst_boulder", [(108, 632), (132, 648), (156, 628)], OFF8)
    s.cluster("tree_orchard", [(152, 620), (156, 632), (144, 616), (160, 624)], OFF8)
    s.cluster("orchard_wall", [(148, 628), (156, 620)], OFF5)
    s.cluster("jungle_canopy", [(84, 612), (104, 660), (160, 660)], OFF8)
    s.cluster("canopy_tree", [(88, 652), (164, 640)], OFF8)
    s.cluster("understory_fern", [(116, 648), (136, 632), (152, 636)], OFF8)
    s.cluster("cenote_pool", [(112, 648)], OFF5, "background_scenery", allow_water=True)
    s.cluster("warning_stakes", [(116, 644), (128, 640)], OFF5, "physical_danger")
    rules = {
        "road_style": "stone", "water_material": "cenote", "preserve_source_water": True,
        "pier_spines": [main, orchard],
        "detail_clusters": [
            detail("sunken_karst_fissures", "karst_fissure", ellipse(120, 640, 26, 18), ["karst"], 0.20, 81),
            detail("sunken_orchard_floor", "orchard_grass", ellipse(150, 624, 16, 10), ["soil", "jungle"], 0.22, 82),
            detail("sunken_cenote_water", "water_ripple", ellipse(120, 640, 14, 10), ["cenote"], 0.16, 83),
        ],
    }
    views = [{"id": "sunken_cenote_day", "center_cell": [120, 640], "time_of_day": 0.3},
             {"id": "sunken_terrace_night", "center_cell": [132, 636], "time_of_day": 0.85}]
    return s.finish(rules, views)


DESIGN = {
    "mirrormere_region_window": design_mirrormere,
    "pearl_mangroves_region_window": design_pearl,
    "ashwater_fen_region_window": design_ashwater,
    "ember_steppe_region_window": design_ember,
    "verdant_fold_region_window": design_verdant,
    "glasswind_coast_region_window": design_glasswind,
    "saffron_coast_region_window": design_saffron,
    "sunken_orchard_region_window": design_sunken,
}


def main() -> dict:
    plan = load_plan()
    layers = Layers(plan)
    studies = load(ART / "biome_studies.v1.json")
    out = []
    counts = {}
    for st in studies["studies"]:
        fn = DESIGN.get(st["study_id"])
        if fn:
            st = fn(Scene(st, layers, plan))
            counts[st["study_id"]] = len(st["add_props"])
        out.append(st)
    studies["studies"] = out
    studies["authority"] = "A1_VISUAL_ONLY_CANONICAL_ANCHORS_NO_REWARD_AUTHORITY"
    studies["scene_design"] = {
        "source": "tools/survival/worldgen/author_region_scenes.py",
        "rules": ["narrow maintained spines on source roads", "transparent wear off-spine", "water/brine preserved", "authored detail clusters", "night destination/hazard framing"],
        "prop_counts": counts,
    }
    write(ART / "biome_studies.v1.json", studies)
    return {"ok": True, "studies": len(out), "region_props": counts}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
