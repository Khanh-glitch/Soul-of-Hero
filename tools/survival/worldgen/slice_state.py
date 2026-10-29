"""Isolated Python reference reducer for the A1 two-POI slice vectors.

This is a contract fixture, not production gameplay or SaveService persistence.
It mirrors tests/survival/world/godot/slice_state_machine.gd so the authored
adversarial vectors can be checked in pytest and in the isolated Godot harness.
"""
from __future__ import annotations

import copy
from typing import Any


def _cell(value: Any) -> tuple[int, int]:
    return (int(value[0]), int(value[1]))


class SliceMachine:
    def __init__(self, contracts: dict[str, dict], handoff: dict | None = None):
        self.contracts = contracts
        self.handoff = handoff or {}
        self.reset()

    def reset(self) -> None:
        self.state = {
            "inventory": {},
            "capabilities": [],
            "active_tick": 0,
            "session_id": "slice-session-1",
            "hero_cell": (392, 200),
            "pois": {pid: copy.deepcopy(c["initial_persistent_state"]) for pid, c in self.contracts.items()},
            "journal": {},
            "pending": None,
        }

    def _poi(self, poi_id: str) -> dict:
        return self.state["pois"][poi_id]

    def _action(self, poi_id: str, action_id: str) -> dict:
        for action in self.contracts[poi_id]["actions"]:
            if action["action_id"] == action_id:
                return action
        return {}

    def _count(self, item_id: str) -> int:
        return int(self.state["inventory"].get(item_id, 0))

    def _key(self, action: dict, poi_state: dict) -> str:
        key = action["transaction_key_template"]
        if "{claim_index}" in key:
            field = action.get("claim_index_field", "claim_count")
            key = key.replace("{claim_index}", str(int(poi_state.get(field, 0)) + 1))
        return key

    @staticmethod
    def _result(result: str, reason: str = "", **extra: Any) -> dict:
        return {"result": result, "reason": reason, **extra}

    def apply(self, event: dict) -> dict:
        kind = event["event"]
        if kind == "discover":
            self._poi(event["poi_id"])["discovered"] = True
            return self._result("SUCCESS")
        if kind == "request_action":
            return self._request(event)
        if kind == "commit":
            return self._commit()
        if kind in ("interrupt", "reload"):
            self.state["pending"] = None
            return self._result("SUCCESS")
        if kind in ("retreat", "death", "return"):
            geo = self.contracts[event.get("poi_id", "poi_crown_waystation")]["immutable_geography"]
            self.state["hero_cell"] = _cell(geo["hero_return_cell"])
            return self._result("SUCCESS")
        if kind == "set_inventory":
            self.state["inventory"] = copy.deepcopy(event["inventory"])
            return self._result("SUCCESS")
        if kind == "set_capabilities":
            self.state["capabilities"] = list(event["capabilities"])
            return self._result("SUCCESS")
        if kind == "advance_tick":
            self.state["active_tick"] = int(event["active_tick"])
            return self._result("SUCCESS")
        if kind == "assert_inventory":
            for item_id, qty in event["inventory"].items():
                if self._count(item_id) != int(qty):
                    return self._result("REJECTED", "inventory_mismatch:" + item_id)
            return self._result("SUCCESS")
        if kind == "assert_flag":
            if self._poi(event["poi_id"]).get(event["flag"]) != event["value"]:
                return self._result("REJECTED", "flag_mismatch")
            return self._result("SUCCESS")
        if kind == "check_route":
            route_id = event["route_id"]
            caps = event.get("capabilities", self.state["capabilities"])
            if route_id == "rt_east_seam":
                return self._result("SUCCESS") if "cap_filter" in caps else self._result("BLOCKED", "MISSING_CAPABILITY:cap_filter")
            if route_id == "rt_crown_safe_approach" or route_id.startswith(("retreat_", "sp_poi_crown_")):
                return self._result("SUCCESS")
            return self._result("REJECTED", "unknown_route")
        if kind == "validate_geometry":
            return self._geometry(event["poi_id"])
        if kind == "validate_identity":
            for pid in ("poi_crown_waystation", "poi_crown_relay_shed"):
                if pid not in self.contracts:
                    return self._result("REJECTED", "missing_poi:" + pid)
                for action in self.contracts[pid]["actions"]:
                    key = action["transaction_key_template"]
                    if key and not key.startswith(f"a1slice:{pid}:"):
                        return self._result("REJECTED", "unstable_transaction_key")
            return self._result("SUCCESS")
        if kind == "spawn_check":
            return self._spawn(event)
        if kind == "project_a6":
            return self._project(event["poi_id"])
        return self._result("REJECTED", "unknown_event:" + kind)

    def _request(self, event: dict) -> dict:
        poi_id, action_id = event["poi_id"], event["action_id"]
        poi_state = self._poi(poi_id)
        if not poi_state.get("discovered"):
            return self._result("REJECTED", "NOT_DISCOVERED")
        action = self._action(poi_id, action_id)
        if not action:
            return self._result("REJECTED", "unknown_action")
        if not action.get("enabled", True):
            return self._result("REJECTED", "DEFERRED:" + action.get("deferred_reason", "UNKNOWN"))
        if _cell(event["hero_cell"]) not in {_cell(c) for c in action["stand_cells"]}:
            return self._result("REJECTED", "OUT_OF_RANGE")
        for cap in action["requires_capabilities"]:
            if cap not in self.state["capabilities"]:
                return self._result("REJECTED", "MISSING_CAPABILITY:" + cap)
        for item in action["consumes_items"]:
            if self._count(item["item_id"]) < int(item["quantity"]):
                return self._result("REJECTED", "MISSING_ITEM:" + item["item_id"])
        key = self._key(action, poi_state)
        if action.get("one_time"):
            if key in self.state["journal"] or key in poi_state["reward_receipts"]:
                return self._result("ALREADY_APPLIED", transaction_key=key)
        else:
            next_field = action.get("next_ready_field", "")
            if next_field and self.state["active_tick"] < int(poi_state.get(next_field, 0)):
                return self._result("COOLDOWN", transaction_key=key)
        self.state["pending"] = {"poi_id": poi_id, "action_id": action_id, "transaction_key": key}
        return self._result("SUCCESS", transaction_key=key)

    def _commit(self) -> dict:
        pending = self.state["pending"]
        if pending is None:
            return self._result("REJECTED", "NO_PENDING")
        poi_id = pending["poi_id"]
        action = self._action(poi_id, pending["action_id"])
        key = pending["transaction_key"]
        poi_state = self._poi(poi_id)
        if key in self.state["journal"]:
            self.state["pending"] = None
            return self._result("ALREADY_APPLIED", transaction_key=key)
        for item in action["consumes_items"]:
            if self._count(item["item_id"]) < int(item["quantity"]):
                self.state["pending"] = None
                return self._result("REJECTED", "MISSING_ITEM:" + item["item_id"])
        for item in action["consumes_items"]:
            self.state["inventory"][item["item_id"]] = self._count(item["item_id"]) - int(item["quantity"])
        for item in action["reward_items"]:
            self.state["inventory"][item["item_id"]] = self._count(item["item_id"]) + int(item["quantity"])
        for cap in action["grants_capabilities"]:
            if cap not in self.state["capabilities"]:
                self.state["capabilities"].append(cap)
        for field, value in action["state_writes"].items():
            if field.endswith("_next_ready_active_tick_delta"):
                poi_state[field[: -len("_delta")]] = self.state["active_tick"] + int(value)
            elif field.endswith("_delta"):
                base = field[: -len("_delta")]
                poi_state[base] = int(poi_state.get(base, 0)) + int(value)
            else:
                poi_state[field] = value
        right = action.get("reward_right_id", "")
        if right:
            self.state["journal"][key] = right
            poi_state["reward_receipts"][key] = right
        elif key:
            self.state["journal"][key] = action["action_id"]
        if key:
            poi_state["last_transaction_key"] = key
        self.state["pending"] = None
        return self._result("SUCCESS", transaction_key=key)

    def _geometry(self, poi_id: str) -> dict:
        geo = self.contracts[poi_id]["immutable_geography"]
        nav = {_cell(c) for c in geo["required_nav_cells"]}
        for ob in geo["static_obstacles"]:
            for cell in ob["cells"]:
                if _cell(cell) in nav:
                    return self._result("REJECTED", "obstacle_blocks_required_nav")
        if geo["dynamic_spawns"]:
            return self._result("REJECTED", "dynamic_spawns_forbidden")
        for ent in geo["entrances"]:
            for cell in ent["clearance_cells"]:
                if _cell(cell) not in nav:
                    return self._result("REJECTED", "entrance_clearance_missing")
        return self._result("SUCCESS")

    def _spawn(self, event: dict) -> dict:
        cell, hero = _cell(event["cell"]), _cell(event["hero_cell"])
        if cell == hero:
            return self._result("REJECTED", "SPAWN_ON_HERO")
        geo = self.contracts[event["poi_id"]]["immutable_geography"]
        for ent in geo["entrances"]:
            if cell in {_cell(c) for c in ent["clearance_cells"]}:
                return self._result("REJECTED", "SPAWN_BLOCKED_REQUIRED_DOORWAY")
        if cell in {_cell(c) for c in geo["required_nav_cells"]}:
            return self._result("REJECTED", "SPAWN_BLOCKED_REQUIRED_NAV")
        return self._result("REJECTED", "NO_DYNAMIC_SPAWNS_IN_SLICE_V1")

    def _project(self, poi_id: str) -> dict:
        poi_state = self._poi(poi_id)
        projection = self.contracts[poi_id]["a6_projection"]
        if not poi_state.get("discovered"):
            return {"visibility": "HIDDEN", "map_status": "HIDDEN", "clues": [], "hazard_telegraphs": [], "missing_prerequisite_reasons": []}
        map_status = "DISCOVERED"
        if poi_id == "poi_crown_relay_shed":
            if poi_state.get("bus_powered"):
                map_status = "POWERED"
            elif "cap_salvage" not in self.state["capabilities"] or self._count("iron_scrap") < 2 or self._count("oak_wood") < 1:
                map_status = "MISSING_PREREQUISITE"
        return {
            "visibility": "DISCOVERED",
            "map_status": map_status,
            "clues": projection["discovered_clues"],
            "hazard_telegraphs": projection["hazard_telegraphs"],
            "missing_prerequisite_reasons": projection["missing_prerequisite_reasons"],
        }
