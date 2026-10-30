#!/usr/bin/env python3
"""A3 V5 first-hour pacing model. NOT a playtest and NOT a physics simulation.

It computes deterministic lower-bound active-time budgets from pinned A3
catalog costs, A3 world-source rates, A0 live-node yields and A1 corridor
geometry. It never advances a save, never teleports a Hero, and never claims
human approval. Travel is a Manhattan lower bound at the pinned Knight walk
speed; real collision/navigation can only make it slower.

Pins:
  A0 PR #21 9269739ebd35ed8ab83987b6bf53f560a59954af
    game/characters/knight/knight.gd move_speed = 96.0 px/s
    data/survival/survival_catalog.json resource per_hit/hits/respawn
    data/survival/hollow_marches_resources.json authored node cells
  A1 PR #20 2f6edd3f1c45916fb1fd85b167c3f635bf11cc3b
    data/survival/world/authoring/corridor/crown_roadside_sources.v1.json
  A3 local catalogs at the commit being validated.
"""
from __future__ import annotations

import argparse
import json
import pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[3]
TILE_PX = 16
KNIGHT_SPEED_PX_S = 96.0
HARVEST_INTERACT_COOLDOWN_S = 0.18
A0_START = (56, 218)
A1_CORRIDOR_OUTBOUND = [
    (392, 200), (392, 220), (395, 220), (396, 220), (396, 217),
    (400, 217), (400, 221), (402, 221), (403, 221), (403, 206),
    (408, 206), (408, 200), (408, 199),
]
A1_CORRIDOR_RETURN = [(408, 199), (408, 206), (392, 206), (392, 200)]
# Representative fresh A0 nodes near the authored start. These are lower-bound
# travel targets, not a claim that the exact BFS route is collision-free.
A0_NODE_PLAN = {
    "oak_tree": [(59, 202), (55, 238), (48, 203)],
    "stone_outcrop": [(53, 225), (41, 214)],
    "reed_clump": [(21, 213), (48, 250)],
    "iron_vein": [(74, 185), (100, 175)],
    "scrap_pile": [(47, 221), (52, 209), (47, 211), (69, 221)],
}


def load(rel: str):
    return json.loads((ROOT / rel).read_text())


def manhattan(a, b) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def route_seconds(points) -> float:
    return sum(manhattan(a, b) for a, b in zip(points, points[1:])) * TILE_PX / KNIGHT_SPEED_PX_S


def harvest_seconds(kind: str, nodes: int, a0_resources: dict) -> float:
    definition = a0_resources[kind]
    hits = int(definition["hits"]) * nodes
    # The per-node UI cooldown is a lower bound; authoritative depletion is in
    # SaveService. Fresh nodes are used, so no respawn wait is credited.
    return hits * HARVEST_INTERACT_COOLDOWN_S


def node_travel_seconds(kind: str, nodes: int) -> float:
    cells = A0_NODE_PLAN[kind][:nodes]
    if not cells:
        return 0.0
    points = [A0_START, *cells, A0_START]
    return route_seconds(points)


def craft_seconds(recipe_ids, recipes: dict) -> float:
    # Serial per station is conservative; A0 can run separate stations in
    # parallel, but this model does not credit unproven overlap.
    return sum(int(recipes[r]["duration_ticks"]) for r in recipe_ids)


def research_seconds() -> float:
    # EconomyService.research_recipe uses a fixed 40 active ticks.
    return 40.0


def canonical_sources(bindings: dict) -> dict:
    out = {}
    for b in bindings["bindings"]:
        out[b["binding_id"]] = {
            "rewards": {r["item_id"]: r["quantity"] for r in b["rewards"]},
            "cooldown": b["cooldown_active_seconds"],
            "max_claims": b.get("max_claims", 0),
        }
    return out


