"""Vertical integration acceptance gate: is one real action actually working?

A blocker count cannot answer the user's real question. This module walks two
concrete chains over pinned bytes and reports, per link, what exists, what is
fixture-only, and what is missing:

``waystation_cache``  A1's vertical-slice contract: ``cache_restock`` at
                      ``poi_crown_waystation`` paying ``road_scrap`` 3 and
                      ``road_supplies`` 2 on an 1800 s renewable, transaction-keyed
                      reward right. This is the chain A0 has to mount.
``a8_quarry``         A8's native ``crown_south_quarry`` PackedScene paying
                      ``stone_chunk`` 2 through an in-memory fixture authority.

Proof levels, and nothing else:

    S0 ABSENT               nothing implements the link
    S1 AUTHORED_ONLY        A1/A3 data or a contract describes it; no code path
    S2 FIXTURE_ONLY         a native scene demonstrates it with fake state
    S3 OWNER_SEAM_UNWIRED   production owner API exists but nothing calls it here
    S4 NATIVE_COMMITTED     native normal-input commit + reload proven
    S5 FULL_NORMAL_INPUT    S4 + fresh OS process restart + inspected visuals

Static inspection reaches S3 at best. S4/S5 belong to the owning agent's native
run, so this module never reports them: it emits the exact commands that would
produce the evidence and the assertions the owner must add.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Optional, Sequence

LEVELS = [
    "S0_ABSENT",
    "S1_AUTHORED_ONLY",
    "S2_FIXTURE_ONLY",
    "S3_OWNER_SEAM_UNWIRED",
    "S4_NATIVE_COMMITTED",
    "S5_FULL_NORMAL_INPUT",
]
LEVEL_RANK = {name: index for index, name in enumerate(LEVELS)}
STATIC_CEILING = LEVEL_RANK["S3_OWNER_SEAM_UNWIRED"]

LEVEL_MEANING = {
    "S0_ABSENT": "the link does not exist",
    "S1_AUTHORED_ONLY": "only authored data/contracts describe it",
    "S2_FIXTURE_ONLY": "a native scene demonstrates it with fake state",
    "S3_OWNER_SEAM_UNWIRED": "the production owner API exists but is not joined for this action",
    "S4_NATIVE_COMMITTED": "native normal-input commit + reload proven by the owner",
    "S5_FULL_NORMAL_INPUT": "S4 + fresh OS process restart + inspected visual evidence",
}

# Exact commands mined from the owners' own CI workflows.
NATIVE_COMMANDS = {
    "a0_survival_runtime": [
        "godot --headless --path . --user-data-dir artifacts/ud_import --import",
        "godot --path . --rendering-method gl_compatibility --rendering-driver opengl3 "
        "--script res://tests/survival_foundation_test.gd",
    ],
    "a0_slice_mount": [
        "# owner adds one scene that hosts the A1 slice nodes, then:",
        "xvfb-run -a godot --verbose --path . --rendering-method gl_compatibility --rendering-driver opengl3 "
        "--audio-driver Dummy --user-data-dir artifacts/ud_slice --resolution 1280x720 --windowed "
        "--script res://tests/survival_slice_cache_claim_test.gd",
    ],
    "process_restart_reload": [
        "# the ONLY acceptable reload proof is two processes on one user-data dir:",
        "godot --headless --path . --user-data-dir artifacts/ud_loot --script res://tests/survival_slice_claim_commit.gd",
        "godot --headless --path . --user-data-dir artifacts/ud_loot --script res://tests/survival_slice_reload_no_duplicate.gd",
    ],
    "a8_native_contract": [
        "godot --headless --path . --editor --quit",
        "godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd",
    ],
    "a8_native_capture": [
        'xvfb-run -a godot --path . --resolution "1280x720" --rendering-method gl_compatibility '
        "--script tools/survival/world_content/capture_native_pilot.gd -- --width=1280 --height=720 "
        "--output=.artifacts/a8-world-content/pilot-1280x720.png",
    ],
    "a6_composition": [
        "xvfb-run -a godot --verbose --path . --rendering-method gl_compatibility --rendering-driver opengl3 "
        "--audio-driver Dummy --user-data-dir artifacts/ud_a6 --resolution 960x540 --windowed "
        "--script res://tests/survival_a6_modal_composition_test.gd",
    ],
}

REQUIREMENTS = {
    "L1_ENTRY": "A normal player, with no test flag, can reach the survival world from the home screen.",
    "L2_ROUTE": "A physically walkable route connects the entry point to the interaction stand.",
    "L3_INTERACTION": "The interaction is a real input on a placed object with player-facing text.",
    "L4_AUTHORIZATION": "Every cost and reward is an A3 item, authorized once by the owning contract.",
    "L5_COMMIT": "The reward is committed through SaveService.transact_once with a receipt.",
    "L6_RELOAD": "The committed state survives a save/reload in a fresh OS process.",
    "L7_NO_DUPLICATE": "Replaying, reloading or re-entering cannot grant the reward twice.",
    "L8_OUTCOME": "The reward feeds an authored sink (recipe, technology or station kit).",
}


def _link(link_id, owner, level, evidence, missing="", next_action="") -> Dict[str, object]:
    if level not in LEVEL_RANK:
        raise ValueError(f"unknown proof level {level}")
    return {
        "link": link_id,
        "owner": owner,
        "requirement": REQUIREMENTS[link_id],
        "level": level,
        "rank": LEVEL_RANK[level],
        "blocked": bool(missing),
        "statically_verifiable": LEVEL_RANK[level] <= STATIC_CEILING,
        "evidence": evidence,
        "missing": missing,
        "next_action": next_action,
    }


def _json(texts: Dict[str, str], key: str) -> Dict[str, object]:
    raw = texts.get(key)
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def survival_entry(facts: Dict[str, object], texts: Dict[str, str]) -> Dict[str, object]:
    app_root = texts.get("a0.app_root.gd", "")
    return {
        "home_keys": list(facts.get("home_function_keys") or []),
        "survival_keys": list(facts.get("home_survival_keys") or []),
        "app_root_has_test_only_entries": bool(re.search(r"--[a-z-]+-test", app_root)),
        "app_root_direct_game_scene": bool(re.search(r"DIRECT_GAME_SCENE", app_root)),
    }


def slice_contract(texts: Dict[str, str]) -> Dict[str, object]:
    """A1's first-hour handoff contract: reward rights, bindings and transaction keys."""
    doc = _json(texts, "a1.handoff_contracts.json")
    a3 = doc.get("a3", {}) if isinstance(doc.get("a3"), dict) else {}
    bindings = []
    for row in a3.get("source_bindings", []) or []:
        bindings.append(
            {
                "source_id": row.get("source_id"),
                "item_id": row.get("item_id"),
                "poi_id": row.get("poi_id"),
                "slice_node_id": row.get("slice_node_id"),
                "yield_per_claim": row.get("yield_per_claim"),
                "renewable": row.get("renewable"),
                "cooldown_active_seconds": row.get("cooldown_active_seconds"),
                "binding_request": row.get("binding_request"),
            }
        )
    rights = []
    for row in a3.get("one_time_reward_rights", []) or []:
        rights.append(
            {
                "action_id": row.get("action_id"),
                "poi_id": row.get("poi_id"),
                "reward_right_id": row.get("reward_right_id"),
                "transaction_key": row.get("transaction_key"),
                "consumes_items": row.get("consumes_items") or {},
                "grants_capabilities": row.get("grants_capabilities") or [],
                "item_rewards": row.get("item_rewards") or [],
            }
        )
    payloads = a3.get("payload_examples", {}) or {}
    cache_request = (payloads.get("reward_grant_request") or {}) if isinstance(payloads, dict) else {}
    cache_duplicate = (payloads.get("reward_grant_duplicate") or {}) if isinstance(payloads, dict) else {}
    a0 = doc.get("a0", {}) if isinstance(doc.get("a0"), dict) else {}
    return {
        "native_playable": doc.get("native_playable"),
        "items_pinned_by_a3": bool(a3.get("items_sha256")),
        "atomic_ownership": a3.get("atomic_reward_ownership"),
        "bindings": bindings,
        "rights": rights,
        "cache_request": cache_request,
        "cache_duplicate": cache_duplicate,
        "a0_save_service_ref": a0.get("save_service_ref"),
        "a0_save_service_sha256": a0.get("save_service_sha256"),
        "a0_payload_examples": sorted((a0.get("payload_examples") or {}).keys()),
        "a0_activation_contract_present": bool(a0.get("activation_contract")),
        "slice_renewable_cache": [
            row for row in bindings if row["source_id"] in ("road_scrap", "road_supplies")
        ],
    }


