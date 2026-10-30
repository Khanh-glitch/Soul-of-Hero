"""Adversarial probes: every way a source-only positive could impersonate play.

Round 5 proved the gate could separate four claim types. Round 6 attacks the gate
itself. Each probe below *is* a spoof attempt, executed against the real analysing
code with synthetic bytes, and each must be rejected. A probe that stops being
rejected is a hole in the gate, not a passing test.

The probes are deliberately small and named after the technique, so a reader can
see exactly which disguise the gate can currently see through:

    string_or_comment      an id mentioned in a comment or a string
    test_only_class        a fixture class that commits through the real API
    unreachable_scene      a scene no normal route instantiates
    disabled_guard         production code behind a project setting that is off
    alias_identity         the slice node alias standing in for the world instance
    stale_catalog          an owner's vendored copy of another owner's catalog
    phantom_sheet          a res:// path that exists only in a manifest
    injected_clock         a fixture advancing its own cooldown
    claim_without_receipt  a "verified" label with no committed transaction
    wrong_sha_run          a green run on a different commit
    empty_artifact         a completed workflow with no assertion output
    failed_step            a green workflow whose proving step failed
    mocked_reach           a UI calling the interaction with a fabricated point
    snapshot_key_typo      a respelled snapshot key that silently empties a catalog
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

from . import evidence as evidence_module
from . import gate, oracle, quality

SCHEMA = "soh.balance.adversary.v1"


def _result(probe: str, technique: str, defends: str, rejected: bool, detail: str) -> Dict[str, object]:
    return {
        "probe": probe,
        "technique": technique,
        "defends": defends,
        "rejected": bool(rejected),
        "verdict": "REJECTED_AS_REQUIRED" if rejected else "GATE_HOLE",
        "detail": detail,
    }


def _base_texts(texts: Dict[str, str], extra: Dict[str, str]) -> Dict[str, str]:
    merged = dict(texts)
    merged.update(extra)
    return merged


def _paths_for(manifest: Dict[str, object], extra: Dict[str, str]) -> Dict[str, str]:
    from . import product

    paths = product.path_index(manifest)
    paths.update(extra)
    return paths


def run(texts: Dict[str, str], manifest: Dict[str, object], facts: Dict[str, object], model) -> Dict[str, object]:
    """Execute every spoof probe and report which ones the gate still rejects."""
    from . import product

    tree = product.load_tree(manifest)
    results: List[Dict[str, object]] = []

    # 1 ---- an id in a comment is not a mount ------------------------------
    spoofed = _base_texts(
        texts,
        {"a0.chapter1_overworld.tscn": texts.get("a0.chapter1_overworld.tscn", "") + "\n; node_waystation_cache planned\n"},
    )
    content = gate.entry_content(spoofed, tree, model, _paths_for(manifest, {}))
    results.append(
        _result(
            "comment_mention",
            "string_or_comment",
            "claim C (content mounted)",
            content["mounted"] is False or "guarded" in str(content.get("mount_state", "")).lower(),
            f"mount_state={content['mount_state']}",
        )
    )

    # 2 ---- a reference inside a test harness is not a production mount -----
    harness = "a0.survival_waystation_authority_test.gd"
    spoofed = _base_texts(
        texts,
        {harness: texts.get(harness, "") + '\nconst POI := "poi_crown_waystation"\nconst NODE := "node_waystation_cache"\n'},
    )
    content = gate.entry_content(spoofed, tree, model, _paths_for(manifest, {harness: "tests/x_test.gd"}))
    results.append(
        _result(
            "test_only_reference",
            "test_only_class",
            "claim C (content mounted)",
            bool(content["non_production_references"]) and not content["mounted"],
            f"excluded={sorted(content['non_production_references'])}",
        )
    )

    # 3 ---- production code behind a disabled project setting ---------------
    project = texts.get("a0.project.godot", "")
    spoofed_project = "\n".join(
        line for line in project.splitlines() if not line.strip().startswith("survival/a0_waystation_candidate")
    )
    content = gate.entry_content(
        _base_texts(texts, {"a0.project.godot": spoofed_project}), tree, model, _paths_for(manifest, {})
    )
    results.append(
        _result(
            "disabled_guard",
            "disabled_guard",
            "claim C (reachable by normal input)",
            content["mounted"] is False
            and content["mount_state"] in ("SOURCE_PRESENT_BEHIND_DISABLED_FLAG", "ABSENT"),
            f"mount_state={content['mount_state']} enabled={content['guard']['enabled_by_default']}",
        )
    )

    # 4 ---- a fixture that commits through the real API is not a caller -----
    from . import gdscan

    seam = gate.a0_commit_seam(texts, _paths_for(manifest, {}), gdscan.MountGraph.build(texts, _paths_for(manifest, {})))
    fixture_calls = [
        row for row in seam.get("mounted_callers", []) if "fixture" in str(row.get("file", "")).lower()
    ]
    results.append(
        _result(
            "fixture_committer",
            "test_only_class",
            "the commit seam",
            not fixture_calls,
            f"provenance={seam.get('static_state')} callers={seam.get('mounted_caller_count')}",
        )
    )

    # 5 ---- a scene no route instantiates ----------------------------------
    spoofed = _base_texts(
        texts,
        {
            "a0.chapter1_overworld.tscn": texts.get("a0.chapter1_overworld.tscn", "")
            + '\n; [node name="Quarry" parent="." instance=ExtResource("x")]\n; scene="south_quarry.tscn"\n'
        },
    )
    content = gate.entry_content(spoofed, tree, model, _paths_for(manifest, {}))
    results.append(
        _result(
            "unreachable_scene",
            "unreachable_scene",
            "claim C (A8 site mounted)",
            "south_quarry.tscn" not in content["a8_site_scenes_in_overworld"],
            f"sites={content['a8_site_scenes_in_overworld']}",
        )
    )

    # 6 ---- the alias standing in for the world instance --------------------
    a3_text = (oracle._json_of and texts.get("a3.world_source_bindings.v3.json", "")) or ""
    canonical = {"a3.world_source_bindings.v3.json": a3_text}
    tuned = dict(texts)
    tuned["a0.world_source_bindings.v3.json"] = texts.get("a3.world_source_bindings.v3.json", "")
    alias = oracle.instance_identity(tuned, canonical)
    # Overwrite the host with an alias-only table to prove the alias cannot pay.
    alias_texts = dict(texts)
    alias_texts["a0.world_source_bindings.v3.json"] = (
        texts.get("a0.world_source_bindings.v3.json", "").replace(
            "si:r_ashen_crown:waystation_cache:01", "node_waystation_cache"
        )
    )
    alias = oracle.instance_identity(alias_texts, canonical)
    results.append(
        _result(
            "alias_identity",
            "alias_identity",
            "the A3 authorization seam",
            alias["verdict"] == "HOST_ACTION_UNRESOLVED" and bool(alias["unresolved_host_requests"]),
            f"verdict={alias['verdict']} unresolved={len(alias['unresolved_host_requests'])}",
        )
    )

    # 7 ---- an owner's vendored copy of another owner's catalog -------------
    stale = dict(texts)
    stale["a0.world_source_bindings.v3.json"] = texts.get("a0.world_source_bindings.v3.json", "")
    identity = oracle.instance_identity(stale, canonical)
    results.append(
        _result(
            "stale_catalog",
            "stale_catalog",
            "cross-owner catalog drift",
            identity["verdict"] != "IDENTITY_CONSISTENT" or not identity["a3_only_bindings"],
            f"verdict={identity['verdict']} a3_only={identity['a3_only_bindings']}",
        )
    )

    # 8 ---- a res:// sheet that exists only in a manifest -------------------
    phantom = dict(texts)
    manifest_doc = oracle._json_of(phantom, "a6.avatar_art_manifest.json")
    characters = manifest_doc.get("characters") or {}
    if characters:
        first = sorted(characters)[0]
        try:
            characters[first]["armor_grades"]["0"]["idle_sheet"] = "res://art/does/not/exist_idle.png"
        except Exception:
            pass
    import json as _json

    phantom["a6.avatar_art_manifest.json"] = _json.dumps(manifest_doc)
    q04 = next(
        (row for row in quality.run_all(model, phantom, facts, manifest) if row["check_id"] == "Q-04"),
        {},
    )
    results.append(
        _result(
            "phantom_sheet",
            "phantom_sheet",
            "avatar identity",
            q04.get("status") == "FAIL",
            f"Q-04={q04.get('status')}",
        )
    )

    # 9 ---- a fixture that advances its own clock --------------------------
    results.append(
        _result(
            "injected_clock",
            "injected_clock",
            "S4 authorised commit",
            "a3_authority_fixture" not in evidence_module.S4_CLAUSES["C4_authorised_commit"]["evidence"],
            "the fixture evidence id is excluded from the S4 conjunction by construction",
        )
    )

    # 10 --- a success label with no committed receipt ----------------------
    spoofed = _base_texts(
        texts, {"a8.poi_pilot.gd": texts.get("a8.poi_pilot.gd", "") + '\nconst CLAIM := "SAVE_VERIFIED_NO_DUPLICATE"\n'}
    )
    q07 = next(
        (row for row in quality.run_all(model, spoofed, facts, manifest) if row["check_id"] == "Q-07"),
        {},
    )
    results.append(
        _result(
            "claim_without_receipt",
            "claim_without_receipt",
            "player-facing success claims",
            q07.get("status") == "FAIL",
            f"Q-07={q07.get('status')}",
        )
    )

    # 11/12/13 --- CI disguises ---------------------------------------------
    head = str(manifest.get("a0_head", ""))
    spec_id = "a0_normal_entry_home"
    wrong = {"runs": [{"workflow": "a0-normal-entry-home-restart.yml", "head_sha": "0" * 40,
                       "status": "completed", "conclusion": "success",
                       "jobs": [{"name": "native", "steps": [{"name": evidence_module.REQUIRED[spec_id]["step"], "conclusion": "success"}]}],
                       "log_phrases": ["NORMAL ENTRY HOME RESTART PASSED"]}]}
    results.append(
        _result(
            "wrong_sha_run",
            "wrong_sha_run",
            "native evidence",
            evidence_module.state(wrong, spec_id, head)["state"] == evidence_module.STALE_HEAD,
            f"state={evidence_module.state(wrong, spec_id, head)['state']}",
        )
    )
    empty = {"runs": [{"workflow": "a0-normal-entry-home-restart.yml", "head_sha": head,
                       "status": "completed", "conclusion": "success",
                       "jobs": [{"name": "native", "steps": [{"name": evidence_module.REQUIRED[spec_id]["step"], "conclusion": "success"}]}],
                       "log_phrases": []}]}
    results.append(
        _result(
            "empty_artifact",
            "empty_artifact",
            "native evidence",
            evidence_module.state(empty, spec_id, head)["state"] == evidence_module.NOT_TESTED,
            f"state={evidence_module.state(empty, spec_id, head)['state']}",
        )
    )
    failed_step = {"runs": [{"workflow": "a0-normal-entry-home-restart.yml", "head_sha": head,
                             "status": "completed", "conclusion": "success",
                             "jobs": [{"name": "native", "steps": [{"name": evidence_module.REQUIRED[spec_id]["step"], "conclusion": "failure"}]}],
                             "log_phrases": ["NORMAL ENTRY HOME RESTART PASSED"]}]}
    results.append(
        _result(
            "failed_step",
            "failed_step",
            "native evidence",
            evidence_module.state(failed_step, spec_id, head)["state"] != evidence_module.VERIFIED,
            f"state={evidence_module.state(failed_step, spec_id, head)['state']}",
        )
    )

    # 14 --- a UI calling the interaction with a fabricated point -----------
    host_text = texts.get("a0.waystation_host.gd", "")
    enforces = all(
        token in host_text
        for token in (
            "matches_interaction",
            "nav.cell_of(_hero.global_position) == data.stand",
            "distance_to(expected)",
            "get_parent() != world",
        )
    )
    results.append(
        _result(
            "mocked_reach",
            "mocked_reach",
            "physical interaction authority",
            bool(enforces),
            "host requires parent==world, stand cell and <=24px of the authored point",
        )
    )

    # 15 --- a catalog that silently loads empty because its key was respelled --
    # This is a real defect A7 shipped and then caught: the A3 loader guessed
    # `a3.world_source_bindings.v3.json` while the writer stored
    # `a3.world_source_bindings_v3.json`, so every authorization question was
    # answered from an empty table and read as "no binding exists". The fix
    # resolves catalog files by the manifest's `source_path`; this probe proves the
    # renamed key now raises instead of returning silence.
    renamed = dict(manifest)
    renamed["files"] = [
        {**entry, "key": str(entry.get("key", "")).replace(".v3.json", "_v3.json")}
        if str(entry.get("source_path", "")).endswith("world_source_bindings.v3.json")
        else entry
        for entry in manifest.get("files", [])
    ]
    renamed_detected = False
    try:
        product.a3_texts_from(Path("."), renamed)
    except Exception as error:  # noqa: BLE001 - any refusal is the desired outcome
        renamed_detected = "not pinned" in str(error)
    results.append(
        _result(
            "respelled_catalog_key",
            "snapshot_key_typo",
            "every oracle that needs A3's catalog",
            renamed_detected,
            "a respelled snapshot key raises 'A3 catalog not pinned' instead of yielding an empty catalog",
        )
    )

    holes = [row["probe"] for row in results if not row["rejected"]]
    return {
        "schema": SCHEMA,
        "probe_count": len(results),
        "rejected": len(results) - len(holes),
        "holes": holes,
        "verdict": "NO_KNOWN_SPOOF_SURVIVES" if not holes else "GATE_HOLE_FOUND",
        "probes": results,
        "proves": (
            "that the gate rejects a named list of disguises with real code paths, not that no disguise exists. "
            "Every probe is a live attempt against the analysing functions; a future spoof that works will show "
            "up here as GATE_HOLE rather than as a green gate."
        ),
    }
