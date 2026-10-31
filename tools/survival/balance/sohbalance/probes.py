"""Static soundness for the Godot probes A7 cannot execute here.

Phase 3 ships native probes, but A7's sandbox has no Godot binary, so "it would
pass" is not available and "trust me" is not evidence. This module makes the
probes checkable without an engine:

* each probe must extend the *shipped* harness chain, so it cannot quietly become
  a bespoke scenario;
* the constructs that would fabricate success are rejected by pattern, comments
  excluded: assigning the Hero's position, adding a node, forcing `_die()`,
  calling `begin_overworld_death()`, granting an item;
* every symbol the probe names must exist in the pinned product bytes, so a probe
  that drifts away from the owner code fails here instead of failing mysteriously
  in CI;
* every probe declares the outcome it expects today and the owner action that
  would flip it.

The verdict is therefore ``PROBES_STATICALLY_SOUND_NOT_EXECUTED``. That string is
deliberate: it can never be read as a native pass.

## Two families, two contracts

*A_JOURNEY* — the three B0 probes in ``tests/survival/balance_native``. They extend
A0's shipped normal-entry journey and must never stage a world of their own.

*D_CONTRACT* — the D055–D061 contract probes in
``tests/survival/balance_native_decisions``. They answer a different question: does
this composition implement the rule *at all*, and does it detect the corruption
that would break it. They therefore extend ``d_harness.gd``, which boots only the
production autoloads, and they may mount exactly one scene — the shipped overworld
— through the single ``_mount_world()`` door in that harness. A probe may not add
nodes, instantiate scenes, create a local class, or load anything outside
``res://game/``. The harness itself is audited here (one ``add_child``, inside
``_mount_world``, pointing at a ``res://game/`` scene), so "probes cannot stage the
world" is a checked claim rather than a comment.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List

SCHEMA = "soh.balance.native_probes.v1"
PROBE_DIR = Path("tests/survival/balance_native")
CHAIN = "res://tests/survival_normal_entry_home_restart_test.gd"
DECISION_DIR = Path("tests/survival/balance_native_decisions")
DECISION_CHAIN = "res://tests/survival/balance_native_decisions/d_harness.gd"
DECISION_HARNESS = "d_harness.gd"

#: Extra bans for the D family. Mounting a scene and instantiating a script are
#: *how* a probe would stage the phenomenon it claims to observe, so both are
#: banned in the probes and centralised in the audited harness door.
FORBIDDEN_CONTRACT: List[Dict[str, object]] = [
    {
        "pattern": r"\binstantiate\s*\(",
        "literals": False,
        "why": "mounting a scene is the harness' single audited door; a probe may not stage a world",
    },
    {
        "pattern": r"^\s*class\s+\w+",
        "literals": False,
        "why": "a local class is a test double: it replaces the product's behaviour instead of observing it",
    },
    {
        "pattern": r"\b(?:preload|load)\s*\(\s*\"(?!res://game/)",
        "literals": True,
        "why": "a probe may only load production scripts under res://game/",
    },
]

#: Constructs that would manufacture the result instead of observing it. Each is
#: a regex over comment-stripped source, with the reason it is banned.
FORBIDDEN: List[Dict[str, object]] = [
    {
        "pattern": r"(?:global_position|position)\s*=\s*[^=]",
        "literals": False,
        "why": "assigning a position teleports the Hero; the probe must walk",
    },
    {
        "pattern": r"\badd_child\s*\(",
        "literals": False,
        "why": "adding a node injects the world the probe claims to observe",
    },
    {
        "pattern": r"\bbegin_overworld_death\s*\(",
        "literals": False,
        "why": "calling the death API fabricates the death under test",
    },
    {
        "pattern": r'\.call\s*\(\s*&?"begin_overworld_death"',
        "literals": True,
        "why": "calling the death API by name fabricates the death under test",
    },
    {
        "pattern": r'\.call\s*\(\s*&?"_die"',
        "literals": True,
        "why": "forcing the private death path fabricates the death under test",
    },
    {
        "pattern": r"\b(?:grant_item|inventory_add|add_item)\s*\(",
        "literals": False,
        "why": "granting an item fabricates the reward under test",
    },
    {
        "pattern": r'\.set\s*\(\s*&?"(?:inventory|inventory_stacks)"',
        "literals": True,
        "why": "writing inventory directly fabricates custody",
    },
]

#: What each probe is for, what it expects today, and what would flip it. Kept in
#: Python rather than in the .gd header so the gate parses one structured source.
PROBES: Dict[str, Dict[str, object]] = {
    "first_hour_route_probe.gd": {
        "claim": "D_useful_reward_claimable",
        "question": "can a player walk to A1's Waystation and keep what A3 authorises?",
        "expected_today": "BLOCKED_L2_MOUNT",
        "board": "B0_NOT_MET",
        "closes": ["BLK-1", "BLK-2"],
        "requires": [
            "WaystationRuntime",
            "matches_interaction",
            "request_for",
            "interact_point",
            "pry_locker",
            "cache_restock",
            "si:r_ashen_crown:waystation_cache:01",
            "survival/a0_waystation_candidate",
            "cap_salvage",
            "player_interactable",
            "prompt_text",
            "reward_receipts",
            "world_slice",
        ],
        "a0_action": (
            "A0 only: declare survival/a0_waystation_candidate=true in project.godot and re-vendor A3's "
            "world_source_bindings.v3.json so the host's si: instance resolves. No A7 edit is needed."
        ),
    },
    "avatar_body_probe.gd": {
        "claim": "D_useful_reward_claimable",
        "question": "can a player choose the locked body and keep it across entry, death and reload?",
        "expected_today": "FAIL_NO_SELECTION_NO_MOUNTED_ADAPTER",
        "board": "B0_NOT_MET",
        "closes": ["BLK-5"],
        "requires": [
            "knight.tscn",
            "get_facing_direction",
            "armor_grades",
            "avatar_appearance_adapter",
            "pending_death",
        ],
        "a0_action": (
            "A0/A6: add a male/female choice to the profile step, reference A6's avatar_appearance_adapter "
            "from it, and mount the returned scene instead of knight.tscn. A6 must import one grade-0 sheet "
            "first; until then the adapter can only answer SOURCE_BLOCKED."
        ),
    },
    "bed_death_bag_probe.gd": {
        "claim": "B_route_runs_in_native_godot",
        "question": "is there a mounted threat that can kill a player, and does the same bag survive a restart?",
        "expected_today": "BLOCKED_NO_MOUNTED_THREAT",
        "board": "B0_NOT_MET",
        "closes": ["BLK-4"],
        "requires": [
            "pending_death",
            "death_bags",
            "begin_overworld_death",
            "recover_death_bag",
            "counters",
            "structures",
        ],
        "a0_action": (
            "A0/A5: mount one authored hazard or hostile with contact damage that calls begin_overworld_death(). "
            "SurvivalService has no environmental damage path at this pin, so death is fixture-only today."
        ),
    },
}


#: The D055–D061 contract probes and how they are judged. `expected_today` is the
#: outcome the probe must produce in *this* composition: every clause below is
#: absent from the pinned bytes, so a probe that reports PASS today would be
#: fabricating, and this table records the honest expectation.
D_PROBES: Dict[str, Dict[str, object]] = {
    "d055_d057_season_probe.gd": {
        "claim": "D055_D056_D057_season_closure",
        "question": "do 14 real calendar days close one season, reset gameplay, keep only achievements and history, and pay quests once per run?",
        "expected_today": "RED_NOT_IMPLEMENTED (no run_started_at, no expiry, no achievements/run_history, no quest state)",
        "board": "D_SERIES_NOT_MET",
        "closes": ["D055", "D056", "D057"],
        "requires": ["get_snapshot", "configure_storage"],
        "expects_absent": ["run_started_at", "run_expires_at", "run_history", "achievements"],
        "owner_action": (
            "A0: persist run_started_at/run_expires_at in the run record (14 x 24 x 3600 = 1209600 s), close the "
            "season once, keep only account achievements plus an immutable run history, and namespace quest "
            "receipts per run."
        ),
    },
    "d058_random_spawn_probe.gd": {
        "claim": "D058_broad_safe_random_starts",
        "question": "is a run start chosen from a broad, safe, reachable set of real A1 cells rather than one authored spawn?",
        "expected_today": "RED_NOT_IMPLEMENTED (no start selector, no eligible-cell set)",
        "board": "D_SERIES_NOT_MET",
        "closes": ["D058"],
        "requires": ["is_free", "reachable_from", "world_bounds"],
        "expects_absent": ["random_start", "choose_start", "pick_start", "select_start", "eligible_start"],
        "owner_action": (
            "A1: publish an eligible-start cell set (walkable, 3x3 clearance, hazard-free, reachable basic survival "
            "source) per authored region. A0: pick one per run from it, persist it with the run, never reuse the "
            "death/bed respawn cell."
        ),
    },
    "d059_offline_hunger_probe.gd": {
        "claim": "D059_shelter_floor_and_one_bag",
        "question": "does offline hunger alone stop at 1 HP inside a shelter while wilderness absence is a warned death with one durable bag?",
        "expected_today": "RED_NOT_IMPLEMENTED (no satiety/HP field, no last_seen_at, no offline settlement)",
        "board": "D_SERIES_NOT_MET",
        "closes": ["D059"],
        "requires": [],
        "expects_absent": ["satiety", "hunger", "starvation", "hp_floor", "last_seen_at", "settle_offline"],
        "owner_action": (
            "A0: persist satiety/HP with a last_seen_at UTC stamp and settle elapsed offline time once; clamp HP at 1 "
            "inside a valid owned shelter, apply real starvation outside it. A6: warn on logout and report on return."
        ),
    },
    "d060_world_time_probe.gd": {
        "claim": "D060_one_world_clock_no_double_settlement",
        "question": "does one persisted world clock settle 2 h, 18 h and 48 h of absence once, with bounded jobs and fuel?",
        "expected_today": "RED_NOT_IMPLEMENTED (clock_seconds persisted, but no absolute anchor to settle offline intervals)",
        "board": "D_SERIES_NOT_MET",
        "closes": ["D060"],
        "requires": ["clock_seconds", "transact_once", "is_transaction_applied"],
        "expects_absent": ["last_seen_at", "apply_elapsed", "advance_offline"],
        "owner_action": (
            "A3: add a durable UTC anchor next to the world clock and settle the elapsed interval atomically through "
            "the existing transact_once barrier, bounding prepared jobs and committed fuel at each interval."
        ),
    },
    "d061_trail_probe.gd": {
        "claim": "D061_footprint_only_home_discovery",
        "question": "can a monster reach home only through a trail it really detected, and never retroactively?",
        "expected_today": "RED_NOT_IMPLEMENTED (no footprint/trail state, no decay, no detection memory)",
        "board": "D_SERIES_NOT_MET",
        "closes": ["D061"],
        "requires": ["is_world_ready"],
        "expects_absent": ["footprint_trail", "trail_segments", "scent_decay", "last_known_position"],
        "owner_action": (
            "A0/A5: write durable timestamped trail segments from real actor movement, decay them by weather and age "
            "chronologically, let pursuit consume one sensed segment, and never persist a home coordinate on a "
            "monster."
        ),
    },
    "oracle_corruption_probe.gd": {
        "claim": "ORACLE_non_vacuity_under_corruption",
        "question": "does each product gate actually reject a corrupted receipt, identity, timestamp, stored stack, run scope or monster knowledge?",
        "expected_today": "RED_NOT_IMPLEMENTED (C5 run scope and C6 monster knowledge have no gate to attack)",
        "board": "D_SERIES_NOT_MET",
        "closes": ["D055", "D056", "D057", "D059", "D060", "D061"],
        "requires": ["transact_once", "is_transaction_applied", "get_snapshot"],
        "expects_absent": ["run_history", "last_known_position"],
        "owner_action": (
            "owners: every new durable record in D055–D061 must land behind an existing validating gate "
            "(transact_once receipt identity, schema/instance validation, monotonic time) so a corrupted record is "
            "refused rather than paid."
        ),
    },
}

#: The D harness is not a probe: it is the only place allowed to mount a scene.
HARNESS_RULES: Dict[str, object] = {
    "extends": "SceneTree",
    "add_child_budget": 1,
    "scene_prefix": "res://game/",
}


def _strip_comments(text: str, blank_strings: bool = True) -> str:
    """GDScript comments removed and string contents blanked.

    Two kinds of false positive have to be excluded, and both are real: a probe's
    own docstring may name a banned call to say it refuses to make it, and a
    refusal message may name the owner API it wants someone else to call. Only
    live code counts, so comments are cut and string bodies are replaced with
    empty quotes (line count and structure preserved).
    """
    out: List[str] = []
    for line in text.splitlines():
        cleaned: List[str] = []
        in_string = False
        for index, char in enumerate(line):
            if char == '"' and (index == 0 or line[index - 1] != "\\"):
                in_string = not in_string
                cleaned.append(char)
                continue
            if in_string:
                if not blank_strings:
                    cleaned.append(char)
                continue
            if char == "#":
                break
            cleaned.append(char)
        out.append("".join(cleaned))
    return "\n".join(out)


def audit_probe(
    path: Path,
    symbols: str,
    chain: str = CHAIN,
    forbidden: List[Dict[str, object]] = None,
    metadata: Dict[str, Dict[str, object]] = None,
) -> Dict[str, object]:
    """One probe's static soundness against the pinned product bytes."""
    text = path.read_text(encoding="utf-8")
    # Rules that match a literal must see literals; rules about code shape must
    # not. Blanking both would make the literal rules unreachable, which is the
    # same vacuity the rest of this tool exists to prevent.
    live = _strip_comments(text, blank_strings=True)
    literal = _strip_comments(text, blank_strings=False)
    extends = ""
    match = re.search(r'^extends\s+"([^"]+)"', text, re.MULTILINE)
    if match:
        extends = match.group(1)
    rules = list(forbidden if forbidden is not None else FORBIDDEN)
    spec_table = metadata if metadata is not None else PROBES
    violations: List[Dict[str, str]] = []
    for rule in rules:
        haystack = literal if rule["literals"] else live
        # MULTILINE so a rule that anchors on `^` (a local `class` declaration) can
        # actually reach a line start; without it that rule is dead and guards
        # nothing, which is exactly what its own liveness test caught.
        for hit in re.finditer(rule["pattern"], haystack, re.MULTILINE):
            line = haystack.count("\n", 0, hit.start()) + 1
            violations.append({"rule": rule["pattern"], "line": str(line), "why": rule["why"]})
    missing = [symbol for symbol in _requirements(path.name, spec_table) if symbol not in symbols]
    spec = spec_table.get(path.name, {})
    # `requires` names what the probe *calls*: it must exist or the probe cannot
    # run. `expects_absent` names what the probe has measured to be gone: if one
    # of those appears, the recorded expectation is stale and the probe must be
    # re-based before it can make any claim.
    absent = [symbol for symbol in (spec.get("expects_absent", []) or []) if symbol not in symbols]
    unexpectedly_present = [symbol for symbol in (spec.get("expects_absent", []) or []) if symbol in symbols]
    stale = [f"{symbol} exists now" for symbol in unexpectedly_present]
    on_chain = extends == chain
    return {
        "file": str(path.as_posix()),
        "extends": extends,
        "extends_shipped_chain": on_chain,
        "claim": spec.get("claim"),
        "question": spec.get("question"),
        "expected_today": spec.get("expected_today"),
        "board": spec.get("board"),
        "closes": spec.get("closes"),
        "requires_found": sorted(set(_requirements(path.name, spec_table)) - set(missing)),
        "expects_absent": list(spec.get("expects_absent", []) or []),
        "absent_confirmed": absent,
        "absent_unexpected": unexpectedly_present,
        "stale_expectations": stale,
        "requires_missing": missing,
        "forbidden": violations,
        "a0_action": spec.get("a0_action", spec.get("owner_action")),
        "sound": on_chain and not violations and not missing and not stale,
    }