def waystation_spec(texts: Dict[str, str]) -> Dict[str, object]:
    spec = _json(texts, "a1.poi_crown_waystation.v1.json")
    return {
        "native_playable": spec.get("native_playable"),
        "content_readiness": spec.get("content_readiness"),
        "actions": [
            {
                "action_id": row.get("action_id"),
                "one_time": row.get("one_time"),
                "requires_capabilities": row.get("requires_capabilities") or [],
                "effects": row.get("effects") or [],
                "consumes": row.get("consumes") or {},
                "cooldown_seconds_proposal": row.get("cooldown_seconds_proposal"),
            }
            for row in spec.get("world_state_actions", []) or []
        ],
        "rewards": [
            {
                "reward_id": row.get("reward_id"),
                "policy": row.get("policy"),
                "a3_item_hints": row.get("a3_item_hints") or [],
                "capability_grants": row.get("capability_grants") or [],
            }
            for row in spec.get("rewards", []) or []
        ],
    }


def a8_sites(texts: Dict[str, str]) -> List[Dict[str, object]]:
    sites: List[Dict[str, object]] = []
    for key, text in sorted(texts.items()):
        if not (key.startswith("a8.south_") and key.endswith(".json")):
            continue
        try:
            payload = json.loads(text)
        except Exception:
            continue
        actions = []
        for group in ("actions", "choices"):
            for action in payload.get(group) or []:
                actions.append(
                    {
                        "action_id": action.get("action_id"),
                        "group": group,
                        "costs": action.get("costs") or {},
                        "rewards": action.get("rewards") or {},
                        "claim_policy": action.get("claim_policy"),
                        "cooldown_seconds": action.get("cooldown_seconds"),
                        "catalog_source": action.get("catalog_source", ""),
                        "a3_authorization_absent": "A3 cost authorization absent" in str(action.get("catalog_source", "")),
                    }
                )
        sites.append(
            {
                "key": key,
                "site_id": payload.get("site_id"),
                "poi_id": (payload.get("source") or {}).get("poi_id"),
                "has_spawn": "spawn" in payload,
                "has_approach_stand": "approach_stand" in payload,
                "wall_segments": len(payload.get("walls") or []),
                "actions": actions,
            }
        )
    return sites


