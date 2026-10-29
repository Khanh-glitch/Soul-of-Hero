"""SURV-050A product-correction contracts.

These are authored, versioned handoff contracts. They do not implement A0 damage,
A3 catalog code, A6 UI, or native POI encounters. They make the next integration
step testable and prevent silent semantic collapse.
"""
from __future__ import annotations

import authoring as A

A3_REVIEW_HEAD = "86dc21954fd0a1a4aa9f98b6ec7d1e6782cc800e"
A3_MAPPING_JSON_SHA256 = "e5d0cb6ef05fae8bbd90049d224782a1a20ad86387735445e0184687d34defee"
A3_MAPPING_MD_SHA256 = "642ba9a6bed69ef42ad041944bed3ec03d2d3b1328e0692a7e633f1579763391"

READINESS_SITE = "WORLD_SITE_CONTRACT_ONLY"
READINESS_SPEC = "INTERACTION_SPEC_AUTHORED_NOT_NATIVE"
READINESS_LEGACY = "PRESERVED_BASELINE"

# ---------------------------------------------------------------------------
# First-hour hazard bootstrap / native-compatible damage proposal
# ---------------------------------------------------------------------------

def hazard_damage_contract():
    rows = []
    for h in A.HAZARDS:
        hid, rid, kind, rect, clue, cap, severity = h
        rows.append({
            "hazard_id": hid, "region_id": rid, "kind": kind, "rect": rect,
            "clue": clue, "required_capability": cap, "severity": severity,
            "unmitigated_hp_per_second_proposal": float(severity),
            "mitigation": {
                "capability": cap,
                "required_resistance_keys": [kind],
                "minimum_mitigation_fraction_proposal": 0.6,
                "a3_current_status": "PARTIAL_REQUIRES_A3_EXTENSION" if cap in ("cap_filter", "cap_thermal") else "MISSING_A3_ITEM",
                "note": "A1 capability is preparation/access grammar; A3 owns the concrete gear/resistance values. Do not silently equate toxin_mask venom:60 with heat/acid_gas/poison coverage.",
            },
            "telegraph": {"clue_before_entry": True, "map_label": hid, "environmental_clue": clue},
            "retreat_rule": "Leaving the authored rect stops exposure after a 1.0 s proposal grace; no permanent capability lock or invisible wall.",
        })
    return {
        "schema": "soh.world.hazard_damage.v1",
        "status": "AUTHORED_PROPOSAL_NOT_NATIVE_BALANCED",
        "owner_damage_application": "A0", "owner_gear_resistance": "A3", "owner_clues_ui": "A6",
        "units": {"damage": "hp_per_second", "distance": "tiles", "time": "seconds"},
        "tick_model_proposal": {"fixed_tick_seconds": 1.0, "exposure_grace_seconds": 1.0, "stacking": "highest_severity_per_cell_not_additive"},
        "native_playable": False,
        "hazards": rows,
        "novice_safe_route": {
            "route_id": "rt_crown_safe_approach",
            "purpose": "First-hour salvage/power/filter preparation without heat/rot exposure.",
            "max_authored_hazard_tiles": 0,
            "retreat_route_id": "rt_crown_safe_approach",
        },
        "hazardous_shortcut": {
            "route_id": "rt_east_seam",
            "required_capability": "cap_filter",
            "purpose": "Prepared players may cross the legacy crucible/rot basin faster; danger is preserved, not disabled.",
        },
    }


def novice_bootstrap_contract():
    stages = [
        {"stage": "safe_salvage", "poi": "poi_crown_waystation", "route_id": "rt_crown_safe_approach", "grants": ["cap_salvage", "cap_seal_1"], "bootstrap_materials": [], "retreat_route_id": "rt_crown_safe_approach"},
        {"stage": "power_discovery", "poi": "poi_crown_relay_shed", "route_id": "rt_crown_buffer", "grants": ["cap_power_1"], "bootstrap_materials": ["salvage", "timber"], "retreat_route_id": "rt_crown_safe_approach"},
        {"stage": "filter_preparation", "poi": "poi_amberwood_apothecary", "route_id": "rt_south_seam", "grants": ["cap_filter"], "bootstrap_materials": ["rare_herb", "fibre"], "retreat_route_id": "rt_south_seam"},
    ]
    return {
        "schema": "soh.world.novice_bootstrap.v1",
        "status": "AUTHORED_CONTRACT_NOT_NATIVE_PLAYTESTED",
        "native_playable": False,
        "first_hour_goal": "Reach salvage, local power and filter preparation, then retreat, without requiring a capability that is only granted downstream.",
        "stages": stages,
        "bootstrap": A.NOVICE_BOOTSTRAP,
        "circularity_rule": "A capability source POI may grant its capability on first visit; sustain/repair materials may be gated by that capability, but bootstrap materials may not require the capability being granted.",
        "safe_route_ids": ["rt_crown_safe_approach", "rt_south_seam", "rt_crown_buffer"],
        "hazardous_shortcut_route_id": "rt_east_seam",
    }