def _requirements(name: str, table: Dict[str, Dict[str, object]] = None) -> List[str]:
    return list((table if table is not None else PROBES).get(name, {}).get("requires", []) or [])


def audit_decision_harness(path: Path) -> Dict[str, object]:
    """The one door through which a contract probe may observe a real world.

    A probe may not mount a scene, so the harness must: exactly one `add_child`,
    inside `_mount_world`, of a scene whose declared path lives under `res://game/`.
    """
    if not path.is_file():
        return {"file": str(path.as_posix()), "present": False, "sound": False,
                "why": "the contract harness is missing, so its probes cannot be trusted"}
    text = path.read_text(encoding="utf-8")
    live = _strip_comments(text, blank_strings=False)
    extends = ""
    match = re.search(r"^extends\s+(\S+)", text, re.MULTILINE)
    if match:
        extends = match.group(1)
    scene_paths = re.findall(r'^const\s+WORLD_SCENE\s*:?=\s*"([^"]+)"', text, re.MULTILINE)
    add_childs = list(re.finditer(r"\badd_child\s*\(", live))
    in_mount = bool(re.search(r"func\s+_mount_world\s*\(", live))
    reasons: List[str] = []
    if extends != HARNESS_RULES["extends"]:
        reasons.append("the harness must extend SceneTree and boot no application shell")
    if len(add_childs) != HARNESS_RULES["add_child_budget"]:
        reasons.append(f"exactly one add_child is allowed, found {len(add_childs)}")
    if not in_mount:
        reasons.append("_mount_world() is the declared door and is missing")
    if len(scene_paths) != 1 or not scene_paths[0].startswith(HARNESS_RULES["scene_prefix"]):
        reasons.append("WORLD_SCENE must name exactly one scene under res://game/")
    return {
        "file": str(path.as_posix()),
        "present": True,
        "extends": extends,
        "add_child_count": len(add_childs),
        "mount_door": "_mount_world" if in_mount else "",
        "world_scene": scene_paths[0] if scene_paths else "",
        "reasons": reasons,
        "sound": not reasons,
    }