def a8_authority(texts: Dict[str, str]) -> Dict[str, object]:
    fixture = texts.get("a8.poi_authority_fixture.gd", "")
    site = texts.get("a8.native_poi_site.gd", "")
    pilot = texts.get("a8.poi_pilot.gd", "")
    contract = _find_group(site, r'CONTRACT_ID\s*:=\s*"([^"]+)"')
    return {
        "fixture_declares_test_only": "TEST FIXTURE ONLY" in fixture,
        "fixture_keeps_state_in_memory": '"inventory":' in fixture and "FileAccess.open" not in fixture,
        "fixture_uses_save_service": "save_service" in fixture.lower(),
        "site_emits_intent": "signal intent_requested" in site,
        "intent_contract_id": contract,
        "harness_only_by_default": bool(re.search(r"var test_harness_only\s*:=\s*true", site)),
        "pilot_installs_fixture": ("PoiAuthorityFixture" in pilot) or ("poi_authority_fixture" in pilot),
    }


def _find_group(text: str, pattern: str) -> Optional[str]:
    match = re.search(pattern, text, re.MULTILINE)
    return match.group(1) if match else None


def a0_commit_seam(texts: Dict[str, str]) -> Dict[str, object]:
    save = texts.get("a0.save_service.gd", "")
    survival = texts.get("a0.survival_service.gd", "")
    return {
        "transact_once_exists": bool(re.search(r"func transact_once\(", save)),
        "receipt_recorded": ("applied_transactions" in save and "is_transaction_applied" in save),
        "replay_rejected": bool(
            re.search(r"if is_transaction_applied\(transaction_key\):\s*\n\s*return false", save)
        ),
        "survival_service_uses_transact_once": bool(re.search(r"transact_once\(", survival)),
        "any_poi_calls_transact_once": any(
            "transact_once(" in text
            for key, text in texts.items()
            if key.startswith(("a8.", "a6."))
        ),
        # A reload claim only counts when something actually starts a second OS
        # process; reusing one process cannot prove durable restore.
        "two_process_reload_test": any(
            ("create_process" in text or "OS.execute" in text or "TWO_PROCESS" in text)
            and "transaction" in text.lower()
            for text in texts.values()
        ),
    }


