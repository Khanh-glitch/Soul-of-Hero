"""Pure A1/A3 physical source-binding oracle. No save, no RNG, no network.

Used by validate_economy.py and by independent negative tests. The runtime
GDScript adapter mirrors these invariants; this module is the Python oracle.
"""
from __future__ import annotations

SCHEMA = "soh.economy.world_source_bindings.v3"
IDENTITY_FIELDS = ("source_class", "region_id", "poi_id", "instance_id")


def validate(bindings_doc: dict, items: dict, sources: dict) -> list[str]:
    errors: list[str] = []
    bindings = bindings_doc.get("bindings", [])
    world_actions = bindings_doc.get("world_actions", [])
    if bindings_doc.get("schema") != SCHEMA:
        errors.append("world bindings: bad schema")
    seen = set()
    for b in bindings:
        bid = b.get("binding_id", "")
        if not bid or bid in seen:
            errors.append(f"world binding duplicate/empty id {bid}")
        seen.add(bid)
        identity = "|".join(str(b.get(k, "")) for k in IDENTITY_FIELDS)
        if b.get("identity") != identity:
            errors.append(f"world binding identity mismatch {bid}")
        if b.get("loot_table") is not None:
            errors.append(f"world binding {bid} must not use a random loot table")
        if not isinstance(b.get("cooldown_active_seconds"), int) or b["cooldown_active_seconds"] < 0:
            errors.append(f"world binding {bid} invalid cooldown")
        for r in b.get("rewards", []):
            sid = r.get("source_id")
            iid = r.get("item_id")
            qty = r.get("quantity")
            if sid not in sources:
                errors.append(f"world binding {bid}: unknown source {sid}")
            else:
                s = sources[sid]
                if s["item_id"] != iid:
                    errors.append(f"world binding {bid}: source/item mismatch {sid}")
                if s.get("world_binding_id"):
                    if s.get("region_id") != b.get("region_id") or s.get("poi_id") != b.get("poi_id"):
                        errors.append(f"world binding {bid}: source region/poi mismatch {sid}")
                    if s.get("world_binding_id") != bid:
                        errors.append(f"world binding {bid}: source record not back-linked {sid}")
                    if s.get("integration_status") != "A1_PINNED_A3_BOUND":
                        errors.append(f"world binding {bid}: source not marked bound {sid}")
                elif not str(s.get("integration_status", "")).startswith("LIVE"):
                    errors.append(f"world binding {bid}: proposed source is neither bound nor live {sid}")
                if s.get("yield_per_claim") != qty or s.get("replenishment_seconds") != b.get("cooldown_active_seconds"):
                    errors.append(f"world binding {bid}: canonical yield/cooldown drift {sid}")
            if iid not in items:
                errors.append(f"world binding {bid}: unknown item {iid}")
            elif items[iid]["kind"] == "skill_core":
                errors.append(f"world binding {bid}: Core reward forbidden")
            elif items[iid].get("storage") != "stack":
                errors.append(f"world binding {bid}: reward must be a physical stack {iid}")
            if type(qty) is not int or qty <= 0 or qty > 50:
                errors.append(f"world binding {bid}: invalid quantity {iid}")
    actions = {(a.get("poi_id"), a.get("action_id")): a for a in world_actions}
    locker = actions.get(("poi_crown_waystation", "pry_locker"), {})
    if locker.get("reward_items") != [] or locker.get("grants_capabilities") != ["cap_salvage"]:
        errors.append("canonical locker must grant cap_salvage and ZERO items")
    ledger = actions.get(("poi_crown_waystation", "seal_ledger"), {})
    if ledger.get("reward_items") != [] or ledger.get("grants_capabilities") != ["cap_seal_1"]:
        errors.append("canonical ledger must grant cap_seal_1 and ZERO items")
    relay = actions.get(("poi_crown_relay_shed", "hand_crank_bypass"), {})
    relay_costs = {c["item_id"]: c["quantity"] for c in relay.get("consumes_items", [])}
    if relay_costs != {"iron_scrap": 2, "oak_wood": 1} or relay.get("grants_capabilities") != ["cap_power_1"]:
        errors.append("canonical relay must consume 2 scrap + 1 oak and grant cap_power_1")
    cache = next((b for b in bindings if b.get("instance_id") == "node_waystation_cache"), {})
    cache_rewards = {r["item_id"]: r["quantity"] for r in cache.get("rewards", [])}
    if cache_rewards != {"iron_scrap": 3, "knowledge_spares": 2} or cache.get("cooldown_active_seconds") != 1800:
        errors.append("canonical Waystation cache must be 3 scrap + 2 spares / 1800 active seconds")
    return errors