def run(texts: Dict[str, str], root: Path) -> Dict[str, object]:
    """Audit every probe in the probe directory against the pinned texts."""
    # A symbol counts if it is in a pinned file's text *or* is the name of a pinned
    # file: the adapter existing as `a6.avatar_appearance_adapter.gd` is the symbol.
    symbols = "\n".join(list(texts.keys()) + list(texts.values()))
    directory = root / PROBE_DIR
    files = sorted(directory.glob("*.gd")) if directory.exists() else []
    probes = [audit_probe(path, symbols) for path in files]
    undeclared = [probe["file"] for probe in probes if probe["claim"] is None]
    defects = [probe["file"] for probe in probes if not probe["sound"]]

    # ---- D family: contract probes, same standards plus the staging bans ----
    decision_directory = root / DECISION_DIR
    decision_files = sorted(decision_directory.glob("*_probe.gd")) if decision_directory.exists() else []
    decision_probes = [
        audit_probe(
            path,
            symbols,
            chain=DECISION_CHAIN,
            forbidden=list(FORBIDDEN) + list(FORBIDDEN_CONTRACT),
            metadata=D_PROBES,
        )
        for path in decision_files
    ]
    decision_defects = [probe["file"] for probe in decision_probes if not probe["sound"]]
    decision_undeclared = [probe["file"] for probe in decision_probes if probe["claim"] is None]
    harness = audit_decision_harness(root / DECISION_DIR / DECISION_HARNESS)
    return {
        "schema": SCHEMA,
        "probe_count": len(probes),
        "executed": False,
        "evidence_class": "NATIVE_UNEXECUTED",
        "verdict": "PROBES_STATICALLY_SOUND_NOT_EXECUTED"
        if probes
        and not defects
        and not undeclared
        and not decision_defects
        and not decision_undeclared
        and harness["sound"]
        else "PROBE_DEFECT",
        "defects": defects,
        "undeclared": undeclared,
        "probes": probes,
        "decision_probe_count": len(decision_probes),
        "decision_defects": decision_defects,
        "decision_undeclared": decision_undeclared,
        "decision_probes": decision_probes,
        "decision_harness": harness,
        "families": [
            {
                "id": "A_JOURNEY",
                "directory": str(PROBE_DIR),
                "chain": CHAIN,
                "probe_count": len(probes),
                "defects": defects,
                "question": "can a player, through the normal entry, do the thing?",
                "claims_native": False,
            },
            {
                "id": "D_CONTRACT",
                "directory": str(DECISION_DIR),
                "chain": DECISION_CHAIN,
                "probe_count": len(decision_probes),
                "defects": decision_defects,
                "question": "does the composition implement the rule at all, and does it reject corruption?",
                "claims_native": False,
                "mount_door": "d_harness._mount_world()",
                "harness_sound": harness["sound"],
            },
        ],
        "proves": (
            "that each probe extends the shipped chain, contains none of the constructs that would fabricate "
            "its own result, and names only symbols that exist in the pinned owner bytes. It does NOT prove "
            "the probes pass: A7 has no Godot binary, so they are NATIVE_UNEXECUTED until an owner CI run or "
            "an A7 runner with Godot 4.7 executes them."
        ),
        "run_commands": [
            "godot --headless --path . --user-data-dir artifacts/ud_b0 --import",
            "xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 "
            "--script res://tests/survival/balance_native/first_hour_route_probe.gd",
            "xvfb-run -a godot --path . --user-data-dir artifacts/ud_b0 --resolution 1280x720 "
            "--script res://tests/survival/balance_native/first_hour_route_probe.gd -- --verify-separate-process",
        ],
        "exit_codes": {
            "0": "every check passed",
            "1": "a real check failed",
            "2": "blocked before the first player action; never a pass",
        },
    }