def sink_for(model, item_id: str) -> List[str]:
    sinks: List[str] = []
    for recipe_id, recipe in model.recipes.items():
        if item_id in (recipe.get("inputs") or {}):
            sinks.append(f"recipe:{recipe_id}")
        if item_id in (recipe.get("outputs") or {}):
            sinks.append(f"produced_by:{recipe_id}")
        if item_id in (recipe.get("fuel") or {}):
            sinks.append(f"fuel:{recipe_id}")
    for tech_id, tech in model.technologies.items():
        if item_id in (tech.get("inputs") or {}):
            sinks.append(f"technology:{tech_id}")
    for station_id, station in model.stations.items():
        if station.get("kit") == item_id:
            sinks.append(f"station_kit:{station_id}")
    return sorted(sinks)


def _entry_link(entry: Dict[str, object], owner: str = "A0") -> Dict[str, object]:
    if entry["survival_keys"]:
        return _link(
            "L1_ENTRY",
            owner,
            "S3_OWNER_SEAM_UNWIRED",
            [{"fact": "home destinations", "value": entry["home_keys"]}],
            next_action="verify the destination with normal input",
        )
    return _link(
        "L1_ENTRY",
        owner,
        "S0_ABSENT",
        [
            {"fact": "home destinations", "value": entry["home_keys"]},
            {"fact": "survival-like keys", "value": []},
            {"fact": "app root ships test-only entry flags", "value": entry["app_root_has_test_only_entries"]},
        ],
        missing=(
            "no home-screen destination reaches a survival/world/POI scene; the only entries into a world are "
            "test flags, which is exactly the 'looks integrated but is not' failure"
        ),
        next_action=(
            "A0 adds ONE home destination that hosts the existing world layer, then runs the composition "
            "workflow with normal input (no test flag)."
        ),
    )


