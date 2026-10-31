#!/usr/bin/env python3
"""Author the pilot's placement layers from the pinned cells, deterministically.

This is the only script that decides *what goes where*. It is a rule engine, not
a random scatter: every rule names the terrain it is conditioned on, so a prop
can only appear where the authored terrain justifies it. That is the direct
answer to the shipped frames' problem, where 190 cliff decals were scattered over
moor, road and fen and none of them stood on cliff ground.

Rules are listed in `placement.v1.json -> rules`, each with the cell count it
produced, so the composition can be audited and edited by hand.

    python3 author_placement.py              # rewrite data/placement.v1.json
    python3 author_placement.py --dry-run    # print the census only
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from pilotworld import Pilot, collider_rect, is_solid_prop, stable

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE = 16

ART_PINS = {
    "overworld_tiles.png": "cef87705e73693feb2af3a60430e4ce94ef6223f51d43d6418ace018c861ed61",
    "overworld_props.png": "6cb975589f869670432608d827ff6c58ccf81ab78e320ead1028a17565687e68",
    "light_radial.png": "8a294ed2bc843bec8372d2eff832bc6ed98d1ac2a8c7b3b0747ed34f731de2ef",
    "knight_idle_sheet.png": "ada93dd7fcfb574a7068d77a1c41413b17ce64d3a92f3c63eec2ab46d64b24c0",
}

MIRRORABLE = {"bush", "rock_a", "rock_b", "rock_d", "rock_e", "rock_f", "fence",
              "camp_crate", "barrel", "camp_bedroll", "disc_cache", "signpost"}
PROPS = json.load(open(os.path.join(ROOT, "data/overworld_props.v1.json")))["frames"]


def frame_h(frame: str) -> int:
    return PROPS[frame]["h"]


class Author:
    def __init__(self):
        self.p = Pilot("corridor")
        self.decals: list[dict] = []
        self.props: list[dict] = []
        self.rules: dict[str, int] = {}
        self.contract = self.p.contract_cells()
        self.claimed: dict[tuple[int, int], str] = {}

    # -- helpers ----------------------------------------------------------
    def count(self, rule: str, n: int = 1) -> None:
        self.rules[rule] = self.rules.get(rule, 0) + n

    def decal(self, frame: str, cell: tuple[int, int], rule: str) -> None:
        self.decals.append({"frame": frame, "cell": [cell[0], cell[1]], "rule": rule})
        self.count(rule)

    def prop(self, frame: str, x: float, y: float, rule: str, cell=None,
             mirror: bool = True) -> None:
        flip = None
        if mirror and frame in MIRRORABLE:
            flip = "h" if stable(frame, round(x), round(y), "flip") % 2 else None
        self.props.append({
            "frame": frame, "x": round(float(x), 2), "y": round(float(y), 2),
            "z": 0, "cell": cell, "rule": rule, "flip": flip,
        })
        self.count(rule)

    def free_foot(self, cell: tuple[int, int], salt: str, spread: float = 5.0) -> tuple[float, float]:
        """Jitter inside the cell so repeated frames do not print a grid."""
        h = stable(cell[0], cell[1], salt)
        dx = ((h & 0xFF) / 255.0 - 0.5) * 2 * spread
        dy = (((h >> 8) & 0xFF) / 255.0 - 0.5) * 2 * (spread * 0.6)
        return (cell[0] * TILE + TILE / 2 + dx, cell[1] * TILE + TILE - 1 + dy)

    def collider_hits_contract(self, frame: str, x: float, y: float) -> bool:
        rect = collider_rect(frame, x, y)
        if rect is None:
            return False
        rx, ry, rw, rh = rect
        for cy in range(int(ry // TILE), int((ry + rh - 0.001) // TILE) + 1):
            for cx in range(int(rx // TILE), int((rx + rw - 0.001) // TILE) + 1):
                if (cx, cy) in self.contract:
                    return True
        return False

    # -- rules ------------------------------------------------------------
    def rule_cliff_face(self) -> None:
        """Real cliff frames go on real cliff cells. Nothing else qualifies."""
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if not p.s(cx, cy).startswith("#"):
                    continue
                # The authored solid layer is the rock: A1 caps every fen cell in
                # this chunk with '#', so gating on the ground token would drop
                # 100% of the cliff. Gate on the solid token instead.
                h = stable(cx, cy, "cliff")
                rim = not p.s(cx, cy - 1).startswith("#")
                fx, fy = self.free_foot((cx, cy), "cliff", 4.0)
                if rim:
                    self.prop(f"cliff_ledge_{'a' if h % 2 else 'b'}", fx, fy, "cliff_rim", [cx, cy])
                if h % 100 < 62:
                    self.prop(f"cliff_patch_{'abcd'[h % 4]}", fx, fy, "cliff_face", [cx, cy])
                if h % 100 < 19:
                    self.prop(f"cliff_crack_{'ab'[(h >> 3) % 2]}", fx, fy, "cliff_crack", [cx, cy])
                # rubble where the rock meets walkable ground, to break the stair-step
                edge = any(not p.s(cx + dx, cy + dy).startswith("#")
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge and h % 100 < 40:
                    self.decal("pebbles", (cx, cy), "cliff_rubble")
                # boulders along the foot read the mass at 1x and break the stair-step
                south_open = not p.s(cx, cy + 1).startswith("#")
                if south_open and h % 100 < 58:
                    bx = cx * TILE + 8 + ((h >> 5) % 9 - 4)
                    by = (cy + 1) * TILE - 1 + ((h >> 9) % 3)
                    self.prop(f"rock_{'abde'[(h >> 2) % 4]}", bx, by, "cliff_foot_boulder", [cx, cy])

    def rule_fen(self) -> None:
        """Standing water and fen plants only on authored bog/mud/shallow."""
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or not p.bog(cx, cy):
                    continue
                h = stable(cx, cy, "fen")
                if p.d(cx, cy) == "." and h % 100 < 16:
                    self.decal(f"pool{h % 5}", (cx, cy), "fen_pool")
                if h % 100 < 30:
                    self.decal("tuft", (cx, cy), "fen_tuft")
                if h % 100 < 7:
                    fx, fy = self.free_foot((cx, cy), "fenbush", 3.0)
                    self.prop("bush", fx, fy, "fen_bush", [cx, cy])
                if h % 100 < 4:
                    fx, fy = self.free_foot((cx, cy), "fenrock", 3.0)
                    self.prop(f"rock_{'af'[h % 2]}", fx, fy, "fen_rock", [cx, cy])

    def rule_verge(self) -> None:
        """Moss, tufts and pebbles hug the road edge instead of salting the road."""
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or p.road(cx, cy):
                    continue
                near_road = any(p.road(cx + dx, cy + dy)
                                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if not near_road:
                    continue
                h = stable(cx, cy, "verge")
                if h % 100 < 78:
                    self.decal("tuft", (cx, cy), "verge_tuft")
                if h % 100 < 30:
                    self.decal("pebbles", (cx, cy), "verge_pebbles")

    def rule_road_margin(self) -> None:
        """Break the stair-stepped road/moor boundary with sub-cell props."""
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or p.road(cx, cy):
                    continue
                near = any(p.road(cx + dx, cy + dy)
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if not near:
                    continue
                h = stable(cx, cy, "margin")
                if h % 100 < 26:
                    fx, fy = self.free_foot((cx, cy), "margin", 11.0)
                    if h % 2:
                        self.prop(f"rock_{'af'[(h >> 3) % 2]}", fx, fy, "margin_rock", [cx, cy])
                    else:
                        self.prop("bush", fx, fy, "margin_bush", [cx, cy])
                if h % 100 < 55:
                    self.decal("pebbles", (cx, cy), "margin_pebbles")

    def rule_water_window(self) -> None:
        """Fen dressing for the pinned marsh window (walkable bog vs deep water)."""
        p = Pilot("water_test")
        self.win2 = p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or p.void(cx, cy):
                    continue
                h = stable(cx, cy, "fenwin")
                if p.bog(cx, cy):
                    if p.d(cx, cy) == "." and h % 100 < 26:
                        self.decal(f"pool{h % 5}", (cx, cy), "wasser_pool")
                    if h % 100 < 42:
                        self.decal("tuft", (cx, cy), "fenwin_tuft")
                    if not p.water(cx, cy) and h % 100 < 9:
                        fx, fy = self.free_foot((cx, cy), "fenwinbush", 6.0)
                        self.prop("bush", fx, fy, "fenwin_bush", [cx, cy])
                    if not p.water(cx, cy) and h % 100 < 6:
                        fx, fy = self.free_foot((cx, cy), "fenwinrock", 6.0)
                        self.prop(f"rock_{'af'[(h >> 4) % 2]}", fx, fy, "fenwin_rock", [cx, cy])
                elif h % 100 < 10:
                    self.decal("pebbles", (cx, cy), "fenwin_pebbles")

    def rule_moor_grove(self) -> None:
        """Bushes cluster in 4x4 stands, never on the carriageway or the contract."""
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or p.void(cx, cy) or p.bog(cx, cy) or p.road(cx, cy):
                    continue
                if (cx, cy) in self.contract:
                    continue
                if 400 <= cx <= 414 and 196 <= cy <= 208:
                    continue
                stand = stable(cx // 4, cy // 4, "stand") % 100
                if stand >= 19:
                    continue
                h = stable(cx, cy, "grove")
                if h % 100 < 46:
                    fx, fy = self.free_foot((cx, cy), "grove", 5.0)
                    self.prop("bush", fx, fy, "moor_bush", [cx, cy])
                elif h % 100 < 70:
                    fx, fy = self.free_foot((cx, cy), "grove-rock", 4.0)
                    self.prop(f"rock_{'ade'[(h >> 4) % 3]}", fx, fy, "moor_rock", [cx, cy])

    def rule_moor_detail(self) -> None:
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or p.void(cx, cy) or p.road(cx, cy):
                    continue
                h = stable(cx, cy, "moor")
                if h % 100 < 6:
                    self.decal("crack", (cx, cy), "moor_crack")
                if h % 100 < 5:
                    self.decal("pebbles", (cx, cy), "moor_pebbles")
                if h % 100 < 14:
                    self.decal("tuft", (cx, cy), "moor_tuft")
                if h % 100 < 8:
                    self.decal("pebbles", (cx, cy), "moor_rubble")

    # -- explicit furniture ----------------------------------------------
    def yard(self) -> None:
        """Waystation furniture, anchored on the contract's own node cells.

        No colliding frame is used here: the yard is one cell wide between the
        road and the route, and A1's blocker box (0.82 * sprite width) would
        cover the route. The garage-height silhouette is carried by the pennant,
        lantern and fire instead of a roof - see docs/world-visual-audition.
        """
        self.prop("camp_banner", 412.5 * TILE, 200.5 * TILE, "ws_pennant", [412, 200])
        self.prop("lamp", 405.5 * TILE, 198.6 * TILE, "ws_lamp", [405, 198])
        self.prop("lamp", 409.5 * TILE, 205.4 * TILE, "ws_lamp", [409, 205])
        self.prop("camp_crate", 408.5 * TILE, 199.0 * TILE, "ws_locker", [408, 198])
        self.prop("barrel", 409.4 * TILE, 199.0 * TILE, "ws_locker", [409, 198])
        self.prop("camp_crate", 406.4 * TILE, 204.0 * TILE, "ws_cache", [406, 203])
        self.prop("disc_cache", 406.6 * TILE, 204.2 * TILE, "ws_cache", [406, 203])
        self.prop("camp_crate", 411.4 * TILE, 203.0 * TILE, "ws_ledger", [411, 202])
        self.prop("camp_bedroll", 411.2 * TILE, 203.4 * TILE, "ws_ledger", [411, 202])
        self.prop("camp_fire", 404.4 * TILE, 205.2 * TILE, "ws_fire", [404, 205])
        self.prop("brazier", 402.2 * TILE, 205.6 * TILE, "ws_brazier", [402, 205])
        self.prop("fence", 410.0 * TILE, 206.4 * TILE, "ws_fence", [410, 206])
        self.prop("fence", 412.2 * TILE, 206.4 * TILE, "ws_fence", [412, 206])
        self.prop("barrel", 413.2 * TILE, 205.0 * TILE, "ws_barrel", [413, 205])
        self.prop("signpost", 403.0 * TILE, 198.4 * TILE, "ws_sign", [403, 198])
        self.decal("ashdrift", (405, 206), "ws_ash")
        self.decal("ashdrift", (404, 207), "ws_ash")
        self.claimed.update({(408, 198): "locker", (409, 198): "locker",
                             (406, 203): "cache", (411, 202): "ledger",
                             (403, 200): "entrance", (408, 200): "anchor"})

    def layby(self) -> None:
        """Roadside supply layby from A1's explore_first station text."""
        self.prop("disc_cache", 399.5 * TILE, 218.6 * TILE, "layby_notes", [399, 218])
        self.prop("camp_crate", 401.3 * TILE, 220.4 * TILE, "layby_scrap", [401, 220])
        self.prop("barrel", 402.1 * TILE, 220.8 * TILE, "layby_scrap", [402, 220])
        self.prop("camp_bedroll", 398.2 * TILE, 219.6 * TILE, "layby_mat", [398, 219])
        self.decal("pebbles", (400, 219), "layby_pebbles")
        self.decal("pebbles", (401, 221), "layby_pebbles")
        self.decal("crack", (399, 221), "layby_crack")
        # deadfall at the margin: the one colliding prop, kept off the contract
        fx, fy = 396.6 * TILE, 222.6 * TILE
        assert not self.collider_hits_contract("tree_dead", fx, fy)
        self.prop("tree_dead", fx, fy, "layby_deadfall", [396, 222])
        self.prop("bush", 397.4 * TILE, 223.4 * TILE, "layby_margin", [397, 223])
        self.prop("rock_b", 395.6 * TILE, 223.8 * TILE, "layby_margin", [395, 223])

    def rule_road_texture(self) -> None:
        """Worn patches on the carriageway; the authored '=' detail stays on top."""
        p = self.p
        for cy in range(p.oy, p.oy + p.h):
            for cx in range(p.ox, p.ox + p.w):
                if p.solid_cell(cx, cy) or not p.road(cx, cy):
                    continue
                h = stable(cx, cy, "road")
                edge = any(not p.road(cx + dx, cy + dy) and not p.solid_cell(cx + dx, cy + dy)
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge and h % 100 < 55:
                    self.decal("tuft", (cx, cy), "road_fringe")
                if h % 100 < 9:
                    self.decal("pebbles", (cx, cy), "road_pebbles")
                if h % 100 < 6:
                    self.decal("crack", (cx, cy), "road_worn")
                if h % 100 < 5:
                    self.decal("ashdrift", (cx, cy), "road_rubble")

    def rule_yard_apron(self) -> None:
        """A trodden, stony apron so the camp reads as a place, not props on grass."""
        for cy in range(197, 208):
            for cx in range(401, 414):
                if self.p.solid_cell(cx, cy):
                    continue
                h = stable(cx, cy, "apron")
                if h % 100 < 52:
                    self.decal("ashdrift", (cx, cy), "yard_apron")
                if h % 100 < 38:
                    self.decal("pebbles", (cx, cy), "yard_apron")
                if h % 100 < 22:
                    self.decal("crack", (cx, cy), "yard_apron")
                if h % 100 < 14:
                    self.decal("crack", (cx, cy), "yard_apron")

    def junction(self) -> None:
        self.prop("signpost", 389.0 * TILE, 197.2 * TILE, "road_sign", [389, 197])
        self.prop("rock_a", 385.6 * TILE, 203.4 * TILE, "road_milestone", [385, 203])
        self.prop("fence", 386.6 * TILE, 196.4 * TILE, "road_fence", [386, 196])
        self.prop("cart", 387.0 * TILE, 194.8 * TILE, "road_cart", [387, 194])

    # -- lights -----------------------------------------------------------
    def lights(self) -> dict:
        lamps = [
            {"x": 405.5 * TILE, "y": 198.0 * TILE, "scale": 0.38, "color": [255, 176, 96], "strength": 0.5},
            {"x": 409.5 * TILE, "y": 204.6 * TILE, "scale": 0.38, "color": [255, 176, 96], "strength": 0.5},
            {"x": 404.4 * TILE, "y": 204.6 * TILE, "scale": 0.34, "color": [255, 146, 74], "strength": 0.48},
            {"x": 402.2 * TILE, "y": 205.0 * TILE, "scale": 0.45, "color": [255, 150, 80], "strength": 0.5},
        ]
        shade = []
        # cliff shelf throws a shade band onto the road, every 3 cells
        for cx in range(self.p.ox, self.p.ox + self.p.w, 2):
            for cy in range(self.p.oy, self.p.oy + self.p.h):
                if self.p.s(cx, cy).startswith("#") and not self.p.s(cx, cy + 1).startswith("#"):
                    shade.append({"x": cx * TILE + 8, "y": (cy + 1) * TILE + 6,
                                  "scale": 0.85, "color": [86, 78, 108], "strength": 0.95})
                    shade.append({"x": cx * TILE + 8, "y": (cy + 1) * TILE + 26,
                                  "scale": 0.7, "color": [96, 88, 116], "strength": 0.45})
                    break
        for cx in range(self.p.ox, self.p.ox + self.p.w, 5):
            for cy in range(self.p.oy, self.p.oy + self.p.h, 4):
                if self.p.s(cx, cy).startswith("#") and self.p.s(cx + 2, cy + 2).startswith("#"):
                    shade.append({"x": cx * TILE + 16, "y": cy * TILE + 20, "scale": 1.25,
                                  "color": [58, 50, 84], "strength": 0.5})
        for p in self.props:
            if p["frame"] in ("tree_dead", "fence", "camp_crate", "barrel", "signpost"):
                shade.append({"x": p["x"], "y": p["y"] - 2, "scale": 0.3,
                              "color": [110, 100, 122], "strength": 0.5})
        day = [dict(l, mode="add", layer="pilot") for l in lamps]
        night = [dict(l, mode="add", layer="pilot", strength=min(1.0, l["strength"] * 1.45))
                 for l in lamps]
        return {
            "day": {"tint": [0.90, 0.87, 0.94], "ambient": 1.0,
                    "lights": [dict(s, mode="shade", layer="all") for s in shade] + day},
            "night": {"tint": [0.34, 0.37, 0.52], "ambient": 1.0,
                      "lights": [dict(s, mode="shade", layer="all") for s in shade] + night},
        }

    # -- build ------------------------------------------------------------
    def build(self) -> dict:
        self.rule_cliff_face()
        self.rule_fen()
        self.rule_verge()
        self.rule_road_margin()
        self.rule_moor_grove()
        self.rule_moor_detail()
        self.rule_road_texture()
        self.rule_yard_apron()
        self.junction()
        self.rule_water_window()
        self.yard()
        self.layby()
        actors = [{
            "frame": "knight_idle",
            "crop": [44, 42, 21, 38],
            "x": 392.5 * TILE, "y": 201.4 * TILE,
            "note": "hero body 12x16 px per first_hour_route proof; sprite crop is the alpha bbox of assets/characters/knight/_Idle.png frame 0, scale 1.0 as shipped",
        }]
        # no prop may sit on a contract cell unless it is that cell's own furniture
        for p in self.props:
            if is_solid_prop(p["frame"]):
                assert not self.collider_hits_contract(p["frame"], p["x"], p["y"]), p
        return {
            "schema": "soh.world_visual_pilot.placement.v1",
            "policy": "pilot",
            "authored_by": "prototypes/world_visual_pilot/tools/author_placement.py",
            "art_pins": ART_PINS,
            "tuning": {"ground_variant_block": 3, "ground_mirror": True,
                        "drop_detail_tokens": "1234",
                        "drop_detail_note": "cliff_shade1..6 are full-tile opaque frames; A1 paints them on walkable ground where they read as hard 16x16 dark squares. The pilot drops them and lays a soft shade cookie from art/light_radial.png instead."},
            "rules": dict(sorted(self.rules.items())),
            "decals": sorted(self.decals, key=lambda d: (d["cell"][1], d["cell"][0])),
            "props": sorted(self.props, key=lambda p: (p["y"], p["x"])),
            "actors": actors,
            "lighting": self.lights(),
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    a = Author()
    doc = a.build()
    print(json.dumps({"rules": doc["rules"],
                      "decals": len(doc["decals"]),
                      "props": len(doc["props"])}, indent=2))
    if args.dry_run:
        return 0
    out = os.path.join(ROOT, "data/placement.v1.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