# ---------------------------------------------------------------------------
# A1/A3 material reconciliation decisions
# ---------------------------------------------------------------------------

def material_decision_contract():
    decisions = [
        {"material_key": "bog_iron", "proposed_a3_ids": ["iron_ore"], "decision": "SPLIT", "priority": "P2",
         "reason": "Slow redox renewal at peat margins is not A3 finite-vein iron_ore. Keep bog_iron provenance for pump/filter-frame and late-tool sinks; do not collapse renewal/rarity into generic ore.",
         "a3_action": "Author a distinct bog_iron feedstock or source-tagged smelting path when the Ashwater pump loop is implemented; retain A1 node renewal.",
         "preserved_provenance": "redox precipitation at peat margin", "preserved_renewal": "slow redox renewal", "preserved_sinks": "filter frame; late tools"},
        {"material_key": "glacial_iron", "proposed_a3_ids": ["iron_ore"], "decision": "SPLIT", "priority": "P1",
         "reason": "Thaw-season magnetite skarn is a high-grade thermal/pressure feedstock, not generic iron_ore. Collapsing it removes the Frostcrown preparation identity.",
         "a3_action": "Author glacial_iron or a cold-crucible bloom path for thermal ward/deep pressure frames; keep thaw-season vein provenance.",
         "preserved_provenance": "magnetite skarn at granite contact", "preserved_renewal": "thaw-season vein", "preserved_sinks": "thermal ward; deep pressure frame"},
        {"material_key": "fibre", "proposed_a3_ids": ["reed_fibre"], "decision": "SPLIT", "priority": "P0",
         "reason": "A1 fibre spans river-margin reed and oasis/forest understorey. A3 reed_fibre is wetland-specific. First-hour filter mesh needs an explicit source-side split, not a global rename.",
         "a3_action": "Map only riverine/lake reed sites (e.g. src_crown_reed, src_mere_reed) to reed_fibre; keep oasis/forest fibre as dry_fibre or a distinct A3 item before Saffron filter/rope sinks.",
         "preserved_provenance": "reed/oasis/forest understorey", "preserved_renewal": "seasonal regrowth", "preserved_sinks": "cloth; rope; filter mesh",
         "site_mapping": [{"site_id": "src_crown_reed", "a3_item_id": "reed_fibre", "status": "APPROVE_SOURCE_SPECIFIC"}, {"site_id": "src_saffron_fibre", "a3_item_id": None, "status": "MISSING_DRY_FIBRE_DECISION"}]},
        {"material_key": "hardwood", "proposed_a3_ids": ["oak_wood"], "decision": "REJECT", "priority": "P1",
         "reason": "Monsoon emergent hardwood is a slow-grove boat hull/boardwalk/advanced-frame material. oak_wood is generic structural timber; aliasing would erase boat logistics and rarity.",
         "a3_action": "Reject hardwood=oak_wood. A0/A3 should author a hardwood construction tag/item for hulls and boardwalks; keep oak_wood for early generic timber.",
         "preserved_provenance": "monsoon canopy emergent trees", "preserved_renewal": "slow grove", "preserved_sinks": "boat hull; boardwalk; advanced frames"},
        {"material_key": "frost_resin", "proposed_a3_ids": ["frost_shard"], "decision": "SPLIT", "priority": "P1",
         "reason": "Tapped conifer cold-stress exudate is ecological, not mineral frost_shard. Approve the smallest A3 split because thermal ward/cold-seal core is a real sink.",
         "a3_action": "Add frost_resin item and frost_extract/thermal-ward sink; retain tapped-stand cooldown. Do not rename frost_shard.",
         "preserved_provenance": "boreal conifer cold stress exudate", "preserved_renewal": "tapped stand cooldown", "preserved_sinks": "thermal ward; cold-seal core"},
        {"material_key": "peat", "proposed_a3_ids": ["coal"], "decision": "SPLIT", "priority": "P2",
         "reason": "Cut acid-bog peat is a very slow renewable fuel/filter carbon, not geological coal. Approve split only with a real peat_charcoal/furnace-fuel or filter-carbon sink.",
         "a3_action": "Add peat fuel/charcoal path and filter-carbon sink; preserve very slow cut renewal and Ashwater provenance.",
         "preserved_provenance": "waterlogged acid bog accumulation", "preserved_renewal": "very slow cut", "preserved_sinks": "fuel; filter carbon"},
        {"material_key": "rare_herb", "proposed_a3_ids": ["moonleaf"], "decision": "SPLIT", "priority": "P0",
         "reason": "A1 rare_herb is broader than A3 moonleaf. First-hour filter preparation needs an explicit orchard-understorey mapping; cenote/karst herbs must not collapse into moonleaf.",
         "a3_action": "Map orchard/remnant plot morphs (e.g. src_amber_herb) to moonleaf only with a real potion/filter/grafting sink; keep karst/cenote rare_herb distinct.",
         "preserved_provenance": "niche understorey and orchard remnant", "preserved_renewal": "plot or wild patch", "preserved_sinks": "potions; filter; grafting",
         "site_mapping": [{"site_id": "src_amber_herb", "a3_item_id": "moonleaf", "status": "APPROVE_SOURCE_SPECIFIC_CONDITIONAL_ON_SINK"}, {"site_id": "src_sunken_herb", "a3_item_id": None, "status": "MISSING_KARST_HERB_DECISION"}]},
        {"material_key": "venom_sac", "proposed_a3_ids": ["venom_spine"], "decision": "SPLIT", "priority": "P1",
         "reason": "Fauna venom sac is not A3 venom_spine reward. Approve split because extract_venom/toxin_mask/venom-core are real sinks; bootstrap filter must not require venom_sac before cap_filter exists.",
         "a3_action": "Add venom_sac fauna-source item and extract_venom/toxin_mask sink; keep fauna respawn provenance. venom_spine remains a separate reward.",
         "preserved_provenance": "wetland predator and mangrove fauna", "preserved_renewal": "fauna respawn", "preserved_sinks": "filter gear; venom core family"},
    ]
    missing = [
        {"material_key": "copper", "priority": "P1", "dependency": "Power circuits, seal-2 forge, storm signal, pumps; first-hour relay uses a salvage/timber hand-crank bypass, so copper is not a first-hour softlock.", "first_hour_blocking": False},
        {"material_key": "rubber_sap", "priority": "P1", "dependency": "Boat hull seals, deepward/tide-ward insulation; mid-game traversal preparation.", "first_hour_blocking": False},
        {"material_key": "limestone", "priority": "P1", "dependency": "Mortar, filter bed, grafting bed; A0 construction/A1 preparation gap.", "first_hour_blocking": False},
        {"material_key": "honey", "priority": "P2", "dependency": "Food/fermentation/trade; not required for the first-hour filter lesson.", "first_hour_blocking": False},
        {"material_key": "salt", "priority": "P2", "dependency": "Food preservation, flux, trade; Saffron logistics.", "first_hour_blocking": False},
        {"material_key": "pearl", "priority": "P2", "dependency": "Seal inlay, trade, lens; access seals are credentials, not pearl crafts by default.", "first_hour_blocking": False},
        {"material_key": "silica_sand", "priority": "P2", "dependency": "Glass furnace/lens path; prerequisite for storm_glass identity.", "first_hour_blocking": False},
        {"material_key": "storm_glass", "priority": "P2", "dependency": "Signal tower/storm core; late Glasswind objective.", "first_hour_blocking": False},
        {"material_key": "obsidian", "priority": "P3", "dependency": "Precision cores/blades; late Embersteppe specialization.", "first_hour_blocking": False},
        {"material_key": "basalt", "priority": "P3", "dependency": "Heat-proof construction; primarily A0 construction material.", "first_hour_blocking": False},
        {"material_key": "abyssal_pearl", "priority": "P3", "dependency": "Tier-3 seal/abyssal core; late Pearl objective.", "first_hour_blocking": False},
        {"material_key": "aether_crystal", "priority": "P3", "dependency": "Core blanks/power nodes; not interchangeable with ancient_catalyst without a design decision.", "first_hour_blocking": False},
    ]
    return {
        "schema": "soh.world.a1_a3_material_decisions.v1",
        "status": "A1_DECISION_CONTRACT_FOR_A3_ADOPTION",
        "a3_review_source": {"pr": 19, "head": A3_REVIEW_HEAD, "mapping_json_sha256": A3_MAPPING_JSON_SHA256, "mapping_md_sha256": A3_MAPPING_MD_SHA256},
        "principles": [
            "material_key remains A1 world-source truth; A3 owns item ids, recipes, yields, prices and migration.",
            "No alias is provenance-equivalent unless explicitly approved; source/renewal/sink/rarity must survive adoption.",
            "MISSING_A3_ITEM remains explicit; do not manufacture filler items to reduce the count.",
            "First-hour bootstrap may not depend on a downstream-gated sustain material.",
        ],
        "alias_decisions": decisions,
        "missing_items": missing,
        "counts": {"alias_decisions": len(decisions), "missing_items": len(missing)},
        "a3_code_changed_by_a1": False,
    }