def waystation_chain(model, texts, facts, manifest) -> Dict[str, object]:
    entry = survival_entry(facts, texts)
    contract = slice_contract(texts)
    spec = waystation_spec(texts)
    seam = a0_commit_seam(texts)
    bindings = contract["slice_renewable_cache"]
    cache_request = contract.get("cache_request") or {}
    cache_duplicate = contract.get("cache_duplicate") or {}

    links = [_entry_link(entry)]

    route_ids = [
        route.get("route_id")
        for route in (model.graph_doc.get("routes") or [])
        if route.get("route_id") in ("rt_crown_safe_approach", "rt_crown_buffer", "rt_south_seam")
    ]
    links.append(
        _link(
            "L2_ROUTE",
            "A1",
            "S1_AUTHORED_ONLY",
            [
                {"fact": "authored safe routes to the waystation", "value": sorted(route_ids)},
                {"fact": "slice node ids for the cache", "value": sorted({b["slice_node_id"] for b in bindings})},
                {"fact": "world geography is native", "value": bool(spec.get("native_playable"))},
            ],
            missing="the route is authored geometry; nothing native draws or collides it yet",
            next_action="A0 mounts the A1 slice chunk; A1 confirms traversal with the native world probe.",
        )
    )

    cache_action = next((row for row in spec["actions"] if row["action_id"] == "cache_restock"), {})
    links.append(
        _link(
            "L3_INTERACTION",
            "A1",
            "S1_AUTHORED_ONLY",
            [
                {"fact": "cache action", "value": cache_action},
                {"fact": "requires capability", "value": cache_action.get("requires_capabilities")},
                {"fact": "cooldown (active seconds)", "value": cache_action.get("cooldown_seconds_proposal")},
                {"fact": "spec native_playable", "value": spec.get("native_playable")},
            ],
            missing="the action exists only in authored data; no scene places the cache node",
            next_action="A0 spawns the cache node at its authored cell and binds the interact input.",
        )
    )

    authorized = bool(bindings) and all(b.get("yield_per_claim") for b in bindings)
    a3_adopted = [
        source_id
        for source_id, source in model.sources.items()
        if source.get("poi_id") and str(source.get("poi_id")).startswith("poi_crown_waystation")
    ]
    links.append(
        _link(
            "L4_AUTHORIZATION",
            "A3 + A1",
            "S1_AUTHORED_ONLY" if authorized else "S0_ABSENT",
            [
                {
                    "fact": "A1-authorized bindings",
                    "value": [
                        {
                            "source_id": b["source_id"],
                            "item_id": b["item_id"],
                            "yield": b["yield_per_claim"],
                            "renewable": b["renewable"],
                            "cooldown": b["cooldown_active_seconds"],
                        }
                        for b in bindings
                    ],
                },
                {"fact": "reward right", "value": contract.get("rights") and "rr_waystation_cache_claim"},
                {"fact": "A3 source rows already pointing at the waystation", "value": a3_adopted},
                {"fact": "atomic ownership statement", "value": contract.get("atomic_ownership")},
            ],
            missing=(
                "A1 authorizes the reward and its quantity, but A3's source rows still name the provisional "
                "class id 'poi:roadside_cache', so the adopted binding count is 0"
            ),
            next_action=(
                "A3 adopts the A1 rebind for the two rows (road_scrap, road_supplies): point poi_id at "
                "poi_crown_waystation and keep A1's 3/2 yields. This is a binding edit, not a rate change."
            ),
        )
    )

    links.append(
        _link(
            "L5_COMMIT",
            "A0",
            "S3_OWNER_SEAM_UNWIRED" if seam["transact_once_exists"] else "S0_ABSENT",
            [
                {"fact": "SaveService.transact_once exists", "value": seam["transact_once_exists"]},
                {"fact": "receipt persisted in the save document", "value": seam["receipt_recorded"]},
                {"fact": "A1 names the save service and its hash", "value": [contract.get("a0_save_service_ref"), contract.get("a0_save_service_sha256")]},
                {"fact": "transaction key in the contract", "value": cache_request.get("transaction_key")},
                {"fact": "any POI/A6 path calls transact_once", "value": seam["any_poi_calls_transact_once"]},
            ],
            missing=(
                ""
                if seam["any_poi_calls_transact_once"]
                else "the owner API and the contract key exist, but no mounted path calls them, so the reward "
                "has never been committed by a player action"
            ),
            next_action="A0 wires the cache claim to transact_once with the contract's transaction key.",
        )
    )

    links.append(
        _link(
            "L6_RELOAD",
            "A0",
            "S3_OWNER_SEAM_UNWIRED" if seam["receipt_recorded"] else "S0_ABSENT",
            [
                {"fact": "receipts live inside the committed document", "value": seam["receipt_recorded"]},
                {"fact": "documented reload behaviour", "value": "cooldown is SaveService-keyed; reload does not duplicate restock"},
                {"fact": "two-process restart evidence", "value": False},
            ],
            missing=(
                ""
                if seam["two_process_reload_test"]
                else "no evidence anywhere restarts the OS process; A0's existing reload check reuses one "
                "process, which cannot prove durable restore"
            ),
            next_action="A0 adds the two-process test below; S4 requires both runs green.",
        )
    )

    links.append(
        _link(
            "L7_NO_DUPLICATE",
            "A0 + A1",
            "S3_OWNER_SEAM_UNWIRED" if seam["replay_rejected"] else "S0_ABSENT",
            [
                {"fact": "SaveService rejects an applied key", "value": seam["replay_rejected"]},
                {"fact": "contract duplicate payload", "value": cache_duplicate},
                {"fact": "contract request payload", "value": cache_request},
                {"fact": "one-time rights carry transaction keys", "value": sorted({r["transaction_key"] for r in contract["rights"] if r.get("transaction_key")})},
            ],
            missing=(
                ""
                if seam["two_process_reload_test"] and seam["any_poi_calls_transact_once"]
                else "the pieces exist on both sides but are not joined, so nothing is protected at runtime yet"
            ),
            next_action="A0 keys the claim on the contract transaction key and asserts ALREADY_APPLIED on replay.",
        )
    )

    reward_rows = []
    for binding in bindings:
        sinks = sink_for(model, str(binding["item_id"]))
        reward_rows.append({"item_id": binding["item_id"], "sinks": sinks, "useful": bool(sinks)})
    links.append(
        _link(
            "L8_OUTCOME",
            "A3",
            "S1_AUTHORED_ONLY" if any(row["useful"] for row in reward_rows) else "S0_ABSENT",
            [{"fact": "reward outcomes", "value": reward_rows}],
            missing="" if any(row["useful"] for row in reward_rows) else "the rewards feed nothing",
            next_action="A3 confirms the sinks are reachable in the first hour (research_kit is the natural one).",
        )
    )

    return _chain(
        "waystation_cache",
        "A1 vertical-slice cache claim at poi_crown_waystation",
        links,
        {1: "BLK-1", 2: "BLK-1", 3: "BLK-1", 4: "BLK-2", 5: "BLK-4", 6: "BLK-4", 7: "BLK-4"},
    )


