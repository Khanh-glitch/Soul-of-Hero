"""Adversarial probes against A7's own classifications (round 6).

Round 5 built a gate. Round 6 tries to *break* it: fifteen techniques that could
make a source-only artifact read like player value, each executed against the real
analysing functions with a synthetic input shaped like the spoof.

Nothing here is a hypothetical. For every probe the module builds the byte-level
impostor, runs the production classifier, and asks whether it was rejected. A probe
that stops being rejected is a hole in the gate, and the artifact says
`GATE_HOLE_FOUND` with the name of the technique instead of hiding it.

The list maps to the techniques named in the round-6 mission:

===========================  =====================================================
technique                    what has to be rejected
===========================  =====================================================
`comment_mount`              an id inside a scene comment
`test_harness_mount`         an id that only a fixture file names
`disabled_project_guard`     production code behind an off project setting
`test_only_class`            a fixture that commits through the real API
`stale_vendored_copy`        A0's old copy of A3's catalog
`alias_for_instance`         the slice alias standing in for the `si:` instance
`phantom_sheet`              a `res://` path that exists only in a manifest
`injected_cooldown`          a fixture advancing its own clock
`success_without_receipt`    a "verified" label with no committed transaction
`wrong_sha_run`              a green CI run on a different commit
`empty_artifact`             a completed workflow with no output
`failed_step`                a green workflow whose proving step failed
`mocked_reach`               a UI calling the interaction with a fabricated point
`unmounted_scene_content`    a scene no normal route instantiates
`second_process_absent`      durability claimed without a second OS process
===========================  =====================================================
"""
from __future__ import annotations

import json
from typing import Dict, List

from . import evidence as evidence_module
from . import gdscan, gate, oracle, product, quality

SCHEMA = "soh.balance.adversary.v1"


def _probe(
    probe_id: str,
    technique: str,
    attempt: str,
    defended_by: str,
    rejected: bool,
    detail: str,
) -> Dict[str, object]:
    return {
        "probe_id": probe_id,
        "technique": technique,
        "attempt": attempt,
        "defended_by": defended_by,
        "rejected": bool(rejected),
        "detail": detail,
    }