# ---------------------------------------------------------------------------
# Truthful POI readiness + two early interaction exemplars
# ---------------------------------------------------------------------------

def poi_authoring_specs():
    waystation = {
        "schema": "soh.world.poi_authoring.v1",
        "poi_id": "poi_crown_waystation",
        "content_readiness": READINESS_SPEC,
        "native_playable": False,
        "footprint_radius_tiles": 5,
        "purpose": "First-hour roadside salvage station: teach salvage -> spares -> seal grammar and safe retreat.",
        "approach_topology": {
            "nodes": [
                {"id": "postern_road", "cell": [392, 200], "kind": "approach"},
                {"id": "forecourt", "cell": [404, 200], "kind": "safe_court"},
                {"id": "locker", "cell": [408, 200], "kind": "interaction"},
                {"id": "ledger", "cell": [410, 202], "kind": "interaction"},
                {"id": "rear_ditch", "cell": [408, 206], "kind": "alternate"},
                {"id": "retreat_road", "cell": [392, 200], "kind": "retreat"},
            ],
            "edges": [
                {"from": "postern_road", "to": "forecourt", "mode": "foot", "hazard_exposure": []},
                {"from": "forecourt", "to": "locker", "mode": "foot", "hazard_exposure": []},
                {"from": "forecourt", "to": "ledger", "mode": "foot", "hazard_exposure": []},
                {"from": "forecourt", "to": "rear_ditch", "mode": "foot", "hazard_exposure": []},
                {"from": "rear_ditch", "to": "retreat_road", "mode": "foot", "hazard_exposure": []},
            ],
            "retreat_path": ["locker", "forecourt", "postern_road", "retreat_road"],
            "safe_route_id": "rt_crown_safe_approach",
        },
        "world_state_actions": [
            {"action_id": "pry_locker", "kind": "salvage", "requires_capabilities": [], "consumes": {}, "one_time": True,
             "effects": ["grant:cap_salvage", "flag:waystation_locker_opened"], "reward_ref": "locker_reward",
             "failure_recovery": "Interrupted interaction commits nothing; retry is idempotent by action_id + poi_id."},
            {"action_id": "seal_ledger", "kind": "access", "requires_capabilities": ["cap_salvage"], "consumes": {}, "one_time": True,
             "effects": ["grant:cap_seal_1", "flag:waystation_seal_recorded"], "reward_ref": "ledger_reward",
             "failure_recovery": "If cap_salvage is missing, prompt points back to locker; no resource loss."},
            {"action_id": "cache_restock", "kind": "salvage", "requires_capabilities": ["cap_salvage"], "consumes": {}, "one_time": False,
             "cooldown_seconds_proposal": 1800, "effects": ["restock:waystation_cache"], "reward_ref": "cache_reward",
             "failure_recovery": "Cooldown is SaveService-keyed; reload does not duplicate restock."},
        ],
        "rewards": [
            {"reward_id": "locker_reward", "policy": "ONE_TIME", "material_keys": ["salvage"], "a3_item_hints": ["iron_scrap", "knowledge_spares"], "capability_grants": ["cap_salvage"], "rarity": "starter"},
            {"reward_id": "ledger_reward", "policy": "ONE_TIME", "material_keys": [], "capability_grants": ["cap_seal_1"], "rarity": "credential"},
            {"reward_id": "cache_reward", "policy": "RENEWABLE_COOLDOWN", "material_keys": ["salvage", "iron"], "a3_item_hints": ["iron_scrap"], "rarity": "common"},
        ],
        "persistence": {"save_owner": "A0", "keys": ["world_mutations[poi_crown_waystation]", "capability_grants[cap_salvage]", "capability_grants[cap_seal_1]"], "one_time_flags": ["waystation_locker_opened", "waystation_seal_recorded"], "static_plan_mutation": False},
        "failure_recovery": {"death": "A0 respawn owns recovery; opened locker/ledger flags persist.", "reload": "One-time rewards are not re-granted; cache cooldown resumes.", "missing_capability": "Environmental clue points to the locker, not an invisible wall."},
        "map_clues": [{"clue_id": "waystation_lantern", "kind": "environmental", "text": "A lit lantern and painted green seal mark the postern road."}, {"clue_id": "waystation_locker", "kind": "interaction", "text": "Pried road locker; salvage tool grammar."}],
        "interface_requirements": [
            {"owner": "A0", "test_id": "A1_POI_WAYSTATION_A0_SAVE", "requirement": "Spawn interactables at authored cells; commit pry_locker/seal_ledger atomically to SaveService; one-time flags survive reload."},
            {"owner": "A3", "test_id": "A1_POI_WAYSTATION_A3_SALVAGE", "requirement": "Resolve salvage material_key to approved iron_scrap/knowledge_spares outputs without renaming A1 source; cache restock uses A3-approved cooldown."},
            {"owner": "A6", "test_id": "A1_POI_WAYSTATION_A6_CLUE", "requirement": "Show lantern/seal map clue and locker/ledger prompts; missing cap_salvage points to locker, not a level wall."},
        ],
        "alternate_approach": "Rear ditch from the forecourt returns to the postern road; it avoids the locker face but does not bypass cap_salvage teaching.",
        "refresh_policy": "Locker and seal ledger are one-time; roadside cache restocks on an A0/A3-approved cooldown.",
    }
    relay = {
        "schema": "soh.world.poi_authoring.v1",
        "poi_id": "poi_crown_relay_shed",
        "content_readiness": READINESS_SPEC,
        "native_playable": False,
        "footprint_radius_tiles": 6,
        "purpose": "First-hour powered relay: hand-crank bypass teaches local power without requiring missing copper item; copper upgrade remains a later sink.",
        "approach_topology": {
            "nodes": [
                {"id": "road_spur", "cell": [424, 224], "kind": "approach"},
                {"id": "yard", "cell": [436, 232], "kind": "safe_yard"},
                {"id": "hand_crank", "cell": [440, 236], "kind": "interaction"},
                {"id": "breaker", "cell": [442, 238], "kind": "interaction"},
                {"id": "cable_trench", "cell": [444, 240], "kind": "alternate"},
                {"id": "retreat_spur", "cell": [424, 224], "kind": "retreat"},
            ],
            "edges": [
                {"from": "road_spur", "to": "yard", "mode": "foot", "hazard_exposure": []},
                {"from": "yard", "to": "hand_crank", "mode": "foot", "hazard_exposure": []},
                {"from": "yard", "to": "breaker", "mode": "foot", "hazard_exposure": []},
                {"from": "yard", "to": "cable_trench", "mode": "foot", "hazard_exposure": []},
                {"from": "cable_trench", "to": "retreat_spur", "mode": "foot", "hazard_exposure": []},
            ],
            "retreat_path": ["hand_crank", "yard", "road_spur", "retreat_spur"],
            "safe_route_id": "rt_crown_safe_approach",
        },
        "world_state_actions": [
            {"action_id": "hand_crank_bypass", "kind": "power", "requires_capabilities": ["cap_salvage"], "consumes": {"salvage": 2, "timber": 1}, "one_time": True,
             "effects": ["grant:cap_power_1", "flag:relay_hand_crank_restored", "power:relay_local_bus"], "reward_ref": "bypass_reward",
             "failure_recovery": "A0 transaction consumes materials and grants power atomically; interruption before commit refunds/not-debits."},
            {"action_id": "breaker_reset", "kind": "power", "requires_capabilities": ["cap_power_1"], "consumes": {}, "one_time": False,
             "cooldown_seconds_proposal": 60, "effects": ["reset:relay_breaker"], "reward_ref": "breaker_reward",
             "failure_recovery": "Overload trips breaker; reset is idempotent and does not re-grant cap_power_1."},
            {"action_id": "copper_upgrade", "kind": "power", "requires_capabilities": ["cap_power_1"], "consumes": {"copper": 2, "salvage": 1}, "one_time": True,
             "effects": ["flag:relay_copper_upgraded", "unlock:relay_cache"], "reward_ref": "upgrade_reward",
             "failure_recovery": "Blocked until A3 copper item exists; UI shows material clue, not a fake wall. First-hour power does not depend on this."},
        ],
        "rewards": [
            {"reward_id": "bypass_reward", "policy": "ONE_TIME", "material_keys": [], "capability_grants": ["cap_power_1"], "rarity": "starter_world_repair"},
            {"reward_id": "breaker_reward", "policy": "STATE_RESET", "material_keys": [], "rarity": "utility"},
            {"reward_id": "upgrade_reward", "policy": "ONE_TIME", "material_keys": ["copper", "salvage"], "a3_item_hints": [], "rarity": "upgrade_pending_A3_copper"},
        ],
        "persistence": {"save_owner": "A0", "keys": ["world_mutations[poi_crown_relay_shed]", "capability_grants[cap_power_1]", "route_unlocks[relay_local_bus]"], "one_time_flags": ["relay_hand_crank_restored", "relay_copper_upgraded"], "static_plan_mutation": False},
        "failure_recovery": {"death": "Restored hand-crank persists; breaker state may reset safely.", "reload": "cap_power_1 is not re-granted; copper upgrade remains locked until A3 item exists.", "missing_capability": "cap_salvage clue points back to Ashen Waystation."},
        "map_clues": [{"clue_id": "relay_dead_lamp", "kind": "environmental", "text": "A dead lamp and copper cable trench point to the shed."}, {"clue_id": "relay_hand_crank", "kind": "interaction", "text": "Hand-crank bypass accepts salvage and timber fuel; copper upgrade is a later repair."}],
        "interface_requirements": [
            {"owner": "A0", "test_id": "A1_POI_RELAY_A0_POWER", "requirement": "Persist relay_local_bus and hand_crank_restored; atomic material debit + cap_power_1 grant; breaker reset survives reload."},
            {"owner": "A3", "test_id": "A1_POI_RELAY_A3_FUEL", "requirement": "Resolve salvage/timber bootstrap costs to approved A3 items; copper upgrade remains MISSING_A3_ITEM until authored, not silently aliased."},
            {"owner": "A6", "test_id": "A1_POI_RELAY_A6_POWER_CLUE", "requirement": "Show dead-lamp/cable clue, hand-crank prompt, and copper-upgrade material gap without implying first-hour power is blocked."},
        ],
        "alternate_approach": "Cable trench from the yard reaches the breaker side and returns to the road spur; it does not bypass the cap_salvage hand-crank lesson.",
        "refresh_policy": "Hand-crank restoration and copper upgrade are one-time world repairs; breaker reset is a reusable utility state.",
    }
    return [waystation, relay]