def quarry_chain(model, texts, facts, manifest) -> Dict[str, object]:
    entry = survival_entry(facts, texts)
    sites = a8_sites(texts)
    authority = a8_authority(texts)
    seam = a0_commit_seam(texts)
    target = next((site for site in sites if site.get("site_id") == "crown_south_quarry"), sites[0] if sites else {})
    actions = target.get("actions", []) if target else []

    links = [_entry_link(entry)]
    links.append(
        _link(
            "L2_ROUTE",
            "A1 + A8",
            "S2_FIXTURE_ONLY" if target.get("has_spawn") and target.get("has_approach_stand") else "S1_AUTHORED_ONLY",
            [
                {"fact": "site", "value": target.get("site_id")},
                {"fact": "A1 poi anchor", "value": target.get("poi_id")},
                {"fact": "spawn / approach stand / wall segments", "value": [target.get("has_spawn"), target.get("has_approach_stand"), target.get("wall_segments")]},
            ],
            missing="walkable inside the scene, but the scene is not placed in the A1 world graph",
            next_action="A1 places the scene at its anchor; A0 mounts it.",
        )
    )
    links.append(
        _link(
            "L3_INTERACTION",
            "A8",
            "S2_FIXTURE_ONLY" if authority["site_emits_intent"] else "S0_ABSENT",
            [
                {"fact": "emits versioned intent", "value": authority["site_emits_intent"]},
                {"fact": "intent contract", "value": authority["intent_contract_id"]},
                {"fact": "harness-only by default", "value": authority["harness_only_by_default"]},
                {"fact": "actions", "value": [a["action_id"] for a in actions]},
            ],
            missing="the interaction exists only in a test-harness scene",
            next_action="A0 hosts the scene behind the real gameplay input gate.",
        )
    )
    unauthorized = [
        action["action_id"]
        for action in actions
        if action["a3_authorization_absent"]
        or any(
            item not in model.items
            for item in list(action["costs"]) + list(action["rewards"])
        )
    ]
    links.append(
        _link(
            "L4_AUTHORIZATION",
            "A3 + A8",
            "S1_AUTHORED_ONLY" if not unauthorized else "S0_ABSENT",
            [
                {"fact": "actions without A3 authorization", "value": unauthorized},
                {"fact": "loot tables used by these sites", "value": []},
                {"fact": "note", "value": "site declares 'A3 cost authorization absent' in its own catalog_source"},
            ],
            missing="the site pays fixed quantities it declares itself; A3 never authorized them",
            next_action="A3 authorizes each cost/reward, or A8 defers to the authored table (roadside_cache already pays these items).",
        )
    )
    links.append(
        _link(
            "L5_COMMIT",
            "A0 + A8",
            "S3_OWNER_SEAM_UNWIRED" if seam["transact_once_exists"] else "S2_FIXTURE_ONLY",
            [
                {"fact": "pilot installs the fake authority", "value": authority["pilot_installs_fixture"]},
                {"fact": "fixture declares itself test-only", "value": authority["fixture_declares_test_only"]},
                {"fact": "fixture keeps state in memory", "value": authority["fixture_keeps_state_in_memory"]},
                {"fact": "SaveService.transact_once exists", "value": seam["transact_once_exists"]},
            ],
            missing=(
                ""
                if seam["any_poi_calls_transact_once"]
                else "a fake authority commits the reward; SaveService is never called"
            ),
            next_action="A0 swaps the fixture for a SaveService adapter; the fixture stays in tests.",
        )
    )
    links.append(
        _link(
            "L6_RELOAD",
            "A0",
            "S0_ABSENT",
            [
                {"fact": "fixture persists to disk", "value": False},
                {"fact": "two-process evidence", "value": False},
            ],
            missing=(
                ""
                if seam["two_process_reload_test"]
                else "site state lives only in fixture memory, so reload cannot preserve anything"
            ),
            next_action="after L5, run the two-process test.",
        )
    )
    links.append(
        _link(
            "L7_NO_DUPLICATE",
            "A8 + A0",
            "S2_FIXTURE_ONLY",
            [
                {"fact": "claim policies", "value": sorted({a["claim_policy"] for a in actions if a["claim_policy"]})},
                {"fact": "cooldowns", "value": sorted({a["cooldown_seconds"] for a in actions if a["cooldown_seconds"]})},
                {"fact": "fixture claim generation tracked", "value": True},
            ],
            missing=(
                ""
                if seam["two_process_reload_test"] and seam["any_poi_calls_transact_once"]
                else "claims are deduplicated inside the fixture only"
            ),
            next_action="key the production transaction on (site, action, claim generation).",
        )
    )
    reward_items = sorted({item for action in actions for item in action["rewards"]})
    rows = [{"item_id": item, "sinks": sink_for(model, item), "useful": bool(sink_for(model, item))} for item in reward_items]
    links.append(
        _link(
            "L8_OUTCOME",
            "A3",
            "S1_AUTHORED_ONLY" if any(row["useful"] for row in rows) else "S0_ABSENT",
            [{"fact": "reward outcomes", "value": rows}],
            next_action="keep rewards feeding an authored sink.",
        )
    )
    return _chain(
        "a8_quarry",
        "A8 native South Quarry PackedScene",
        links,
        {1: "BLK-1", 2: "BLK-1", 3: "BLK-1", 4: "BLK-2", 5: "BLK-4", 6: "BLK-4", 7: "BLK-4"},
    )