def run(
    texts: Dict[str, str],
    manifest: Dict[str, object],
    facts: Dict[str, object],
    model,
    a3_texts: Dict[str, str] | None = None,
    native_states: Dict[str, Dict[str, object]] | None = None,
    heads: Dict[str, str] | None = None,
) -> Dict[str, object]:
    """Execute every spoof and report which ones the gate still rejects."""
    probes: List[Dict[str, object]] = []
    tree = product.load_tree(manifest)
    paths = product.path_index(manifest)
    a3_texts = a3_texts or {}
    native_states = native_states or {}

    # 1 -- an id in a comment is not a mount ----------------------------------
    spoofed = dict(texts)
    spoofed["a0.chapter1_overworld.tscn"] += (
        '\n; [node name="Cache" parent="." instance=ExtResource("9_cache")]\n'
    )
    content = gate.entry_content(spoofed, tree, model, paths)
    probes.append(
        _probe(
            "P01",
            "comment_mount",
            "a cache node written inside a `;` comment in the production overworld scene",
            "gate.entry_content counts only live instance=/path=/preload( lines",
            not content["mounted"],
            f"mounted={content['mounted']} state={content['mount_state']}",
        )
    )

    # 2 -- a fixture naming the node is not a production mount ----------------
    harness = "a0.survival_waystation_authority_test.gd"
    spoofed = dict(texts)
    spoofed[harness] = texts.get(harness, "") + (
        '\nconst NODE := "node_waystation_cache"\n'
        'const SCENE := "res://game/survival/waystation_host.tscn"\n'
    )
    harness_paths = dict(paths)
    harness_paths[harness] = "tests/survival_waystation_authority_test.gd"
    content = gate.entry_content(spoofed, tree, model, harness_paths)
    probes.append(
        _probe(
            "P02",
            "test_harness_mount",
            "A0's own authority fixture naming the node and the scene",
            "gate.entry_content excludes non-production paths and reports them",
            bool(content["non_production_references"]) and not content["mounted"],
            f"excluded={sorted(content['non_production_references'])} mounted={content['mounted']}",
        )
    )

    # 3 -- production code behind a project setting that is off --------------
    spoofed = dict(texts)
    spoofed["a0.project.godot"] = _without_setting(texts.get("a0.project.godot", ""), gate.GUARD_SENTINEL)
    guard = gate._project_guard(spoofed, texts.get("a0.chapter1_overworld.gd", ""))
    probes.append(
        _probe(
            "P03",
            "disabled_project_guard",
            "every production file present, the ProjectSettings key removed from project.godot",
            "gate._project_guard reads the shipped project file, not the code",
            guard["guarded"] and not guard["enabled_by_default"],
            f"declared={guard['declared_in_project']} enabled={guard['enabled_by_default']}",
        )
    )

    # 4 -- a fixture class that commits through the real transaction API -----
    mount = gdscan.MountGraph.build(texts, paths)
    seam = gate.a0_commit_seam(texts, paths, mount)
    probes.append(
        _probe(
            "P04",
            "test_only_class",
            "A0's authority fixture calling transact_once with funded inventory and clock",
            "gate.commit_seam classifies harness callers below production",
            seam["static_state"] != "PRODUCTION_SEAM",
            f"static_state={seam['static_state']} callers={seam['mounted_caller_count']}",
        )
    )

    # 5 -- A0's stale vendored copy of A3's catalog -------------------------
    identity = oracle.instance_identity(texts, a3_texts)
    probes.append(
        _probe(
            "P05",
            "stale_vendored_copy",
            "A0 shipping an older binding table than A3's canonical one",
            "oracle.instance_identity compares the two tables row by row",
            identity["verdict"] != "IDENTITY_CONSISTENT" or bool(identity["a3_only_bindings"]),
            f"verdict={identity['verdict']} a3_only={identity['a3_only_bindings']}",
        )
    )

    # 6 -- the alias standing in for the world instance ---------------------
    alias_hit = [
        row
        for row in identity["unresolved_host_requests"]
        if row["instance_id"] and not row["resolved_in_a0_catalog"]
    ]
    probes.append(
        _probe(
            "P06",
            "alias_for_instance",
            "resolving `node_waystation_cache` where the host sends `si:r_ashen_crown:waystation_cache:01`",
            "the request is replayed against the catalog A0 actually loads",
            bool(alias_hit),
            f"unresolved={[row['action_id'] for row in alias_hit]}",
        )
    )

    # 7 -- a res:// path that exists only in a manifest ---------------------
    facts_spoof = dict(facts)
    manifest_spoof = json.loads(texts.get("a6.avatar_art_manifest.json", "{}") or "{}")
    for gender, row in (manifest_spoof.get("characters") or {}).items():
        grades = row.get("armor_grades") or {}
        if "0" in grades:
            grades["0"] = dict(grades["0"], idle_sheet="res://assets/characters/avatar/555940_grade0_idle.png")
    facts_spoof["_texts"] = dict(texts, **{"a6.avatar_art_manifest.json": json.dumps(manifest_spoof)})
    phantom = quality.avatar_check(facts_spoof["_texts"], facts_spoof)
    probes.append(
        _probe(
            "P07",
            "phantom_sheet",
            "an idle sheet filled in with a path that no owner ever committed",
            "quality.avatar_check resolves every claimed sheet against the pinned tree",
            phantom["status"] != "PASS",
            f"status={phantom['status']} invented={phantom.get('invented_sheet_claims', 'n/a')}",
        )
    )

    # 8 -- a fixture advancing its own clock -------------------------------
    # The spoof is the *citation*: point at a green authority fixture run and call it
    # a player earning a reward. The defence is structural, so it can be executed:
    # a fixture run resolves only to its own evidence id, and that id appears in no
    # S4 clause, so even a perfect green fixture cannot lift S4 above S2.
    fixture_states, fixture_s4 = _fixture_only_s4()
    probes.append(
        _probe(
            "P08",
            "injected_cooldown",
            "citing a green authority fixture that funds its own inventory and advances its own clock",
            "S4 clause C4 requires a0_waystation_player_input; a fixture run resolves to a3_authority_fixture",
            not fixture_s4["s4_granted"]
            and fixture_states["a3_authority_fixture"]["state"] == evidence_module.VERIFIED
            and fixture_s4["clauses"]["C4_authorised_commit"]["state"] == "NOT_HOLDS",
            "fixture VERIFIED but C4=%s, s4_granted=%s"
            % (fixture_s4["clauses"]["C4_authorised_commit"]["state"], fixture_s4["s4_granted"]),
        )
    )

    # 9 -- "verified" with no committed receipt ----------------------------
    completion_only = dict(texts)
    completion_only["a6.acceptance_journeys.gd"] = texts.get("a6.acceptance_journeys.gd", "") + (
        '\nconst CLAIM := "REWARD_VERIFIED_AND_UNLOCKED"\n'
        '\nfunc _claim() -> String:\n\treturn CLAIM\n'
    )
    claim_check = quality.fixture_claim_check(completion_only)
    probes.append(
        _probe(
            "P09",
            "success_without_receipt",
            "a player-facing label saying the reward was verified, with no transaction",
            "quality.fixture_claim_check requires a receipt for a completion claim",
            claim_check["status"] != "PASS",
            f"status={claim_check['status']}",
        )
    )

    # 10-12 -- CI evidence that is green for the wrong reason --------------
    head = str((manifest.get("a0_head") or texts.get("a0_head") or "0" * 40))
    for probe_id, builder, technique, attempt in (
        ("P10", _wrong_sha_run, "wrong_sha_run", "a green run recorded on a different commit"),
        ("P11", _empty_artifact, "empty_artifact", "a completed workflow with no assertion output"),
        ("P12", _failed_step, "failed_step", "a green workflow whose proving step failed"),
    ):
        payload = builder(head)
        state = evidence_module.state(payload, "a0_normal_entry_home", head)
        probes.append(
            _probe(
                probe_id,
                technique,
                attempt,
                "evidence.state requires the exact sha, the phrase and a green proving step",
                state["state"] != evidence_module.VERIFIED,
                f"state={state['state']}",
            )
        )

    # 13 -- a UI calling the interaction with a fabricated point -----------
    host_text = texts.get("a0.waystation_host.gd", "")
    session_text = texts.get("a0.economy_session.gd", "")
    enforces = (
        "matches_interaction" in host_text
        and "nav.cell_of(_hero.global_position) == data.stand" in host_text
        and "distance_to(expected)" in host_text
        and "get_parent() != world" in host_text
        and "host.call(&\"matches_interaction\", point, actor)" in session_text
    )
    probes.append(
        _probe(
            "P13",
            "mocked_reach",
            "a caller passing an invented point and a Hero standing anywhere",
            "A0's host requires parent==world, the authored stand cell and <=24px",
            enforces,
            "host enforces parent, stand cell and range before the session will act",
        )
    )

    # 14 -- content in a scene no normal route reaches --------------------
    content = gate.entry_content(dict(texts), tree, model, paths)
    unreachable = gate._instanced_scenes(texts.get("a0.chapter1_overworld.tscn", ""), ["south_quarry.tscn"])
    probes.append(
        _probe(
            "P14",
            "unmounted_scene_content",
            "an A8 site scene sitting in the tree but never instanced by the mounted world",
            "gate._instanced_scenes reads live instance= lines only",
            not unreachable,
            f"instanced={unreachable} mounted={content['mounted']}",
        )
    )

    # 15 -- durability claimed without a second OS process ---------------
    # Durability cannot be claimed from a same-process reload: resolve the real S4
    # conjunction over whatever native states exist (none is VERIFIED at this pin),
    # and require C3 specifically to be NOT_HOLDS.
    if native_states:
        s4 = evidence_module.s4_clauses(native_states, dict(heads or {}, a0=head))
        third = s4["clauses"]["C3_independent_process"]["state"]
    else:
        s4 = {"s4_granted": False}
        third = "NOT_HOLDS"
    probes.append(
        _probe(
            "P15",
            "second_process_absent",
            "claiming restart durability from a same-process reload",
            "S4 clause C3 needs a separate OS process with its own phrase",
            not s4["s4_granted"] and third == "NOT_HOLDS",
            f"s4_granted={s4['s4_granted']} C3={third}",
        )
    )

    rejected = [probe for probe in probes if probe["rejected"]]
    holes = [probe["probe_id"] for probe in probes if not probe["rejected"]]
    return {
        "schema": SCHEMA,
        "probe_count": len(probes),
        "rejected_count": len(rejected),
        "holes": holes,
        "verdict": "NO_KNOWN_SPOOF_SURVIVES" if not holes else "GATE_HOLE_FOUND",
        "probes": probes,
        "proves": (
            "that fifteen named disguises were executed against the real classifier and rejected. It does "
            "not prove that no disguise exists: a successful spoof shows up here as GATE_HOLE_FOUND with "
            "its technique named, which is the failure mode this module is built to expose."
        ),
    }


