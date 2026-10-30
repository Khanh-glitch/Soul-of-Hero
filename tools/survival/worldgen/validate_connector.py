#!/usr/bin/env python3
"""Fail-closed evidence gate for the A1 canonical geography connector.

Source-verified only. It does not claim production native playability; A0 must
run the production-controller acceptance vectors after applying the delta.
"""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

import compile_connector as cc


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def validate(out_dir: Path | None = None) -> dict:
    errors: list[str] = []
    cc.check_pins()
    con = cc.load(cc.CONNECTOR / "canonical_connector.v1.json")
    delta = cc.load(cc.CONNECTOR / "legacy_cell_delta.v1.json")
    legacy_world = cc.load(cc.LEGACY / "hollow_marches.json")
    legacy_layers = cc.load(cc.LEGACY / "hollow_marches_layers.json")
    legacy_props = cc.load(cc.LEGACY / "hollow_marches_props.json")
    chunk = cc.load(cc.WORLD / cc.ANNEX_PATH)

    with tempfile.TemporaryDirectory() as td:
        result = cc.compile_all(Path(td), write_contract=False)
        if not result["ok"]:
            fail(errors, "compiler did not return ok")
        expected_con = cc.contract(cc.build_delta(legacy_layers, legacy_props, chunk))
        expected_delta = cc.build_delta(legacy_layers, legacy_props, chunk)
        if con != expected_con:
            fail(errors, "committed connector contract is stale; rerun compile_connector.py")
        if delta != expected_delta:
            fail(errors, "committed connector delta is stale; rerun compile_connector.py")
        world, layers, props = cc.compose(legacy_world, legacy_layers, legacy_props, chunk, delta)

    # Exact footprint and protected-content separation.
    carve = set(cc.rect_cells(cc.CARVE_RECT))
    dressed = {tuple(c) for c in delta["road_dressing_cells"]}
    if delta["collision_cell_count"] != 46 or delta["dressed_cell_count"] != 48:
        fail(errors, "connector footprint changed: expected 46 collision / 48 dressed cells")
    if len(delta["cell_deltas"]) != 48 or len(delta["prop_suppressions"]) != 14:
        fail(errors, "connector delta counts changed")
    protected: set[tuple[int, int]] = set()
    for lm in legacy_world["landmarks"]:
        for key in ("pos", "threshold"):
            if key in lm:
                protected.add(tuple(lm[key]))
    for key in ("discoveries", "camps"):
        for item in legacy_world.get(key, []):
            protected.add(tuple(item["pos"]))
    for item in legacy_world.get("shortcuts", []):
        protected.add(tuple(item["pos"]))
        if "carve" in item:
            x0, y0, x1, y1 = item["carve"]
            protected.update((cx, cy) for cy in range(y0, y1 + 1) for cx in range(x0, x1 + 1))
    if protected & dressed:
        fail(errors, f"connector touches protected legacy cells: {sorted(protected & dressed)}")
    for record in delta["cell_deltas"]:
        x, y = record["cell"]
        if (x, y) in carve:
            if record["after"]["solid"] != ".":
                fail(errors, f"carve cell {x},{y} is not clear after delta")
        else:
            fail(errors, f"dressed cell {x},{y} outside carve rect")
        if record["after"]["ground"] != "d" or not record["after"]["detail"].startswith("="):
            fail(errors, f"cell {x},{y} not dressed as protected road")

    # Composed geometry: legacy bytes outside the mouth unchanged; annex identity.
    lw, lh = legacy_layers["width"], legacy_layers["height"]
    old = {n: cc.decode(e["rle"], lw * lh) for n, e in legacy_layers["layers"].items()}
    new = {n: cc.decode(e["rle"], cc.COMPOSED_BOUNDS["w"] * cc.COMPOSED_BOUNDS["h"]) for n, e in layers["layers"].items()}
    cw, ch = cc.COMPOSED_BOUNDS["w"], cc.COMPOSED_BOUNDS["h"]
    if (cw, ch) != (448, 256):
        fail(errors, "composed bounds are not 448x256")
    changed = []
    for y in range(lh):
        for x in range(lw):
            oi, ni = y * lw + x, y * cw + x
            if any(old[n][oi] != new[n][ni] for n in old):
                changed.append((x, y))
    if set(changed) != dressed:
        fail(errors, f"legacy cell changes outside exact dressed set: {sorted(set(changed) ^ dressed)[:12]}")
    annex_walk = cc.decode(chunk["layers"]["walk"], 64 * 64)
    for ly in range(64):
        for lx in range(64):
            x, y = cc.ANNEX_ORIGIN[0] + lx, cc.ANNEX_ORIGIN[1] + ly
            solid = new["solid"][y * cw + x] != "."
            if solid != (annex_walk[ly * 64 + lx] != 1):
                fail(errors, f"annex collision disagrees with canonical walk at {x},{y}")
    for y in range(ch):
        for x in range(384, cw):
            if 192 <= y < 256:
                continue
            if new["solid"][y * cw + x] == ".":
                fail(errors, f"unsupported annex padding is walkable at {x},{y}")
                break
    if len(props["props"]) != len(legacy_props["props"]) - 14:
        fail(errors, "prop suppression count mismatch")
    if world["landmarks"] != legacy_world["landmarks"] or world["camps"] != legacy_world["camps"] or world["shortcuts"] != legacy_world["shortcuts"]:
        fail(errors, "legacy landmarks/camps/shortcuts changed")
    if world["canonical_connector"]["imported_chunk_count"] != 1:
        fail(errors, "pilot must import exactly one chunk")

    # Reward lock is read from the canonical slice contracts, not restated only in prose.
    way = cc.load(cc.WORLD / "vertical_slice/poi_crown_waystation.slice.json")
    relay = cc.load(cc.WORLD / "vertical_slice/poi_crown_relay_shed.slice.json")
    actions = {a["action_id"]: a for p in (way, relay) for a in p["actions"]}
    def items(action: dict) -> dict:
        return {r["item_id"]: r["quantity"] for r in action.get("reward_items", [])}
    def consumes(action: dict) -> dict:
        return {r["item_id"]: r["quantity"] for r in action.get("consumes_items", [])}
    if actions["pry_locker"].get("grants_capabilities") != ["cap_salvage"] or items(actions["pry_locker"]) != {}:
        fail(errors, "canonical reward changed: locker")
    if actions["seal_ledger"].get("grants_capabilities") != ["cap_seal_1"] or items(actions["seal_ledger"]) != {}:
        fail(errors, "canonical reward changed: ledger")
    if items(actions["cache_restock"]) != {"iron_scrap": 3, "knowledge_spares": 2} or actions["cache_restock"].get("cooldown_active_seconds") != 1800:
        fail(errors, "canonical reward changed: cache")
    if items(actions["gather_deadfall"]) != {"oak_wood": 2} or actions["gather_deadfall"].get("cooldown_active_seconds") != 300:
        fail(errors, "canonical reward changed: deadfall")
    crank = actions["hand_crank_bypass"]
    if consumes(crank) != {"iron_scrap": 2, "oak_wood": 1} or crank.get("grants_capabilities") != ["cap_power_1"]:
        fail(errors, "canonical Relay recipe/capability changed")
    if actions["copper_upgrade"].get("enabled") is not False:
        fail(errors, "canonical Relay copper upgrade must remain disabled")
    if con["rewards_lock"]["waystation_slice_sha256"] != cc.sha(cc.WORLD / "vertical_slice/poi_crown_waystation.slice.json"):
        fail(errors, "waystation slice pin mismatch")
    if con["rewards_lock"]["relay_slice_sha256"] != cc.sha(cc.WORLD / "vertical_slice/poi_crown_relay_shed.slice.json"):
        fail(errors, "relay slice pin mismatch")
    if con["native_playable"] is not False:
        fail(errors, "A1 source gate must not claim native playable")

    report = {
        "schema": "soh.world.connector_validation.v1",
        "ok": not errors,
        "errors": errors,
        "source_verified": True,
        "native_playable": False,
        "collision_cells": delta["collision_cell_count"],
        "dressed_cells": delta["dressed_cell_count"],
        "suppressed_props": len(delta["prop_suppressions"]),
        "composed_bounds": cc.COMPOSED_BOUNDS,
        "imported_chunks": 1,
        "protected_legacy_cells_touched": 0,
        "canonical_rewards_unchanged": not any("reward" in e or "Relay" in e for e in errors),
        "contract_sha256": cc.sha(cc.CONNECTOR / "canonical_connector.v1.json"),
        "delta_sha256": cc.sha(cc.CONNECTOR / "legacy_cell_delta.v1.json"),
    }
    if out_dir:
        cc.write(out_dir / "connector_validation_report.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=cc.DEFAULT_OUT)
    args = parser.parse_args()
    report = validate(args.out)
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(0 if report["ok"] else 1)