def _chain(
    chain_id: str,
    description: str,
    links: List[Dict[str, object]],
    blocker_for_link: Optional[Dict[int, str]] = None,
) -> Dict[str, object]:
    weakest = min(links, key=lambda row: row["rank"])
    blocker_map = blocker_for_link or {}
    for index, row in enumerate(links, start=1):
        row["blocker_id"] = blocker_map.get(index, "")
    return {
        "chain_id": chain_id,
        "description": description,
        "links": links,
        "blocked_links": sum(1 for row in links if row["blocked"]),
        "chain_level": weakest["level"],
        "chain_meaning": LEVEL_MEANING[weakest["level"]],
        "weakest_link": weakest["link"],
        "blocking_next_action": weakest["next_action"],
    }


def _blocked_by_owner(chains: List[Dict[str, object]]) -> List[Dict[str, object]]:
    """Every link that still needs an owner edit, grouped by the blocker it explains."""
    rows: List[Dict[str, object]] = []
    for chain in chains:
        for link in chain["links"]:  # type: ignore[index]
            if not link["blocked"]:
                continue
            rows.append(
                {
                    "blocker_id": link["blocker_id"] or "UNASSIGNED",
                    "chain_id": chain["chain_id"],
                    "link": link["link"],
                    "owner": link["owner"],
                    "level": link["level"],
                    "missing": link["missing"],
                    "next_action": link["next_action"],
                }
            )
    return sorted(rows, key=lambda row: (row["blocker_id"], row["chain_id"], row["link"]))