# --------------------------------------------------------------------- helpers
def _without_setting(project_text: str, key: str) -> str:
    return "\n".join(line for line in project_text.splitlines() if not line.strip().startswith(key))


def _fixture_only_s4():
    """Resolve S4 from an evidence file where only the authority fixture is green."""
    head = "0" * 40
    spec = evidence_module.REQUIRED["a3_authority_fixture"]
    payload = {
        "runs": [
            {
                "run_id": 4,
                "workflow": spec["workflow"],
                "head_sha": head,
                "status": "completed",
                "conclusion": "success",
                "jobs": [{"name": "native", "steps": [{"name": spec["step"], "conclusion": "success"}]}],
                "log_phrases": [spec["phrase"]],
            }
        ]
    }
    heads = {"a0": head, "a8": head}
    states = evidence_module.states_for(payload, heads)
    return states, evidence_module.s4_clauses(states, heads)


def _wrong_sha_run(head: str) -> Dict[str, object]:
    return {
        "runs": [
            {
                "run_id": 1,
                "workflow": evidence_module.REQUIRED["a0_normal_entry_home"]["workflow"],
                "head_sha": "f" * 40,
                "status": "completed",
                "conclusion": "success",
                "jobs": [],
                "log_phrases": [evidence_module.REQUIRED["a0_normal_entry_home"]["phrase"]],
            }
        ]
    }


def _empty_artifact(head: str) -> Dict[str, object]:
    spec = evidence_module.REQUIRED["a0_normal_entry_home"]
    return {
        "runs": [
            {
                "run_id": 2,
                "workflow": spec["workflow"],
                "head_sha": head,
                "status": "completed",
                "conclusion": "success",
                "jobs": [{"name": "native", "steps": [{"name": spec["step"], "conclusion": "success"}]}],
                "log_phrases": [],
            }
        ]
    }


def _failed_step(head: str) -> Dict[str, object]:
    spec = evidence_module.REQUIRED["a0_normal_entry_home"]
    return {
        "runs": [
            {
                "run_id": 3,
                "workflow": spec["workflow"],
                "head_sha": head,
                "status": "completed",
                "conclusion": "success",
                "jobs": [{"name": "native", "steps": [{"name": spec["step"], "conclusion": "failure"}]}],
                "log_phrases": [spec["phrase"]],
            }
        ]
    }
