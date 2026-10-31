#!/usr/bin/env python3
"""Shared model for the world-visual pilot: cells, colliders, reachability.

Walkability is *derived*, never assumed:

  solid cell   = the authored solid token is not "."
  prop collider = A1 runtime rule, game/overworld/overworld_world.gd:
                  body_w = max(8, w*0.82), body_h = max(8, h*0.42)
                  box centred on (x, y - body_h/2)
  reachable    = 4-neighbour flood from the authored start cell over cells the
                  hero body (12x16 px, 2 px margin per first_hour_route proof)
                  fits into without touching a solid cell or a collider.

Everything here is cell-space (16 px) because that is the authored unit.
"""

from __future__ import annotations

import json
import os
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE = 16
SOLID_PROP_PREFIXES = (
    "lm_", "short_bridge", "short_rubble", "short_conduit", "short_valve",
    "wall_stub", "tree_dead", "tree_pine", "column", "statue", "camp_tent",
    "cart", "sarcophagus", "camp_pavilion", "camp_wagon", "camp_rack",
    "camp_cookfire", "camp_table",
)
BODY_W, BODY_H, BODY_MARGIN = 12, 16, 2


def stable(*parts) -> int:
    return zlib.crc32("|".join(str(p) for p in parts).encode()) & 0xFFFFFFFF


def is_solid_prop(frame: str) -> bool:
    return any(frame.startswith(p) for p in SOLID_PROP_PREFIXES)


def collider_rect(frame: str, x: float, y: float) -> tuple[float, float, float, float] | None:
    """Exact A1 blocker box in world px, or None for a non-colliding frame."""
    if not is_solid_prop(frame):
        return None
    meta = json.load(open(os.path.join(ROOT, "data/overworld_props.v1.json")))["frames"][frame]
    body_w = max(8.0, meta["w"] * 0.82)
    body_h = max(8.0, meta["h"] * 0.42)
    cx, cy = x, y - body_h / 2.0
    return (cx - body_w / 2.0, cy - body_h / 2.0, body_w, body_h)


class Pilot:
    def __init__(self, window: str = "corridor"):
        doc = json.load(open(os.path.join(ROOT, "data/corridor_cells.v1.json")))
        self.doc = doc
        self.win = doc[window]
        self.window_key = window
        self.ox, self.oy = self.win["origin_cell"]
        self.w, self.h = self.win["size_cells"]
        self.ground = self.win["layers"]["ground"]
        self.detail = self.win["layers"]["detail"]
        self.solid = self.win["layers"]["solid"]
        self.poi = doc["corridor"]["poi"]
        self.route = doc["corridor"]["route"]

    # -- cell helpers -----------------------------------------------------
    def inside(self, x: int, y: int) -> bool:
        return self.ox <= x < self.ox + self.w and self.oy <= y < self.oy + self.h

    def g(self, x: int, y: int) -> str:
        return self.ground[y - self.oy][x - self.ox] if self.inside(x, y) else " "

    def d(self, x: int, y: int) -> str:
        return self.detail[y - self.oy][x - self.ox] if self.inside(x, y) else " "

    def s(self, x: int, y: int) -> str:
        return self.solid[y - self.oy][x - self.ox] if self.inside(x, y) else "#"

    def solid_cell(self, x: int, y: int) -> bool:
        if not self.inside(x, y):
            return True
        return self.s(x, y) != "."

    def road(self, x: int, y: int) -> bool:
        return self.g(x, y) == "d" or self.d(x, y).startswith("=")

    def bog(self, x: int, y: int) -> bool:
        return self.g(x, y) in ("b", "m", "-")

    def water(self, x: int, y: int) -> bool:
        return self.g(x, y) == "~"

    def void(self, x: int, y: int) -> bool:
        return self.g(x, y) in (".", " ")

    # -- contract cells ---------------------------------------------------
    def contract_cells(self) -> set[tuple[int, int]]:
        cells = set()
        for c in self.poi["required_nav_cells"]:
            cells.add(tuple(c))
        for c in self.poi["spawn_forbidden_cells"]:
            cells.add(tuple(c))
        for c in self.route["outbound_cells"]:
            cells.add(tuple(c))
        for c in self.route["return_cells"]:
            cells.add(tuple(c))
        for e in self.poi["entrances"]:
            cells.add(tuple(e["cell"]))
            for c in e.get("clearance_cells", []):
                cells.add(tuple(c))
        for node in self.poi["interaction_nodes"]:
            cells.add(tuple(node["cell"]))
            for c in node.get("stand_cells", []):
                cells.add(tuple(c))
        cells.add(tuple(self.poi["anchor_cell"]))
        cells.add(tuple(self.poi["hero_spawn_cell"]))
        cells.add(tuple(self.poi["hero_return_cell"]))
        return cells

    def interaction_cells(self) -> set[tuple[int, int]]:
        cells = set(self.contract_cells())
        for ob in self.poi["static_obstacles"]:
            for c in ob["cells"]:
                cells.add(tuple(c))
        return cells

    # -- colliders / reachability ----------------------------------------
    def collider_cells(self, frame: str, x: float, y: float) -> set[tuple[int, int]]:
        rect = collider_rect(frame, x, y)
        if rect is None:
            return set()
        rx, ry, rw, rh = rect
        out = set()
        for cy in range(int(ry // TILE), int((ry + rh - 0.001) // TILE) + 1):
            for cx in range(int(rx // TILE), int((rx + rw - 0.001) // TILE) + 1):
                out.add((cx, cy))
        return out

    def blocked(self, props: list[dict]) -> dict[tuple[int, int], str]:
        blocked: dict[tuple[int, int], str] = {}
        for y in range(self.oy, self.oy + self.h):
            for x in range(self.ox, self.ox + self.w):
                if self.solid_cell(x, y):
                    blocked[(x, y)] = "solid:" + self.s(x, y)
        for p in props:
            for c in self.collider_cells(p["frame"], p["x"], p["y"]):
                if self.inside(*c):
                    blocked.setdefault(c, "prop:" + p["frame"])
        return blocked

    def body_fits(self, x: int, y: int, blocked: dict) -> bool:
        """The 12x16 hero body plus margin must not touch anything blocked."""
        cx, cy = x * TILE + TILE / 2, y * TILE + TILE / 2
        hw, hh = BODY_W / 2 + BODY_MARGIN, BODY_H / 2 + BODY_MARGIN
        for gy in range(int((cy - hh) // TILE), int((cy + hh - 0.001) // TILE) + 1):
            for gx in range(int((cx - hw) // TILE), int((cx + hw - 0.001) // TILE) + 1):
                if blocked.get((gx, gy)):
                    return False
        return True

    def reachable(self, start: tuple[int, int], blocked: dict) -> set[tuple[int, int]]:
        if blocked.get(start):
            return set()
        seen = {start}
        stack = [start]
        while stack:
            x, y = stack.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in seen or not self.inside(*n) or blocked.get(n):
                    continue
                if self.void(*n):
                    continue
                seen.add(n)
                stack.append(n)
        return seen
