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
    alias_owner = {}
    for b in bindings:
        bid = b.get("binding_id", "")
        if not bid or bid in seen:
            errors.append(f"world binding duplicate/empty id {bid}")
        seen.add(bid)
        for field in ("instance_id", "interaction_node_id", "world_instance_id", "a1_source_instance_id"):
            alias = b.get(field)
            if not alias:
                continue
            if alias in alias_owner and alias_owner[alias] != bid:
                errors.append(f"world binding alias collision {alias} -> {bid}")
            alias_owner[alias] = bid
        if b.get("canonical_poi_id") is not None and b.get("canonical_poi_id") != b.get("poi_id"):
            errors.append(f"world binding {bid} canonical poi mismatch")
        if b.get("context_poi_id") is not None and b.get("context_poi_id") != b.get("poi_id"):
            errors.append(f"world binding {bid} context poi mismatch")
        identity = "|".join(str(b.get(k, "")) for k in IDENTITY_FIELDS)
        if b.get("identity") != identity:
            errors.append(f"world binding identity mismatch {bid}")
        if b.get("loot_table") is not None:
            errors.append(f"world binding {bid} must not use a random loot table")
        if not isinstance(b.get("cooldown_active_seconds"), int) or b["cooldown_active_seconds"] < 0:
            errors.append(f"world binding {bid} invalid cooldown")
        max_claims = b.get("max_claims", 0)
        if not isinstance(max_claims, int) or max_claims < 0 or max_claims > 1000000:
            errors.append(f"world binding {bid} invalid max_claims")
        if max_claims > 0 and b.get("cooldown_active_seconds") != 0:
            errors.append(f"world binding {bid} one-time source must not replenish")
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
                if s.get("max_claims", 0) != max_claims:
                    errors.append(f"world binding {bid}: source max_claims drift {sid}")
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
    cache = next((b for b in bindings if b.get("binding_id") == "a1_waystation_roadside_cache_v3"), {})
    cache_rewards = {r["item_id"]: r["quantity"] for r in cache.get("rewards", [])}
    if cache_rewards != {"iron_scrap": 3, "knowledge_spares": 2} or cache.get("cooldown_active_seconds") != 1800:
        errors.append("canonical Waystation cache must be 3 scrap + 2 spares / 1800 active seconds")
    if cache.get("instance_id") != "si:r_ashen_crown:waystation_cache:01" or cache.get("interaction_node_id") != "node_waystation_cache":
        errors.append("canonical cache must pin si:* world instance and node_* interaction alias")
    notes = next((b for b in bindings if b.get("binding_id") == "a1_roadside_notes_01_v4"), {})
    notes_rewards = {r["item_id"]: r["quantity"] for r in notes.get("rewards", [])}
    if notes_rewards != {"research_notes": 1} or notes.get("cooldown_active_seconds") != 1800:
        errors.append("roadside notes crate must be exactly 1 research_notes / 1800 active seconds")
    if notes.get("instance_id") != "si:r_ashen_crown:roadside_supply:01" or notes.get("canonical_poi_id") is not None:
        errors.append("roadside notes crate must bind the A1 non-POI si:* instance, not a new POI")
    salvage02 = next((b for b in bindings if b.get("binding_id") == "a1_roadside_salvage_02_v5"), {})
    timber03 = next((b for b in bindings if b.get("binding_id") == "a1_roadside_timber_03_v5"), {})
    if {r["item_id"]: r["quantity"] for r in salvage02.get("rewards", [])} != {"iron_scrap": 3, "knowledge_spares": 2} or salvage02.get("max_claims") != 1 or salvage02.get("cooldown_active_seconds") != 0:
        errors.append("roadside crate 02 must be one-time 3 scrap + 2 spares")
    if {r["item_id"]: r["quantity"] for r in timber03.get("rewards", [])} != {"oak_wood": 2, "research_notes": 1} or timber03.get("max_claims") != 1 or timber03.get("cooldown_active_seconds") != 0:
        errors.append("roadside crate 03 must be one-time 2 oak + 1 note")
    if salvage02.get("instance_id") != "si:r_ashen_crown:roadside_supply:02" or timber03.get("instance_id") != "si:r_ashen_crown:roadside_supply:03":
        errors.append("roadside one-time crates must bind exact A1 si:* instances")
    # A8 Quarry must remain fail-closed until A3 issues a real authorization.
    for b in bindings:
        if "quarry" in str(b.get("poi_id", "")) or "quarry" in str(b.get("instance_id", "")):
            errors.append("Quarry binding present without A3 authorization")
    for a in world_actions:
        if "quarry" in str(a.get("poi_id", "")):
            errors.append("Quarry world_action present without A3 authorization")
    return errors