def scenario(name: str, order: str, bindings: dict, recipes: dict, a0_resources: dict) -> dict:
    sources = canonical_sources(bindings)
    cache = sources["a1_waystation_roadside_cache_v3"]
    notes01 = sources["a1_roadside_notes_01_v4"]
    crate02 = sources["a1_roadside_salvage_02_v5"]
    crate03 = sources["a1_roadside_timber_03_v5"]
    assert cache["rewards"] == {"iron_scrap": 3, "knowledge_spares": 2} and cache["cooldown"] == 1800
    assert notes01["rewards"] == {"research_notes": 1} and notes01["cooldown"] == 1800
    assert crate02["max_claims"] == 1 and crate03["max_claims"] == 1

    # Two viable orders. Both use the same physical sources and costs; only the
    # sequence differs. Explore-first banks one-time crates before the first
    # cache cooldown; home-first builds the paid production base before leaving.
    cache_claims = 2
    cache_wait = (cache_claims - 1) * cache["cooldown"]
    corridor_travel = route_seconds([A0_START, A1_CORRIDOR_OUTBOUND[0]]) + route_seconds(A1_CORRIDOR_OUTBOUND) + route_seconds(A1_CORRIDOR_RETURN) + route_seconds([A1_CORRIDOR_RETURN[-1], A0_START])
    harvest_plan = {"oak_tree": 3, "stone_outcrop": 2, "reed_clump": 2, "iron_vein": 2, "scrap_pile": 4}
    harvest_time = sum(harvest_seconds(k, n, a0_resources) + node_travel_seconds(k, n) for k, n in harvest_plan.items())
    station_recipes = ["workbench_kit", "furnace_kit", "research_kit", "burn_charcoal", "burn_charcoal", "smelt_iron", "smelt_iron", "smelt_iron", "smelt_iron", "weave_cloth", "iron_pick"]
    craft_time = craft_seconds(station_recipes, recipes)
    stone_pick_time = craft_seconds(["stone_pick"], recipes)
    total_lower_bound = corridor_travel + harvest_time + craft_time + stone_pick_time + research_seconds() + cache_wait

    milestones = {
        "20_min": {
            "goal": "stone_pick + paid workbench + first scrap/oak/stone loop",
            "requires_cache_wait": False,
            "lower_bound_seconds": round(node_travel_seconds("oak_tree", 2) + node_travel_seconds("stone_outcrop", 1) + node_travel_seconds("scrap_pile", 1) + harvest_seconds("oak_tree", 2, a0_resources) + harvest_seconds("stone_outcrop", 1, a0_resources) + harvest_seconds("scrap_pile", 1, a0_resources) + stone_pick_time + craft_seconds(["workbench_kit"], recipes), 2),
            "status": "MODEL_LOWER_BOUND_NOT_PLAYTEST",
        },
        "45_min": {
            "goal": "paid furnace + research_kit + first targeted research note",
            "requires_cache_wait": False,
            "lower_bound_seconds": round(corridor_travel + harvest_time * 0.7 + craft_seconds(["workbench_kit", "furnace_kit", "burn_charcoal", "smelt_iron", "smelt_iron", "research_kit"], recipes), 2),
            "status": "MODEL_LOWER_BOUND_NOT_PLAYTEST",
        },
        "90_min": {
            "goal": "iron_pick recipe learned and one physical iron_pick crafted",
            "requires_cache_wait": True,
            "cache_active_wait_seconds": cache_wait,
            "lower_bound_seconds": round(total_lower_bound, 2),
            "status": "MODEL_LOWER_BOUND_NOT_PLAYTEST",
        },
        "180_min": {
            "goal": "repeat cache/deadfall, relay power, surplus ingots/spares, safe return and storage",
            "requires_cache_wait": True,
            "lower_bound_seconds": round(total_lower_bound + 1800 + route_seconds(A1_CORRIDOR_OUTBOUND) + route_seconds(A1_CORRIDOR_RETURN), 2),
            "status": "MODEL_LOWER_BOUND_NOT_PLAYTEST",
        },
    }
    return {
        "scenario": name,
        "order": order,
        "technical_status": "MODEL_ONLY",
        "pacing_semantics": "ORDER_INVARIANT_LOWER_BOUND_NOT_PLAYTEST",
        "route_order_changes_total_lower_bound": False,
        "route_order_note": "Both orders use the same physical source set, costs and one cache cooldown; this model sums lower bounds and therefore reports identical totals. It proves order-invariant feasibility floors, not distinct measured pacing.",
        "human_playtest": False,
        "production_a0_mount": False,
        "tool_effect_status": "UNWIRED_A0",
        "cache_claims": cache_claims,
        "cache_active_wait_seconds": cache_wait,
        "one_time_crates": ["si:r_ashen_crown:roadside_supply:02", "si:r_ashen_crown:roadside_supply:03"],
        "canonical_rates_unchanged": True,
        "no_core": True,
        "no_gold": True,
        "travel_model": "Manhattan lower bound at 96 px/s; not collision-verified BFS",
        "harvest_model": "fresh A0 nodes; no offline respawn credit",
        "milestones": milestones,
        "bottlenecks": [
            "knowledge_spares still gate research_kit + basic-tool research",
            "A0 must mount crate 02/03 interaction points and one-time receipts",
            "stone_pick/iron_pick do not yet change A0 harvest; tool host contract required",
            "real navigation/collision can increase travel lower bound",
        ],
    }


def run_all() -> dict:
    bindings = load("data/survival/items/world_source_bindings.v3.json")
    recipes = load("data/survival/recipes/recipes.json")["recipes"]
    a0_resources = load("data/survival/survival_catalog.json")["resources"]
    return {
        "schema": "soh.economy.progression_v5.v1",
        "scope": "A3 pacing lower-bound model; not a player journey, not human approval",
        "scenarios": {
            "explore_first": scenario("explore_first", "locker -> crate01/02/03 -> cache1 -> home harvest -> stations -> cache2 -> research -> iron_pick", bindings, recipes, a0_resources),
            "home_first": scenario("home_first", "home harvest -> stone_pick/workbench/furnace -> corridor crates/cache -> research_kit -> cache2 -> research -> iron_pick", bindings, recipes, a0_resources),
        },
        "safe_retreat": {
            "route": "A1 corridor return waypoints to authored start; no Core/Gold required",
            "status": "MODEL_ONLY_PENDING_A0_NAV",
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=pathlib.Path)
    args = ap.parse_args()
    report = run_all()
    text = json.dumps(report, indent=2) + "\n"
    if args.json:
        args.json.write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