def build(model, texts: Dict[str, str], facts: Dict[str, object], manifest: Dict[str, object]) -> Dict[str, object]:
    chains = [
        waystation_chain(model, texts, facts, manifest),
        quarry_chain(model, texts, facts, manifest),
    ]
    overall = min(chains, key=lambda c: LEVEL_RANK[c["chain_level"]])
    return {
        "schema": "soh.balance.integration_gate.v2",
        "headline": (
            f"Best real chain is {overall['chain_id']} at {overall['chain_level']}; "
            "no chain reaches a committed, reloadable, non-duplicating player action."
        ),
        "chains": chains,
        "overall_level": overall["chain_level"],
        "overall_meaning": LEVEL_MEANING[overall["chain_level"]],
        "s_levels": [{"level": name, "meaning": LEVEL_MEANING[name]} for name in LEVELS],
        "static_ceiling": LEVELS[STATIC_CEILING],
        "what_static_cannot_claim": [
            "S4/S5 require a native Godot run with normal input by the owning agent.",
            "A7 runs no Godot here; nothing above S3 is reported and no native PASS is implied.",
        ],
        "native_commands_for_owner": NATIVE_COMMANDS,
        "owner_assertions_for_S4": [
            "entry: reaches the site with no test flag and no console error",
            "cost: the exact authorized items are removed once",
            "reward: the exact authorized items are added once",
            "receipt: transact_once returned true and recorded exactly one key",
            "reload: a second process reads the committed state",
            "no duplicate: replaying the action leaves inventory unchanged",
            "outcome: the reward is consumed by the named sink",
        ],
        "blocked_links": _blocked_by_owner(chains),
        "blocked_link_count": sum(chain["blocked_links"] for chain in chains),
        "snapshot_heads": {
            "a0": manifest.get("a0_head"),
            "a1": manifest.get("a1_head"),
            "a6": manifest.get("a6_head"),
            "a8": manifest.get("a8_head"),
            "a8_task": manifest.get("a8_task_head"),
        },
        "contract": slice_contract(texts),
        "authority_a8": a8_authority(texts),
        "commit_seam": a0_commit_seam(texts),
        "entry": survival_entry(facts, texts),
        "waystation_spec": waystation_spec(texts),
        "a8_sites": a8_sites(texts),
    }
