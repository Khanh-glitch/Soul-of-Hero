#!/usr/bin/env python3
"""Generate the versioned A3 -> A0 adoption contract from the real tree.

Every hash in the emitted document is computed from the working tree, so A0 can
verify that the files it composes are exactly the files A3 tested. Re-run after
any change to an A3 economy file:

    python tools/survival/economy/a3_adoption_contract.py

The document deliberately says OWNER_NATIVE (or OWNER_NATIVE_PENDING) and never
PRODUCT_COMPOSED_PASS: composition and product acceptance belong to A0/A7.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs/survival/economy/A0_ADOPTION_CONTRACT_V2.json"

COMPOSE = [
    ("game/survival/economy/economy_service.gd", "canonical V5-V7 economy service: queue, escrow, time receipt, research, world_action, ownership audit", "REPLACE_ANY_A0_VENDORED_FORK"),
    ("game/survival/economy/offline_operation_planner.gd", "V6 prepared-operation planner (armed custody, A0 offline projection)", "INCLUDE"),
    ("game/survival/economy/meta_economy_planner.gd", "V7 two-layer meta economy planner", "INCLUDE"),
    ("game/survival/economy/world_source_adapter.gd", "A1 world binding validation used by world_action", "INCLUDE"),
    ("game/survival/economy/a3_economy_service.gd", "R13 physical source custody + discovery + route projections; delegates queue/knowledge/clock", "INSTANTIATE_AFTER_CANONICAL"),
    ("data/survival/items/items.json", "A3 item catalog (58 items incl. ordinary quarry_core_fragment)", "INCLUDE"),
    ("data/survival/items/sources.json", "A3 source records", "INCLUDE"),
    ("data/survival/items/world_source_bindings.v3.json", "five pinned A1 bindings used for physical source identity", "INCLUDE_AND_PIN"),
    ("data/survival/items/loot_tables.json", "loot tables referenced by bindings", "INCLUDE"),
    ("data/survival/recipes/recipes.json", "38 recipes incl. the two material-route recipes", "INCLUDE"),
    ("data/survival/recipes/stations.json", "station kinds/tiers/queue capacity", "INCLUDE"),
    ("data/survival/recipes/research.json", "technologies for the research prerequisite chain", "INCLUDE"),
    ("data/survival/recipes/offline_operations.v1.json", "V6 offline operation policy", "INCLUDE"),
    ("data/survival/recipes/meta_economy.v1.json", "V7 meta economy policy", "INCLUDE"),
    ("data/survival/recipes/recipe.schema.json", "recipe schema", "INCLUDE"),
    ("data/survival/recipes/research.schema.json", "research schema", "INCLUDE"),
    ("data/survival/recipes/meta_economy.schema.json", "meta schema", "INCLUDE"),
    ("data/content/items/item_catalog.tres", "SOUL StackItemCatalog incl. the nine R13 items", "INCLUDE"),
    ("data/content/items/roadside_oak_scrap.tres", "R13 item resource", "INCLUDE"),
    ("data/content/items/roadside_stone_chip.tres", "R13 item resource", "INCLUDE"),
    ("data/content/items/roadside_iron_scrap.tres", "R13 item resource", "INCLUDE"),
    ("data/content/items/knowledge_spare.tres", "R13 item resource (physical research/fuel item)", "INCLUDE"),
    ("data/content/items/quarry_sample.tres", "R13 item resource (specimen)", "INCLUDE"),
    ("data/content/items/quarry_core_fragment.tres", "R13 item resource (ordinary material)", "INCLUDE"),
    ("data/content/items/salvage_kit_blueprint.tres", "R13 item resource (blueprint)", "INCLUDE"),
    ("tests/survival/a3_value_economy_test.gd", "R13 native suite: two-process receipts + negative controls", "RUN_AS_GATE"),
    ("tests/survival/catalog/economy_adapter_test.gd", "V5-V7 canonical adapter regression", "RUN_AS_GATE"),
    ("tools/ci/gd_r13_static_check.py", "static hazard gate (Variant inference, duplicate var, second authority)", "RUN_AS_GATE"),
    ("tools/ci/verify_r13_receipts.py", "two-process receipt verifier", "RUN_AS_GATE"),
]

REJECT = [
    ("game/survival/economy/roadside_source.gd", "REMOVED", "fabricated source ids (roadside_oak_1 ...) that exist in no A1 binding; superseded by the pinned A1 binding document"),
    ("game/survival/economy/quarry_source.gd", "REMOVED", "fabricated quarry_deep_1 source id; Quarry is closed by the A8 REJECTED authorization"),
]

REMOVED_SAVE_KEYS = [
    "mastery.a3_station_jobs",
    "mastery.a3_job_counter",
    "mastery.a3_learned_recipes",
]

APIS = {
    "configure": "(save_node: Node, economy_service) -> bool; call AFTER the canonical EconomyService is configured with the same SaveService",
    "configure_source_host": "(host: Callable) -> bool; A0/A1/A5 composition root; host(source_id) must return the exact soh.economy.source_receipt.v1 dictionary",
    "authenticate_source": "(receipt: Dictionary) -> Dictionary; fail-closed; re-verifies the receipt against the live host, the pinned A1 binding, the A1 stand cells and the A8 verdict",
    "is_source_authenticated": "(source_id: String) -> bool",
    "harvest": "(source_id, tool_instance_id, receipt) -> Dictionary; atomic tool wear + A1 binding rewards in one SaveService transaction",
    "research_blueprint": "(recipe_id, station_id, event_id) -> Dictionary; delegates to canonical research_recipe(method=blueprint)",
    "research_specimen": "(recipe_id, specimen_instance_id, station_id, event_id) -> Dictionary; destructive, canonical method=specimen",
    "research_targeted": "(recipe_id, station_id, event_id) -> Dictionary; canonical method=targeted",
    "research_technology": "(technology_id, station_id, event_id) -> Dictionary",
    "prepare_at_station": "(recipe_id, station_id, event_id) -> Dictionary; delegates to canonical enqueue",
    "advance_station": "(station_id, time_receipt, event_id) -> Dictionary; canonical advance, A0 active-tick receipt only",
    "claim_production": "(job_id, event_id) -> Dictionary; canonical collect",
    "cancel_production": "(job_id, event_id) -> Dictionary; canonical cancel",
    "register_discovery": "(material_id, use_description, recipe_id, event_id) -> Dictionary",
    "lookup_use": "(material_id) -> Dictionary",
    "route_comparison": "() -> Dictionary; read-only measured costs for both routes",
    "skill_core_distinction": "() -> Dictionary; ordinary stack material vs instance skill_core",
    "get_projections": "() -> Dictionary; read-only A6 projection",
    "bindings_document_sha256": "() -> String",
    "a8_authorization": "() -> Dictionary",
}

SAVE_NAMESPACES = {
    "inventory.item_stacks": "A0 owned; A3 only mutates through SaveService.add_items_to_candidate inside a transaction",
    "applied_transactions": "A0 owned; A3 writes soh.a3.source_claim.<source_id>.<claim_index>, soh.a3.source_auth.<source_id>.<hash>, soh.a3.discovery.<hash>",
    "survival_economy": "canonical A3 document: schema/instances/jobs/technologies/commands/counter/time/offline/meta",
    "survival.knowledge.recipes": "canonical recipe knowledge (three research mechanisms)",
    "world_slice": "A1 world bindings/discovery/reward receipts used by canonical world_action",
    "mastery.a3_source_receipts": "A3 durable source custody record (binding identity + binding document sha256 + host session/sequence)",
    "mastery.a3_discoveries": "A3 reverse-use discovery display knowledge (never authorises a grant)",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--tested-head",
        default="",
        help="SHA the native R13 run actually validated (defaults to HEAD)",
    )
    parser.add_argument(
        "--run-id",
        default="",
        help="GitHub Actions run id of that native pass; empty keeps the PENDING status",
    )
    args = parser.parse_args(argv)

    files = []
    missing = []
    for relative, role, action in COMPOSE:
        path = ROOT / relative
        if not path.exists():
            missing.append(relative)
            continue
        files.append({"path": relative, "role": role, "a0_action": action, "sha256": sha256(path), "bytes": path.stat().st_size})
    head = git("rev-parse", "HEAD")
    tested_head = args.tested_head or head
    run_id = args.run_id
    status = (
        "OWNER_NATIVE_EXACT_HEAD_CI_PASSED"
        if tested_head and run_id
        else "OWNER_NATIVE_PENDING_EXACT_HEAD_CI"
    )
    document = {
        "schema": "soh.economy.a0_adoption_contract.v2",
        "version": 2,
        "status": status,
        "owner": "A3 (economy)",
        "consumer": "A0 (composition/save), A6 (read-only UI), A7 (balance/acceptance), A8 (Quarry authorization)",
        "generated_from": {
            "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
            "head": head,
            "tested_head": tested_head,
            "native_run_id": run_id,
            "native_run_url": f"https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/{run_id}" if run_id else "",
            "predecessor_head": "b751a29f213d3c934caa204eb8d2d86943f07b65",
            "generator": "tools/survival/economy/a3_adoption_contract.py",
            "regeneration_command": (
                f"python tools/survival/economy/a3_adoption_contract.py --tested-head {tested_head}"
                + (f" --run-id {run_id}" if run_id else "")
            ),
        },
        "claim_boundary": [
            "This contract is an A3 request. It does not assert A0 composition, product integration, human playtest or balance.",
            "PRODUCT_COMPOSED_PASS may only be written by A0/A7 on the composed tree, never from an A3 branch.",
            "A7 R17 recorded A3_SERVICE_REFUSED_BY_SCOPE against an older composed tree that shipped a 1789-line A0 vendored fork of economy_service.gd. That fork must be replaced by the exact file hash below, not merged.",
        ],
        "composition_order": [
            "1. A0 SaveService is the only inventory/transaction authority (no second save, no second wallet).",
            "2. economy_service.gd.configure(SaveService, station_resolver) then configure_time_host(active_tick_receipt_host), configure_world_host(world_host).",
            "3. economy_service.gd.configure_offline_time_host(offline_projection_host) only when A0 supplies the D055/D060 projection.",
            "4. a3_economy_service.gd.new(); configure(SaveService, economy_service); configure_source_host(A1_source_host).",
            "5. Call load_catalog() only where the current A0 composition already does; A3 adds no second catalog loader.",
            "6. On a new run, SaveService RESET_ALL wipes mastery.a3_* and survival_economy; A3 needs no reset hook.",
        ],
        "files": files,
        "rejected_or_superseded": [
            {"path": path, "state": state, "reason": reason} for path, state, reason in REJECT
        ],
        "removed_save_keys": REMOVED_SAVE_KEYS,
        "migration": {
            "required_schema_migration": False,
            "reason": "R13 was never composed into a shipped save; every A3 key lived under generic SaveService sections (mastery/survival_economy) that need no schema bump.",
            "cleanup_if_an_experimental_save_contains_them": "The three removed mastery.a3_* keys are ignored by the new code and are cleared by SaveService RESET_ALL. They are never read for authority.",
            "backwards_compatibility": "V5-V7 save documents (survival_economy schema 2, legacy v1) keep loading; R13 adds no new required field.",
        },
        "apis": APIS,
        "save_namespaces": SAVE_NAMESPACES,
        "source_authentication_contract": {
            "contract": "soh.economy.source_receipt.v1",
            "fields": ["contract", "source_id", "owner", "poi_id", "instance_id", "action_id", "binding_identity", "host_session_id", "host_sequence", "hero_cell", "discovered", "active_seconds", "a8_authorization_sha256"],
            "identity_authority": "data/survival/items/world_source_bindings.v3.json (five A1 bindings); a source id that is not a pinned binding is rejected as UNKNOWN_SOURCE_BINDING",
            "anti_spoof": [
                "A caller-supplied owner string (for example \"A1\") is not authentication and fails the shape check.",
                "The receipt must be field-for-field equal to the injected host's current answer, so a caller-built dictionary fails.",
                "The hero cell must be an A1-authored stand cell for that binding.",
                "The binding document SHA is persisted with the custody record; re-pinning A1 data invalidates stale custody.",
                "If canonical world_action already settled the same poi/action, A3 refuses the claim (SOURCE_SETTLED_BY_CANONICAL_WORLD_ACTION).",
            ],
            "quarry": "CLOSED. The pinned A8 document status is REJECTED_PENDING_EVIDENCE_FAIL_CLOSED and no Quarry binding exists; A3 never fabricates A8 rewards, POI arrival or Core ownership.",
        },
        "canonical_authority": {
            "queue": "survival_economy.jobs via economy_service.gd (enqueue/advance/collect/cancel). No A3 queue exists.",
            "job_identity": "canonical state.counter -> job_%06d, stable across reloads",
            "knowledge": "survival.knowledge.recipes via research_recipe(blueprint|specimen|targeted). No A3 learned-recipe map exists.",
            "clock": "A0 soh.economy.active_tick.v1 receipt; there is no A3 set_time_source and no wall-clock queue maturity.",
            "offline": "V6 offline_operation_planner armed custody + A0 D055/D060 projection; A3 adds no offline planner.",
        },
        "dependency_tests": {
            "native_r13": {
                "workflow": ".github/workflows/survival-a3-economy.yml",
                "job": "r13-value-economy",
                "steps": ["static hazard gate", "import", "process 1", "process 2", "receipt verification", "single-process negative controls"],
                "engine_exit_contract": "tools/ci/godot_exit_gate.py requires a real Godot exit code 0 for phase 1, phase 2 and the negative suite; TIMEOUT/SHUTDOWN_ONLY/ABNORMAL all fail and shutdown accounting is classified, never tolerated",
            },
            "canonical_regression": ["tests/survival/catalog/economy_adapter_test.gd", "economy_offline_test.gd", "economy_meta_test.gd", "economy_tool_use_test.gd", "economy_world_restart_test.gd"],
            "contract_tests": "python -m unittest discover -s tests/survival/catalog -p 'test_*.py'",
            "catalog_validator": "python tools/survival/economy/validate_economy.py",
        },
        "consumer_contracts": {
            "A6": "get_projections() is read-only; UI flags never authorise a claim or a grant.",
            "A7": "R13 native gate + V5-V7 adapter regression must pass on the exact composed SHA before any balance or acceptance statement.",
            "A8": "Provide a durable site instance, native two-route collision/reload proof and a new APPROVED authorization SHA before any Quarry source, cost or reward is enabled.",
        },
        "known_limits": [
            "A3 cannot prove A0 composition, browser/Web playtest, human pacing or final balance.",
            "The source host is a composition-root callable; A0 must not expose it to UI input.",
            "Route costs are catalog-derived readings, not a human-tuned balance verdict.",
        ],
        "generated_files_missing": missing,
    }
    OUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} with {len(files)} files, {len(missing)} missing")
    for item in missing:
        print(f"::warning::adoption contract references missing file: {item}")
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
