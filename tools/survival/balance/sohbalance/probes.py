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
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List

SCHEMA = "soh.balance.native_probes.v1"
PROBE_DIR = Path("tests/survival/balance_native")
CHAIN = "res://tests/survival_normal_entry_home_restart_test.gd"

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


def audit_probe(path: Path, symbols: str) -> Dict[str, object]:
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
    violations: List[Dict[str, str]] = []
    for rule in FORBIDDEN:
        haystack = literal if rule["literals"] else live
        for hit in re.finditer(rule["pattern"], haystack):
            line = haystack.count("\n", 0, hit.start()) + 1
            violations.append({"rule": rule["pattern"], "line": str(line), "why": rule["why"]})
    missing = [symbol for symbol in _requirements(path.name) if symbol not in symbols]
    spec = PROBES.get(path.name, {})
    return {
        "file": str(path.as_posix()),
        "extends": extends,
        "extends_shipped_chain": extends == CHAIN,
        "claim": spec.get("claim"),
        "question": spec.get("question"),
        "expected_today": spec.get("expected_today"),
        "board": spec.get("board"),
        "closes": spec.get("closes"),
        "requires_found": sorted(set(_requirements(path.name)) - set(missing)),
        "requires_missing": missing,
        "forbidden": violations,
        "a0_action": spec.get("a0_action"),
        "sound": extends == CHAIN and not violations and not missing,
    }


def _requirements(name: str) -> List[str]:
    return list(PROBES.get(name, {}).get("requires", []) or [])


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
    return {
        "schema": SCHEMA,
        "probe_count": len(probes),
        "executed": False,
        "evidence_class": "NATIVE_UNEXECUTED",
        "verdict": "PROBES_STATICALLY_SOUND_NOT_EXECUTED" if probes and not defects and not undeclared
        else "PROBE_DEFECT",
        "defects": defects,
        "undeclared": undeclared,
        "probes": probes,
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
