"""Read-only forensic snapshot of the production Hollow Marches.

This module never writes to game/, data/overworld/ or SaveService.  It reproduces
the two collision authorities used by OverworldWorld + OverworldTraversability:
the solid RLE grid and the lower-body rectangles of solid prop sprites.  The
result is an offline planning oracle, not a replacement for native physics QA.
"""
from __future__ import annotations

import hashlib
import json
import math
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OW = ROOT / "data" / "overworld"
TILE = 16
SOLID_PREFIXES = (
    "lm_", "short_bridge", "short_rubble", "short_conduit", "short_valve",
    "wall_stub", "tree_dead", "tree_pine", "column", "statue", "camp_tent",
    "cart", "sarcophagus", "camp_pavilion", "camp_wagon", "camp_rack",
    "camp_cookfire", "camp_table",
)
SHORTCUT_CLOSED = {
    "short_bridge": "short_bridge_broken", "short_rubble": "short_rubble_block",
    "short_conduit": "short_conduit_off", "short_valve": "short_valve_closed",
}


def _json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def decode_rle(entry: dict, total: int) -> list[str]:
    out: list[str] = []
    for token, count in entry["rle"]:
        if len(out) + int(count) > total:
            raise ValueError("RLE overrun")
        out.extend([str(token)] * int(count))
    if len(out) != total:
        raise ValueError(f"RLE underrun {len(out)} != {total}")
    return out


def nearest_free(blocked: list[bool], w: int, h: int, cell: tuple[int, int], radius: int = 12):
    x, y = cell
    if 0 <= x < w and 0 <= y < h and not blocked[y * w + x]:
        return cell
    for r in range(1, radius + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r:
                    continue
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and not blocked[yy * w + xx]:
                    return (xx, yy)
    return cell


def flood(blocked: list[bool], w: int, h: int, origin: tuple[int, int]) -> dict[int, int]:
    """4-neighbour flood, matching OverworldTraversability (no diagonal squeeze)."""
    ox, oy = origin
    if not (0 <= ox < w and 0 <= oy < h) or blocked[oy * w + ox]:
        return {}
    start = oy * w + ox
    dist = {start: 0}
    q = deque([start])
    while q:
        c = q.popleft()
        x, y = c % w, c // w
        for xx, yy in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= xx < w and 0 <= yy < h:
                n = yy * w + xx
                if not blocked[n] and n not in dist:
                    dist[n] = dist[c] + 1
                    q.append(n)
    return dist


class Baseline:
    def __init__(self):
        self.world = _json(OW / "hollow_marches.json")
        self.layers = _json(OW / "hollow_marches_layers.json")
        self.props_doc = _json(OW / "hollow_marches_props.json")
        self.prop_meta = _json(OW / "overworld_props.json")["frames"]
        self.tile_meta = _json(OW / "overworld_tiles.json")
        b = self.world["world_bounds"]
        self.w, self.h = int(b["w"]), int(b["h"])
        self.total = self.w * self.h
        self.ground = decode_rle(self.layers["layers"]["ground"], self.total)
        self.solid = decode_rle(self.layers["layers"]["solid"], self.total)
        self.detail = decode_rle(self.layers["layers"]["detail"], self.total)
        self.blocked = [t != "." for t in self.solid]
        self.prop_blocked = [False] * self.total
        self._mark_props()
        sx, sy = self.world["start_position"]
        self.origin = nearest_free(self.blocked, self.w, self.h, (int(sx), int(sy)))
        self.dist = flood(self.blocked, self.w, self.h, self.origin)

    def _mark_props(self):
        for p in self.props_doc["props"]:
            frame = str(p["frame"])
            if not frame.startswith(SOLID_PREFIXES):
                continue
            # Runtime swaps a shortcut family to its closed/open frame before
            # sizing the body.  Planning uses the closed (fresh-save) state.
            frame = SHORTCUT_CLOSED.get(frame, frame)
            r = self.prop_meta[frame]
            bw, bh = max(8.0, r["w"] * 0.82), max(8.0, r["h"] * 0.42)
            x0 = math.floor((p["x"] - bw / 2) / TILE)
            x1 = math.floor((p["x"] + bw / 2) / TILE)
            y0 = math.floor((p["y"] - bh) / TILE)
            y1 = math.floor(p["y"] / TILE)
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    if 0 <= x < self.w and 0 <= y < self.h:
                        i = y * self.w + x
                        self.prop_blocked[i] = True
                        self.blocked[i] = True

    def endpoint_report(self):
        rows = []
        for lm in self.world["landmarks"]:
            x, y = lm["threshold"]
            i = int(y) * self.w + int(x)
            rows.append({
                "id": lm["id"], "level_id": lm["campaign_level_id"],
                "pos": lm["pos"], "threshold": lm["threshold"],
                "facing": lm["facing"], "capture_offset": lm["capture_offset"],
                "reachable_closed_shortcuts": i in self.dist,
                "walking_tiles_from_spawn": self.dist.get(i, -1),
            })
        return rows

    def seam_candidates(self):
        out = {}
        for side, cells in {
            "east": [(x, y) for y in range(self.h) for x in range(self.w - 16, self.w)],
            "south": [(x, y) for y in range(self.h - 16, self.h) for x in range(self.w)],
        }.items():
            rows = [(self.dist[y * self.w + x], x, y, self.ground[y * self.w + x][:1])
                    for x, y in cells if y * self.w + x in self.dist]
            rows.sort()
            out[side] = rows[:30]
        return out

    def lock(self):
        paths = [
            "data/overworld/hollow_marches.json",
            "data/overworld/hollow_marches_layers.json",
            "data/overworld/hollow_marches_props.json",
            "data/overworld/overworld_tiles.json",
            "data/overworld/overworld_props.json",
            "game/overworld/chapter1_overworld.gd",
            "game/overworld/overworld_world.gd",
            "game/overworld/overworld_traversability.gd",
            "game/characters/knight/knight.gd",
            "project.godot",
        ]
        files = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths}
        return {
            "schema": "soh.world.baseline_lock.v1",
            "source_branch": "feature/survival-rpg-foundation-20261029",
            "source_sha": "3dc787e83f16d643086a257b0746f992763ac2f2",
            "files": files,
            "bounds": {"x": 0, "y": 0, "w": self.w, "h": self.h},
            "tile_px": TILE,
            "runtime_camera_zoom": 1.0,
            "json_camera_zoom_stale": self.world["camera_default"]["zoom"],
            "viewport_px": [640, 360],
            "visible_tiles_at_zoom1": [40, 22.5],
            "knight_base_speed_px_s": 96.0,
            "spawn_authored": self.world["start_position"],
            "spawn_resolved": list(self.origin),
            "reachable_cells_fresh_save": len(self.dist),
            "landmarks": self.endpoint_report(),
            "shortcuts": self.world["shortcuts"],
            "camps": self.world["camps"],
            "collision_rule": "solid RLE != '.' OR lower-body prop rect; 4-neighbour planning flood",
            "native_physics_proof": "NOT_TESTED_BY_THIS_MODULE",
        }


if __name__ == "__main__":
    b = Baseline()
    print(json.dumps({"lock": b.lock(), "seams": b.seam_candidates()}, indent=2))
