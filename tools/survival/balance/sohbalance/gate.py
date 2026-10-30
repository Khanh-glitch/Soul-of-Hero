"""Vertical integration acceptance gate — source, mount, native and visual are separate.

Round 3's gate could be spoofed: a method name in a comment, a test file or a dead
function all looked like a production call, and a string in a synthetic file could
flip a blocker to PASS. Control Tower rejected that, correctly. This version makes
each claim carry its own evidence class and refuses to promote one into another.

Every link reports:

``source_state``      ABSENT | AUTHORED_ONLY | SCENE_FIXTURE | PRODUCTION_SEAM
``native_evidence``   an id from :mod:`evidence`, resolved to VERIFIED / QUEUED /
                      FAILED / NOT_TESTED / STALE_HEAD
``level``             S0–S5, derived from both, never above S3 without VERIFIED
``blocked``           the link still needs an owner change or a native run

Proof levels:

    S0 ABSENT               nothing implements the link
    S1 AUTHORED_ONLY        A1/A3 data or a contract describes it; no code path
    S2 SCENE_FIXTURE        a native scene demonstrates it with fake state
    S3 PRODUCTION_SEAM      a mounted, live-code seam exists (static proof only)
    S4 NATIVE_VERIFIED      the owning workflow ran green on this commit and the
                            assertion phrase was found in its log
    S5 RELEASE_ACCEPTED     S4 + human visual/feel acceptance

A7 cannot produce S4/S5, so it never reports them: `evidence.state` is the only
door, and every run it reads is pinned to a commit.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Optional, Sequence, Tuple

from . import evidence as evidence_module
from . import gdscan

LEVELS = [
    "S0_ABSENT",
    "S1_AUTHORED_ONLY",
    "S2_SCENE_FIXTURE",
    "S3_PRODUCTION_SEAM",
    "S4_NATIVE_VERIFIED",
    "S5_RELEASE_ACCEPTED",
]
LEVEL_RANK = {name: index for index, name in enumerate(LEVELS)}
STATIC_CEILING = LEVEL_RANK["S3_PRODUCTION_SEAM"]

LEVEL_MEANING = {
    "S0_ABSENT": "the link does not exist",
    "S1_AUTHORED_ONLY": "only authored data or a contract describes it; no code path",
    "S2_SCENE_FIXTURE": "a native scene demonstrates it with fake state",
    "S3_PRODUCTION_SEAM": "a mounted production seam exists; static proof only",
    "S4_NATIVE_VERIFIED": "the owning workflow ran green on this commit with its assertion phrase",
    "S5_RELEASE_ACCEPTED": "S4 plus human visual and feel acceptance",
}

SOURCE_STATES = ("ABSENT", "AUTHORED_ONLY", "SCENE_FIXTURE", "PRODUCTION_SEAM")
SOURCE_LEVEL = {
    "ABSENT": "S0_ABSENT",
    "AUTHORED_ONLY": "S1_AUTHORED_ONLY",
    "SCENE_FIXTURE": "S2_SCENE_FIXTURE",
    "PRODUCTION_SEAM": "S3_PRODUCTION_SEAM",
}

REQUIREMENTS = {
    "L1_ENTRY": "A normal player, with no test flag, can reach the world from the menus.",
    "L2_ROUTE": "The specific interaction is placed in that world and reachable on foot.",
    "L3_INTERACTION": "The interaction is real input on a placed object with player-facing text.",
    "L4_AUTHORIZATION": "Every cost and reward is an A3 item authorized once by the owning contract.",
    "L5_COMMIT": "The reward is committed through SaveService.transact_once with a receipt.",
    "L6_RELOAD": "The committed state survives save/reload in a fresh OS process.",
    "L7_NO_DUPLICATE": "Replaying, reloading or re-entering cannot grant the reward twice.",
    "L8_OUTCOME": "The reward feeds an authored sink (recipe, technology or station kit).",
}

# Exact commands mined from the owners' own workflows. They are what the OWNER runs;
# A7 never runs Godot and never reports their outcome as its own.
NATIVE_COMMANDS = {
    "a0_normal_entry_home": [
        "mkdir -p artifacts/ud_import artifacts/ud_entry",
        "godot --headless --path . --user-data-dir artifacts/ud_import --import",
        "xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 godot --path . --rendering-method gl_compatibility "
        "--rendering-driver opengl3 --audio-driver Dummy --user-data-dir artifacts/ud_entry "
        "--resolution 1280x720 --windowed --script res://tests/survival_normal_entry_home_restart_test.gd",
    ],
    "a0_two_process_reload": [
        "# same user-data dir, a genuinely separate OS process:",
        "xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 godot --path . --rendering-method gl_compatibility "
        "--rendering-driver opengl3 --audio-driver Dummy --user-data-dir artifacts/ud_entry "
        "--resolution 1280x720 --windowed --script res://tests/survival_normal_entry_home_restart_test.gd "
        "-- --verify-separate-process",
        "# PASS requires the log line 'NORMAL ENTRY HOME RESTART PASSED' in BOTH processes",
    ],
    "a8_native_poi_contract": [
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


# ------------------------------------------------------------------ primitives
def _json_of(texts: Dict[str, str], key: str) -> Dict[str, object]:
    raw = texts.get(key)
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _line_of(text: str, needle: str) -> Optional[int]:
    for number, line in enumerate(text.splitlines(), start=1):
        if needle in line:
            return number
    return None


def _link(
    link_id: str,
    owner: str,
    blocker_id: str,
    source_state: str,
    native: Optional[Dict[str, object]],
    evidence_rows: Sequence[Dict[str, object]],
    missing: str = "",
    next_action: str = "",
) -> Dict[str, object]:
    if source_state not in SOURCE_STATES:
        raise ValueError(f"bad source_state {source_state}")
    level = SOURCE_LEVEL[source_state]
    native_state = (native or {}).get("state", evidence_module.NOT_TESTED)
    if native_state == evidence_module.VERIFIED and level == "S3_PRODUCTION_SEAM":
        level = "S4_NATIVE_VERIFIED"
    return {
        "link": link_id,
        "owner": owner,
        "blocker_id": blocker_id,
        "requirement": REQUIREMENTS[link_id],
        "source_state": source_state,
        "native_evidence_id": (native or {}).get("evidence_id"),
        "native_state": native_state,
        "native_run_id": (native or {}).get("run_id"),
        "level": level,
        "rank": LEVEL_RANK[level],
        "statically_verifiable": LEVEL_RANK[level] <= STATIC_CEILING,
        "blocked": bool(missing) or bool((native or {}).get("evidence_id")) and native_state != evidence_module.VERIFIED,
        "evidence": list(evidence_rows),
        "missing": missing,
        "next_action": next_action,
    }


# --------------------------------------------------------------- entry evidence
def entry_routes(texts: Dict[str, str], paths: Dict[str, str]) -> Dict[str, object]:
    """Claim A: a normal menu route to the world exists in source.

    Round 3 searched the home screen for a key literally named "survival" and
    concluded no entry existed. That was wrong: the ordinary route is
    Home hub -> campaign tab -> EnterOverworldButton -> AppFlow.open_overworld.
    """
    tab_gd = texts.get("a0.campaign_tab.gd", "")
    tab_tscn = texts.get("a0.campaign_tab.tscn", "")
    app_flow = texts.get("a0.app_flow.gd", "")
    home = texts.get("a0.home_map_screen.gd", "")
    button_line = _line_of(tab_gd, "EnterOverworldButton")
    connect_line = _line_of(tab_gd, "open_overworld")
    open_handler = _line_of(app_flow, "func open_overworld")
    hub_line = _line_of(home, "campaign")
    route_exists = all(
        row is not None for row in (button_line, connect_line, open_handler, hub_line)
    ) and "EnterOverworldButton" in tab_tscn
    return {
        "claim": "a normal menu route reaches the world with no test flag",
        "route_exists_in_source": route_exists,
        "steps": [
            {"step": "home hub destination 'campaign'", "file": "game/ui/screens/home/home_map_screen.gd", "line": hub_line},
            {"step": "campaign tab button", "file": "game/ui/screens/hub/tabs/campaign_tab.gd", "line": button_line},
            {"step": "button -> AppFlow.open_overworld", "file": "game/ui/screens/hub/tabs/campaign_tab.gd", "line": connect_line},
            {"step": "open_overworld implementation", "file": "game/app/app_flow.gd", "line": open_handler},
            {"step": "button node in the shipped tab scene", "file": "game/ui/screens/hub/tabs/campaign_tab.tscn", "line": _line_of(tab_tscn, "EnterOverworldButton")},
        ],
        "test_flag_required": bool(re.search(r"--[a-z-]+-test", app_flow)),
        "native_test_in_source": "a0.survival_normal_entry_home_restart_test.gd" in texts,
        "note": (
            "The route is the A0 survival overworld (Hollow Marches), not the A1 continent slice: "
            "claim A only says a normal route to the world exists."
        ),
    }


def entry_content(texts: Dict[str, str], tree: Dict[str, set], model) -> Dict[str, object]:
    """Claim C: is the A1 cache / A8 POI actually placed in the reached world?"""
    a1_ids = ("poi_crown_waystation", "node_waystation_cache")
    a8_ids = ("crown_south_quarry", "poi_crown_south_quarry")
    haystacks = {key: text for key, text in texts.items() if key.startswith("a0.")}
    a1_hits = _content_hits(haystacks, a1_ids)
    a8_hits = _content_hits(haystacks, a8_ids)
    overworld = texts.get("a0.chapter1_overworld.tscn", "")
    site_scenes_in_overworld = sorted(
        name
        for name in ("south_quarry.tscn", "south_crown_mill.tscn", "south_orchard_ruin.tscn")
        if name in overworld
    )
    return {
        "claim": "the A1 cache and A8 POI are mounted inside the world the route reaches",
        "a1_instance_references_in_a0_surface": a1_hits,
        "a8_instance_references_in_a0_surface": a8_hits,
        "a8_site_scenes_in_overworld": site_scenes_in_overworld,
        "mounted": bool(a1_hits or a8_hits or site_scenes_in_overworld),
        "note": (
            "Zero references: the route reaches A0's own overworld, and neither the A1 slice nodes nor the A8 "
            "site scenes are placed in it."
        ),
    }


def _content_hits(texts: Dict[str, str], needles: Sequence[str]) -> List[str]:
    """A mapping is only mounted if a live assignment line names it.

    Godot scene files use ``;`` for comments, so a planned-but-absent node written
    in a comment must not count as content.
    """
    hits: List[str] = []
    for key, text in texts.items():
        for number, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith(";") or stripped.startswith("#"):
                continue
            if "=" not in line and "instance=" not in line:
                continue
            if any(needle in line for needle in needles):
                hits.append(f"{key}:{number}")
    return sorted(set(hits))


def native_entry_claims(evidence: Dict[str, object], heads: Dict[str, str]) -> Dict[str, Dict[str, object]]:
    """Resolve every required native assertion for this pin (never guessed)."""
    return evidence_module.states_for(evidence, heads)


# --------------------------------------------------------------- A1/A3 contract
def slice_contract(texts: Dict[str, str]) -> Dict[str, object]:
    doc = _json_of(texts, "a1.handoff_contracts.json")
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
        "atomic_ownership": a3.get("atomic_reward_ownership"),
        "bindings": bindings,
        "rights": rights,
        "cache_request": cache_request,
        "cache_duplicate": cache_duplicate,
        "a0_save_service_ref": a0.get("save_service_ref"),
        "a0_save_service_sha256": a0.get("save_service_sha256"),
        "slice_renewable_cache": [row for row in bindings if row["source_id"] in ("road_scrap", "road_supplies")],
    }


def waystation_spec(texts: Dict[str, str]) -> Dict[str, object]:
    spec = _json_of(texts, "a1.poi_crown_waystation.v1.json")
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


# --------------------------------------------------------------------- A8 side
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


def a8_candidate(texts: Dict[str, str]) -> Dict[str, object]:
    doc = _json_of(texts, "a8.quarry_integration_candidate.v1.json")
    actions = [
        {
            "action_id": row.get("action_id"),
            "item_id": row.get("item_id"),
            "cost_quantity": row.get("cost_quantity"),
            "authorization": row.get("authorization"),
        }
        for row in doc.get("actions", []) or []
    ]
    # Two different gaps: an action that must spend an item with no approved price,
    # and an action whose A3 source is not bound to this POI. They are not the same owner fix.
    unpriced = [
        row
        for row in actions
        if row.get("item_id") and row.get("cost_quantity") is None and "no approved price" in str(row.get("authorization"))
    ]
    unbound = [
        row
        for row in actions
        if row.get("item_id") and "not bound" in str(row.get("authorization"))
    ]
    return {
        "status": doc.get("status"),
        "test_harness_only": (doc.get("a8_scene") or {}).get("test_harness_only"),
        "canonical_instance": doc.get("canonical_instance"),
        "actions": actions,
        "unpriced_actions": unpriced,
        "unbound_source_actions": unbound,
        "source_pins": doc.get("source_pins"),
    }


def a8_authority(texts: Dict[str, str]) -> Dict[str, object]:
    fixture = texts.get("a8.poi_authority_fixture.gd", "")
    site = texts.get("a8.native_poi_site.gd", "")
    pilot = texts.get("a8.poi_pilot.gd", "")
    contract = re.search(r'CONTRACT_ID\s*:=\s*"([^"]+)"', site)
    return {
        "fixture_declares_test_only": "TEST FIXTURE ONLY" in fixture,
        "fixture_keeps_state_in_memory": '"inventory":' in fixture and "FileAccess.open" not in fixture,
        "fixture_uses_save_service": "save_service" in fixture.lower(),
        "site_emits_intent": "signal intent_requested" in site,
        "intent_contract_id": contract.group(1) if contract else None,
        "harness_only_by_default": bool(re.search(r"var test_harness_only\s*:=\s*true", site)),
        "pilot_installs_fixture": ("PoiAuthorityFixture" in pilot) or ("poi_authority_fixture" in pilot),
    }


# ------------------------------------------------------------------- commit seam
def a0_commit_seam(
    texts: Dict[str, str],
    paths: Dict[str, str],
    mount: gdscan.MountGraph,
) -> Dict[str, object]:
    """Where does production code actually commit, and what did the gate reject?

    Every raw textual match is kept in ``rejected`` with the reason it does not
    count, so a spoofed call site is visible rather than silently ignored.
    """
    api_file = "game/autoload/save_service.gd"
    path_to_key = {value: key for key, value in paths.items()}
    corpus = list(texts.values())
    api = texts.get(path_to_key.get(api_file, ""), "")
    callers: List[Dict[str, object]] = []
    rejected: List[Dict[str, object]] = []
    unproven: List[Dict[str, object]] = []
    raw_hits = 0
    for key, text in sorted(texts.items()):
        if "transact_once" not in text:
            continue
        path = paths.get(key, key)
        raw_hits += text.count("transact_once")
        for site in gdscan.call_sites(text, path, "transact_once"):
            row = site.as_dict()
            if site.kind == "has_method":
                rejected.append({**row, "reason": "CAPABILITY_PROBE_NOT_A_CALL"})
                continue
            if not gdscan.is_production_path(path):
                rejected.append({**row, "reason": "NON_PRODUCTION_PATH"})
                continue
            mount_state, _ = mount.state(path)
            row["mount_state"] = mount_state
            if mount_state != gdscan.MOUNTED:
                rejected.append({**row, "reason": f"NOT_MOUNTED_{mount_state}"})
                continue
            referenced = gdscan.function_is_referenced(text, site.function, corpus)
            row["function_referenced"] = referenced
            if not referenced:
                # Cannot see it called anywhere in the pinned surface. That is a
                # scope limit, not proof of dead code, so it is excluded from the
                # proven set and reported separately.
                rejected.append({**row, "reason": "UNREFERENCED_IN_PINNED_SURFACE"})
                unproven.append({**row, "reason": "UNREFERENCED_IN_PINNED_SURFACE"})
                continue
            labels = {ref.split(":", 1)[0] for ref in site.authorisation_refs}
            context = set(site.context)
            row["authorisation"] = sorted(labels)
            row["context"] = sorted(context)
            if {"A1_CONTRACT_KEY", "A1_REWARD_RIGHT", "A1_POI_INSTANCE"} & labels:
                row["classification"] = "MOUNTED_A1_CONTRACT_CALLER"
            elif "A3_ITEM_ID" in labels:
                row["classification"] = "MOUNTED_SURVIVAL_ITEM_CALLER"
            elif {"SURVIVAL_DOCUMENT_MUTATION", "SURVIVAL_ITEM_GRANT"} & context:
                row["classification"] = "MOUNTED_SURVIVAL_SYSTEM_CALLER"
            elif {"CAMPAIGN_REGISTRY", "CAMPAIGN_FALLBACK_KEY"} & labels or "CAMPAIGN_PROGRESSION_MUTATION" in context:
                row["classification"] = "MOUNTED_CAMPAIGN_CALLER"
            else:
                row["classification"] = "MOUNTED_UNCLASSIFIED_CALLER"
            callers.append(row)

    two_process_path = "tests/survival_normal_entry_home_restart_test.gd"
    two_process_key = path_to_key.get(two_process_path, "")
    restart_test = texts.get(two_process_key, "")
    two_process_source = bool(
        "--verify-separate-process" in restart_test
        and "get_cmdline_user_args" in restart_test
        and "ENTRY_HOME_SECOND_PROCESS" in restart_test
    )
    classifications = sorted({str(row["classification"]) for row in callers})
    if any(row["classification"] == "MOUNTED_A1_CONTRACT_CALLER" for row in callers):
        static_state = "MOUNTED_A1_CONTRACT_CALLER"
    elif any(
        row["classification"] in ("MOUNTED_SURVIVAL_ITEM_CALLER", "MOUNTED_SURVIVAL_SYSTEM_CALLER") for row in callers
    ):
        static_state = "MOUNTED_SURVIVAL_SYSTEM_CALLER"
    elif callers:
        static_state = "MOUNTED_NON_SURVIVAL_CALLER"
    else:
        static_state = "API_ONLY"

    return {
        "api": {
            "transact_once_exists": bool(re.search(r"func transact_once\(", api)),
            "receipt_recorded": ("applied_transactions" in api and "is_transaction_applied" in api),
            "replay_rejected": bool(
                re.search(r"if is_transaction_applied\(transaction_key\):\s*\n\s*return false", api)
            ),
            "mount_state": mount.state(api_file)[0],
        },
        "static_state": static_state,
        "classifications": classifications,
        "mounted_callers": callers,
        "mounted_caller_count": len(callers),
        "rejected": rejected,
        "rejected_count": len(rejected),
        "unproven_callers": unproven,
        "unproven_note": (
            "Call sites whose enclosing function is not referenced anywhere in the 45 pinned files. They are "
            "not counted as integration and not called dead: the caller may live in an unpinned file."
        ),
        "raw_token_occurrences": raw_hits,
        "two_process_reload_test_in_source": two_process_source,
        "two_process_test_file": two_process_path if restart_test else None,
    }


# ------------------------------------------------------------------------ sinks
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


# ----------------------------------------------------------------------- chains
def _chain(
    chain_id: str,
    description: str,
    links: List[Dict[str, object]],
) -> Dict[str, object]:
    weakest = min(links, key=lambda row: row["rank"])
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


def waystation_chain(
    model,
    texts: Dict[str, str],
    paths: Dict[str, str],
    facts: Dict[str, object],
    mount: gdscan.MountGraph,
    native: Dict[str, Dict[str, object]],
    entry: Dict[str, object],
    content: Dict[str, object],
    seam: Dict[str, object],
) -> Dict[str, object]:
    contract = slice_contract(texts)
    spec = waystation_spec(texts)
    bindings = contract["slice_renewable_cache"]
    cache_request = contract.get("cache_request") or {}
    entry_native = native["a0_normal_entry_home"]

    links: List[Dict[str, object]] = []
    links.append(
        _link(
            "L1_ENTRY",
            "A0",
            "BLK-1",
            "PRODUCTION_SEAM" if entry["route_exists_in_source"] else "ABSENT",
            entry_native,
            [
                {"fact": "home hub -> campaign -> EnterOverworldButton -> AppFlow.open_overworld", "value": entry["steps"]},
                {"fact": "route requires a test flag", "value": entry["test_flag_required"]},
                {"fact": "native entry run", "value": {k: entry_native.get(k) for k in ("state", "run_id", "head_sha")}},
            ],
            missing=(
                ""
                if entry_native.get("state") == evidence_module.VERIFIED
                else "the route exists in source, but the native run that would prove it executes is "
                + str(entry_native.get("state"))
            ),
            next_action="A0 lands the queued a0-normal-entry-home-restart workflow green on this commit.",
        )
    )
    content_state = "PRODUCTION_SEAM" if content["mounted"] else "AUTHORED_ONLY"
    links.append(
        _link(
            "L2_ROUTE",
            "A0 + A1 + A8",
            "BLK-1",
            content_state,
            None,
            [
                {"fact": "A1 instance ids on the A0 surface", "value": content["a1_instance_references_in_a0_surface"]},
                {"fact": "A8 instance ids on the A0 surface", "value": content["a8_instance_references_in_a0_surface"]},
                {"fact": "A8 site scenes inside the overworld", "value": content["a8_site_scenes_in_overworld"]},
                {"fact": "A1 slice nodes", "value": [row["slice_node_id"] for row in bindings]},
            ],
            missing=(
                ""
                if content["mounted"]
                else "the reachable overworld contains no A1 city node and no A8 site scene, so there is no "
                "walkable route to the interaction yet"
            ),
            next_action=(
                "A0 places ONE A1 slice node (node_waystation_cache at poi_crown_waystation) or the A8 quarry "
                "scene into the existing overworld route; A1 supplies the cell, A8 supplies the scene."
            ),
        )
    )

    cache_action = next((row for row in spec["actions"] if row["action_id"] == "cache_restock"), {})
    links.append(
        _link(
            "L3_INTERACTION",
            "A1",
            "BLK-1",
            "AUTHORED_ONLY",
            None,
            [
                {"fact": "cache action", "value": cache_action},
                {"fact": "spec native_playable", "value": spec.get("native_playable")},
            ],
            missing="the action exists only in authored data; no mounted scene places the cache node",
            next_action="the same mount as L2 also places the interaction node and its input.",
        )
    )

    adoption = facts.get("binding_adoption") or {}
    a3_rows = adoption.get("rows") or []
    adopted = bool(adoption) and not adoption.get("pending_rebind")
    links.append(
        _link(
            "L4_AUTHORIZATION",
            "A3 + A1",
            "BLK-2",
            "PRODUCTION_SEAM" if adopted else "AUTHORED_ONLY",
            None,
            [
                {"fact": "A1-authorized yields", "value": [(row["source_id"], row["yield_per_claim"], row["cooldown_active_seconds"]) for row in bindings]},
                {"fact": "A3 adoption", "value": adoption.get("summary")},
                {"fact": "pending rebind", "value": adoption.get("pending_rebind")},
            ],
            missing=(
                ""
                if adopted
                else "A3 has not adopted A1's binding, so the reward has no physical instance to be paid at"
            ),
            next_action="A3 adopts A1's rebind request (poi_id + instance id only; no quantity change).",
        )
    )

    contract_callers = [row for row in seam["mounted_callers"] if row["classification"] == "MOUNTED_A1_CONTRACT_CALLER"]
    survival_callers = [
        row
        for row in seam["mounted_callers"]
        if row["classification"] in ("MOUNTED_SURVIVAL_ITEM_CALLER", "MOUNTED_SURVIVAL_SYSTEM_CALLER")
    ]
    links.append(
        _link(
            "L5_COMMIT",
            "A0",
            "BLK-4",
            "PRODUCTION_SEAM" if seam["mounted_caller_count"] else "ABSENT",
            native["a0_two_process_reload"],
            [
                {"fact": "SaveService API", "value": seam["api"]},
                {"fact": "static seam state", "value": seam["static_state"]},
                {"fact": "mounted committers", "value": seam["mounted_callers"]},
                {"fact": "rejected call sites", "value": seam["rejected"][:8]},
                {"fact": "A1 contract key", "value": cache_request.get("transaction_key")},
            ],
            missing=(
                ""
                if contract_callers
                else "survival commits are live (harvest/structures/death) and campaign rewards are live, but no "
                "caller is keyed on an A1 contract key: the Waystation cache has no claim path, and A8's POI "
                "still commits through an in-memory fixture ("
                + str(len(survival_callers))
                + " survival callers, 0 A1-contract callers)"
            ),
            next_action=(
                "A0 adds ONE caller keyed on A1's transaction key "
                "('a1slice:poi_crown_waystation:cache_restock:1') that pays the A1 binding through "
                "add_items_to_candidate inside transact_once."
            ),
        )
    )

    links.append(
        _link(
            "L6_RELOAD",
            "A0",
            "BLK-4",
            "PRODUCTION_SEAM" if seam["two_process_reload_test_in_source"] else "AUTHORED_ONLY",
            native["a0_two_process_reload"],
            [
                {"fact": "two-process test in source", "value": seam["two_process_test_file"]},
                {"fact": "native state", "value": {k: native["a0_two_process_reload"].get(k) for k in ("state", "run_id", "head_sha")}},
                {"fact": "phrase required", "value": "NORMAL ENTRY HOME RESTART PASSED in both processes"},
            ],
            missing=(
                ""
                if native["a0_two_process_reload"].get("state") == evidence_module.VERIFIED
                else "a real two-process reload test exists in source, but its native run is "
                + str(native["a0_two_process_reload"].get("state"))
            ),
            next_action="the queued native-entry-restart job must go green; static text cannot substitute.",
        )
    )

    links.append(
        _link(
            "L7_NO_DUPLICATE",
            "A0 + A1",
            "BLK-4",
            "PRODUCTION_SEAM" if seam["api"]["replay_rejected"] else "ABSENT",
            native["a0_two_process_reload"],
            [
                {"fact": "SaveService replay guard", "value": seam["api"]["replay_rejected"]},
                {"fact": "A1 duplicate payload", "value": contract.get("cache_duplicate")},
                {"fact": "one-time rights keys", "value": sorted({r["transaction_key"] for r in contract["rights"] if r.get("transaction_key")})},
            ],
            missing=(
                ""
                if native["a0_two_process_reload"].get("state") == evidence_module.VERIFIED
                else "the guard exists and A1 defines the duplicate outcome, but no native run proves a "
                "second process refuses the replay"
            ),
            next_action="the same native run asserts applied_transactions equality across processes.",
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
            "",
            "PRODUCTION_SEAM" if all(row["useful"] for row in reward_rows) else "AUTHORED_ONLY",
            None,
            [{"fact": "reward outcomes", "value": reward_rows}],
            missing="" if all(row["useful"] for row in reward_rows) else "at least one reward feeds nothing",
            next_action="keep every reward pointed at an authored sink.",
        )
    )
    return _chain("waystation_cache", "A1 vertical-slice cache claim at poi_crown_waystation", links)


def quarry_chain(
    model,
    texts: Dict[str, str],
    paths: Dict[str, str],
    facts: Dict[str, object],
    mount: gdscan.MountGraph,
    native: Dict[str, Dict[str, object]],
    entry: Dict[str, object],
    content: Dict[str, object],
) -> Dict[str, object]:
    sites = a8_sites(texts)
    authority = a8_authority(texts)
    candidate = a8_candidate(texts)
    target = next((site for site in sites if site.get("site_id") == "crown_south_quarry"), sites[0] if sites else {})
    actions = target.get("actions", []) if target else []
    links: List[Dict[str, object]] = []
    links.append(
        _link(
            "L1_ENTRY",
            "A0",
            "BLK-1",
            "PRODUCTION_SEAM" if entry["route_exists_in_source"] else "ABSENT",
            native["a0_normal_entry_home"],
            [{"fact": "route", "value": entry["route_exists_in_source"]}],
            missing=(
                ""
                if native["a0_normal_entry_home"].get("state") == evidence_module.VERIFIED
                else "route exists in source; native run is "
                + str(native["a0_normal_entry_home"].get("state"))
            ),
            next_action="A0 lands the queued native entry workflow green.",
        )
    )
    links.append(
        _link(
            "L2_ROUTE",
            "A1 + A8",
            "BLK-1",
            "PRODUCTION_SEAM" if content["mounted"] else "SCENE_FIXTURE",
            None,
            [
                {"fact": "site", "value": target.get("site_id")},
                {"fact": "candidate status", "value": candidate.get("status")},
                {"fact": "scene is harness-only", "value": candidate.get("test_harness_only")},
                {"fact": "physical instance id", "value": (candidate.get("canonical_instance") or {}).get("physical_instance_id")},
            ],
            missing=(
                ""
                if content["mounted"]
                else "walkable inside its own harness scene only; not placed in the reachable world and it "
                "declares physical_instance_id = null"
            ),
            next_action="A0/A1 resolve the instance identity and mount the scene at the A1 cell.",
        )
    )
    links.append(
        _link(
            "L3_INTERACTION",
            "A8",
            "BLK-1",
            "SCENE_FIXTURE" if authority["site_emits_intent"] else "ABSENT",
            None,
            [
                {"fact": "emits versioned intent", "value": authority["site_emits_intent"]},
                {"fact": "intent contract", "value": authority["intent_contract_id"]},
                {"fact": "harness only", "value": authority["harness_only_by_default"]},
                {"fact": "actions", "value": [a["action_id"] for a in actions]},
            ],
            missing="the interaction only runs inside a test-harness scene",
            next_action="A0 hosts the scene behind the real gameplay input gate.",
        )
    )
    unpriced = candidate.get("unpriced_actions") or []
    unbound = candidate.get("unbound_source_actions") or []
    links.append(
        _link(
            "L4_AUTHORIZATION",
            "A3",
            "BLK-5",
            "ABSENT" if unpriced else "AUTHORED_ONLY",
            None,
            [
                {"fact": "actions with no A3 price", "value": unpriced},
                {"fact": "actions whose A3 source is not bound to this POI", "value": unbound},
                {"fact": "A8's own authorization note", "value": [row.get("authorization") for row in candidate.get("actions", [])]},
                {"fact": "site-declared costs", "value": [(a["action_id"], a["costs"]) for a in actions]},
            ],
            missing=(
                "A8's two route actions have an item id but no authorized quantity, so neither can be paid"
                if unpriced
                else ""
            ),
            next_action="A3 authorizes a quantity for the two route actions (a cost, not a loot rate).",
        )
    )
    links.append(
        _link(
            "L5_COMMIT",
            "A0 + A8",
            "BLK-4",
            "SCENE_FIXTURE" if authority["pilot_installs_fixture"] else "ABSENT",
            native["a0_two_process_reload"],
            [
                {"fact": "pilot installs the fake authority", "value": authority["pilot_installs_fixture"]},
                {"fact": "fixture is test-only", "value": authority["fixture_declares_test_only"]},
                {"fact": "fixture uses SaveService", "value": authority["fixture_uses_save_service"]},
            ],
            missing="a fake authority commits the reward; SaveService is never called on this path",
            next_action="A0/A8 swap the fixture for a SaveService adapter and key the claim on the instance id.",
        )
    )
    links.append(
        _link(
            "L6_RELOAD",
            "A0",
            "BLK-4",
            "ABSENT",
            native["a0_two_process_reload"],
            [{"fact": "fixture persistence", "value": False}],
            missing="site state lives only in fixture memory, so reload cannot preserve anything",
            next_action="after L5.",
        )
    )
    links.append(
        _link(
            "L7_NO_DUPLICATE",
            "A8 + A0",
            "BLK-4",
            "SCENE_FIXTURE",
            None,
            [
                {"fact": "claim policies", "value": sorted({a["claim_policy"] for a in actions if a["claim_policy"]})},
                {"fact": "cooldowns", "value": sorted({a["cooldown_seconds"] for a in actions if a["cooldown_seconds"]})},
            ],
            missing="claims are deduplicated inside the fixture only",
            next_action="key the production transaction on (instance, action, claim generation).",
        )
    )
    reward_items = sorted({item for action in actions for item in action["rewards"]})
    rows = [{"item_id": item, "sinks": sink_for(model, item), "useful": bool(sink_for(model, item))} for item in reward_items]
    links.append(
        _link(
            "L8_OUTCOME",
            "A3",
            "",
            "PRODUCTION_SEAM" if all(row["useful"] for row in rows) and rows else "AUTHORED_ONLY",
            None,
            [{"fact": "reward outcomes", "value": rows}],
            next_action="keep rewards feeding an authored sink.",
        )
    )
    return _chain("a8_quarry", "A8 native South Quarry scene", links)


def _blocked_rollup(chains: List[Dict[str, object]]) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for chain in chains:
        for link in chain["links"]:  # type: ignore[index]
            if not link["blocked"] or not link["blocker_id"]:
                continue
            rows.append(
                {
                    "blocker_id": link["blocker_id"],
                    "chain_id": chain["chain_id"],
                    "link": link["link"],
                    "owner": link["owner"],
                    "level": link["level"],
                    "native_state": link["native_state"],
                    "missing": link["missing"],
                    "next_action": link["next_action"],
                }
            )
    return sorted(rows, key=lambda row: (str(row["blocker_id"]), str(row["chain_id"]), str(row["link"])))


def build(
    model,
    texts: Dict[str, str],
    facts: Dict[str, object],
    manifest: Dict[str, object],
    evidence: Optional[Dict[str, object]] = None,
    paths: Optional[Dict[str, str]] = None,
    tree: Optional[Dict[str, set]] = None,
) -> Dict[str, object]:
    from . import product as product_module

    paths = paths or product_module.path_index(manifest)
    tree = tree or product_module.load_tree(manifest)
    evidence = evidence or {"runs": []}
    heads = {
        "a0": str(manifest.get("a0_head")),
        "a1": str(manifest.get("a1_head")),
        "a6": str(manifest.get("a6_head")),
        "a8": str(manifest.get("a8_head")),
    }
    mount = gdscan.MountGraph.build(texts, paths)

    # L4 needs the adoption verdict, which report.py also publishes. Computing it
    # here keeps the link honest when the gate is built on its own (tests).
    if "binding_adoption" not in facts:
        from .identity import binding_adoption as _adoption

        facts = dict(facts)
        facts["binding_adoption"] = _adoption(model, slice_contract(texts))

    entry = entry_routes(texts, paths)
    content = entry_content(texts, tree, model)
    native = native_entry_claims(evidence, heads)
    seam = a0_commit_seam(texts, paths, mount)

    chains = [
        waystation_chain(model, texts, paths, facts, mount, native, entry, content, seam),
        quarry_chain(model, texts, paths, facts, mount, native, entry, content),
    ]
    native_states = dict(native)
    any_verified = any(row.get("state") == evidence_module.VERIFIED for row in native_states.values())

    claims = {
        "A_route_exists_in_source": {
            "state": "SOURCE_PRESENT" if entry["route_exists_in_source"] else "ABSENT",
            "level": "S3_PRODUCTION_SEAM" if entry["route_exists_in_source"] else "S0_ABSENT",
            "evidence": entry,
        },
        "B_route_runs_in_native_godot": {
            "state": native["a0_normal_entry_home"]["state"],
            "level": "S4_NATIVE_VERIFIED"
            if native["a0_normal_entry_home"]["state"] == evidence_module.VERIFIED
            else "NOT_CLAIMED",
            "evidence": native["a0_normal_entry_home"],
        },
        "C_content_is_mounted": {
            "state": "SOURCE_PRESENT" if content["mounted"] else "ABSENT",
            "level": "S3_PRODUCTION_SEAM" if content["mounted"] else "S0_ABSENT",
            "evidence": content,
        },
        "D_useful_reward_claimable": {
            "state": "SOURCE_PRESENT" if seam["static_state"] == "MOUNTED_A1_CONTRACT_CALLER" else "PARTIAL",
            "level": "S3_PRODUCTION_SEAM" if seam["static_state"] != "API_ONLY" else "S0_ABSENT",
            "evidence": {
                "static_seam_state": seam["static_state"],
                "mounted_callers": seam["mounted_callers"],
                "native_reload_state": native["a0_two_process_reload"]["state"],
            },
        },
    }

    return {
        "schema": "soh.balance.integration_gate.v3",
        "headline": (
            "Normal menu entry to A0's world exists in source; the A1 cache and A8 scene are not mounted in it; "
            "the only committed rewards are campaign progression; no native run has verified any of it."
        ),
        "entry_claims": claims,
        "claim_rule": (
            "A is source existence only. B needs a green native run on this commit. C needs the content inside "
            "the reachable world. D needs a mounted, committed, native-verified claim. No claim promotes another."
        ),
        "chains": chains,
        "blocked_links": _blocked_rollup(chains),
        "blocked_link_count": sum(chain["blocked_links"] for chain in chains),
        "s_levels": [{"level": name, "meaning": LEVEL_MEANING[name]} for name in LEVELS],
        "static_ceiling": LEVELS[STATIC_CEILING],
        "any_native_verified": any_verified,
        "native_states": native_states,
        "what_static_cannot_claim": [
            "S4/S5 require a native Godot run by the owning agent; A7 runs none.",
            "A mounted call site proves the seam exists, not that it compiles or runs.",
            "A native scene that demos with a fixture proves the scene, not the integration.",
        ],
        "native_commands_for_owner": NATIVE_COMMANDS,
        "owner_assertions_for_S4": [
            "entry: the log says NORMAL ENTRY HOME RESTART PASSED in the first process",
            "cost: the exact authorized items are removed once",
            "reward: the exact authorized items are added once",
            "receipt: transact_once recorded exactly one new key",
            "reload: a second process prints ENTRY_HOME_SECOND_PROCESS with equal receipts",
            "no duplicate: replaying the action leaves inventory and receipts unchanged",
            "outcome: the reward is consumed by the named sink",
        ],
        "snapshot_heads": heads,
        "entry": entry,
        "entry_content": content,
        "mount_graph": {
            "pinned_files": len(paths),
            "reachable": sorted(mount.reachable),
            "gate_files": {
                key: mount.explain(path)
                for key, path in sorted(paths.items())
                if path.endswith((".gd", ".tscn")) and key.split(".", 1)[0] in ("a0", "a6", "a8")
            },
        },
        "contract": slice_contract(texts),
        "waystation_spec": waystation_spec(texts),
        "authority_a8": a8_authority(texts),
        "a8_candidate": a8_candidate(texts),
        "a8_sites": a8_sites(texts),
        "commit_seam": seam,
        "evidence": {
            "schema": evidence.get("schema"),
            "runs_recorded": len(evidence.get("runs", []) or []),
            "run_states": sorted(
                {f"{row.get('status')}/{row.get('conclusion') or '-'}" for row in evidence.get("runs", []) or []}
            ),
        },
    }