def apply_poi_readiness(pois):
    specs = {s["poi_id"]: s for s in poi_authoring_specs()}
    for p in pois:
        if p.get("preserved_legacy"):
            p["content_readiness"] = READINESS_LEGACY
            p["authoring_spec_ref"] = None
            continue
        spec = specs.get(p["poi_id"])
        if spec:
            p["content_readiness"] = READINESS_SPEC
            p["authoring_spec_ref"] = f"poi_authoring/{p['poi_id']}.v1.json"
            p["footprint_radius_tiles"] = spec["footprint_radius_tiles"]
            p["alternate_approach"] = spec["alternate_approach"]
            p["refresh_policy"] = spec["refresh_policy"]
            p["access_stages"] = [
                {"stage": "approach", "requires": [], "note": spec["map_clues"][0]["text"]},
                {"stage": "safe_court", "requires": [], "note": "Authored safe court/yard with retreat path; no hazard exposure."},
                {"stage": "interaction", "requires": sorted({c for a in spec["world_state_actions"] if a["one_time"] for c in a["requires_capabilities"]}), "note": "One-time world-state action; see authoring spec."},
                {"stage": "sustain_or_upgrade", "requires": sorted({c for a in spec["world_state_actions"] if not a["one_time"] for c in a["requires_capabilities"]}), "note": "Renewable cache/breaker or later material upgrade; not a first-hour blocker."},
            ]
        else:
            p["content_readiness"] = READINESS_SITE
            p["authoring_spec_ref"] = None
    return pois
