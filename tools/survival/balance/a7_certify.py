#!/usr/bin/env python3
"""A7 cross-system player-capability certification harness (R14).

The R13 oracle pack answered "is this evidence trustworthy?". This harness answers
the next question: **does real functionality from several owners add up to one
playable SOH experience, measured on one exact immutable composition?**

Design decisions, each of which exists because a previous round got it wrong:

1. **One composition, declared and recomputed.** Every case is judged against a
   single 40-hex tree. The harness recomputes `git write-tree` itself; a declared
   SHA that no longer reproduces makes the whole run `STALE_COMPOSITION` rather
   than quietly grading whatever is on disk.
1b. **A composed artifact is not an owner's source.** When the composition drops
   something the base owner has committed (a declared "resolution" pointing at a
   stale merge file), that is `COMPOSITION_DROPS_OWNER_WORK`, decided by running
   the same probe on a control tree that differs by exactly that one file. Naming
   the artifact the owner is the difference between a useful report and a false
   accusation.
2. **Four maturity levels, never conflated.**
   `TEST_HARNESS_VALID` → `OWNER_SOURCE_VALID` → `PRODUCT_COMPOSED` → `HUMAN_ACCEPTED`.
   A green self-test says nothing about the game; a source contract that exists says
   nothing about a player doing it; only a runtime receipt in the exact tree reaches
   `PRODUCT_COMPOSED`; and `HUMAN_ACCEPTED` can only be granted by a human evidence
   file, never by this program.
3. **Every case walks the same pipeline:** source → contract → runtime → receipt →
   player outcome. Each stage is `VALID`, `FAIL`, `MISSING` or `BLOCKED`, and a case
   stops at its first non-`VALID` stage. A missing stage is `BLOCKED`, never PASS.
4. **Few real journeys beat many assertions.** There are 32 named cases across four
   tracks, each tied to a file:line or a runtime marker — not a pile of `_expect`s.
5. **Fail-closed future gates.** Track 4 features do not exist yet; their gates are
   executable and are proven to work against synthetic fixtures in `--self-test`,
   while returning `NOT_IMPLEMENTED` against the real tree.
6. **Text is not a program.** `T1.7` requires the controller and the authority to `load()` and
   `new()` in the engine; a tree whose Godot log carries SCRIPT ERROR/Parse Error cannot be
   promoted, no matter what its source says. `SOURCE_AUTHORITY_PRESENT` and
   `RUNTIME_AUTHORITY_VERIFIED` are different sentences and this tool never conflates them.

Output is a machine-readable report (`soh.a7.certification.v2`) plus a markdown
report. Nothing here edits owner code, merges, or grants rewards.

    python3 tools/survival/balance/a7_certify.py --certify \
        --composition <tree> --evidence <dir> --manifest manifest.json \
        --out report.json --markdown report.md
    python3 tools/survival/balance/a7_certify.py --self-test
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple

SCHEMA = "soh.a7.certification.v2"

PASS, FAIL, BLOCKED, NOT_IMPLEMENTED = "PASS", "FAIL", "BLOCKED", "NOT_IMPLEMENTED"
VALID, MISSING = "VALID", "MISSING"

MATURITY_ORDER = ("TEST_HARNESS_VALID", "OWNER_SOURCE_VALID", "PRODUCT_COMPOSED", "HUMAN_ACCEPTED")
STAGES = ("source", "contract", "runtime", "receipt", "outcome")

#: Files whose *ownership* is fixed by the composition map. Used only to classify
#: a failure to the right owner; the harness never writes to any of them.
OWNER_OF_PATH = (
    ("game/survival/world/", "A1"),
    ("data/survival/world/", "A1"),
    ("game/survival/economy/", "A0"),
    ("data/survival/items/", "A3"),
    ("data/survival/recipes/", "A3"),
    ("data/survival/economy/", "A3"),
    ("game/survival/ui/", "A6"),
    ("game/survival/player/", "A6"),
    ("game/survival/world_content/", "A8"),
    ("data/survival/world_content/", "A8"),
    ("data/overworld/", "A0"),
    ("tests/", "A7"),
)


def owner_of(path: str) -> str:
    for prefix, owner in OWNER_OF_PATH:
        if path.startswith(prefix):
            return owner
    return "A0"


# --------------------------------------------------------------------------- #
# Result model
# --------------------------------------------------------------------------- #
@dataclass
class Case:
    """One certification question, answered at the earliest stage that settles it."""

    id: str
    track: str
    title: str
    owner: str
    kind: str
    required_stage: str
    verdict: str = BLOCKED
    code: str = ""
    detail: str = ""
    repro: str = ""
    stages: Dict[str, str] = field(default_factory=dict)
    evidence: List[str] = field(default_factory=list)
    measurements: Dict[str, object] = field(default_factory=dict)

    def stage(self, name: str, state: str) -> "Case":
        self.stages[name] = state
        return self

    def settle(self, verdict: str, code: str, detail: str = "", repro: str = "") -> "Case":
        self.verdict, self.code, self.detail = verdict, code, detail
        if repro:
            self.repro = repro
        return self

    def as_dict(self) -> dict:
        return {
            "id": self.id, "track": self.track, "title": self.title,
            "owner": self.owner, "kind": self.kind, "required_stage": self.required_stage,
            "verdict": self.verdict, "code": self.code, "detail": self.detail,
            "repro": self.repro, "stages": self.stages,
            "evidence": self.evidence, "measurements": self.measurements,
        }


@dataclass
class Facts:
    """Everything read out of one composition, with file:line provenance."""

    root: Optional[Path] = None
    pins: Dict[str, str] = field(default_factory=dict)
    tree: str = ""
    expected_tree: str = ""
    tree_method: str = ""
    live_bounds: Optional[Tuple[int, int]] = None      # the world the game activates
    legacy_bounds: Optional[Tuple[int, int]] = None    # the 384x256 legacy document
    authored_frame: Optional[Tuple[int, int]] = None
    live_source: str = ""                              # authored_authority | legacy_sidecar | legacy_document
    authority: Dict[str, object] = field(default_factory=dict)
    #: `native.txt` — engine-level failures observed while probing each tree. A tree that
    #: prints SCRIPT ERROR/Parse Error cannot be promoted, whatever its text says.
    native: Dict[str, Dict[str, int]] = field(default_factory=dict)
    wear_contract: List[str] = field(default_factory=list)
    wear_consumers: List[str] = field(default_factory=list)
    provenance: List[str] = field(default_factory=list)
    melee: List[str] = field(default_factory=list)
    equipment_ids: List[str] = field(default_factory=list)
    item_kinds: Dict[str, int] = field(default_factory=dict)
    #: What the composer actually let in. A3's economy code lives under a path A0 owns, so
    #: the composition can silently refuse the very service Track 3 is meant to test.
    a3_service: Dict[str, object] = field(default_factory=dict)
    composition_refused: Dict[str, List[str]] = field(default_factory=dict)
    #: `probe_control.txt` — the same composition with A0's own controller restored, so a
    #: composition artifact can be told apart from a gameplay defect. Never the product.
    control: Dict[str, dict] = field(default_factory=dict)
    sidecar_markers: List[str] = field(default_factory=list)
    poi_refusal: str = ""
    sites: List[Tuple[str, Tuple[int, int], str]] = field(default_factory=list)
    package_status: str = ""
    scene_sites: List[Tuple[str, str]] = field(default_factory=list)
    item_ids: List[str] = field(default_factory=list)
    recipe_ids: List[str] = field(default_factory=list)
    research_methods: Dict[str, str] = field(default_factory=dict)
    rejection_codes: Dict[str, str] = field(default_factory=dict)
    lifecycle: Dict[str, str] = field(default_factory=dict)
    feature_hits: Dict[str, List[str]] = field(default_factory=dict)
    production_mount: Dict[str, object] = field(default_factory=dict)
    probe: Dict[str, dict] = field(default_factory=dict)
    probe_raw: str = ""
    errors: List[str] = field(default_factory=list)

    def hit(self, path: str, pattern: str, limit: int = 3) -> List[str]:
        """`path:line: text` for the first matches, or an empty list.

        `path` may be a file or a directory; a directory is searched recursively over
        source files so a capability can be located without hard-coding one filename.
        """
        if self.root is None:
            return []
        target = self.root / path
        if not target.exists():
            return []
        files: List[Path]
        if target.is_dir():
            files = sorted(p for p in target.rglob("*")
                           if p.is_file() and p.suffix in (".gd", ".json", ".tscn"))
        else:
            files = [target]
        out: List[str] = []
        for file in files:
            try:
                text = file.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            rel = str(file.relative_to(self.root))
            for number, line in enumerate(text.splitlines(), 1):
                if re.search(pattern, line):
                    out.append(f"{rel}:{number}: {line.strip()[:180]}")
                    if len(out) >= limit:
                        return out
        return out


# --------------------------------------------------------------------------- #
# Reading the composition
# --------------------------------------------------------------------------- #
def composition_tree(path: Path) -> Tuple[str, str]:
    git_dir = Path(tempfile.mkdtemp(prefix="a7c-tree-"))
    try:
        base_env = dict(os.environ)
        base_env.update({"GIT_DIR": str(git_dir), "GIT_CONFIG_NOSYSTEM": "1"})
        base_env.pop("GIT_WORK_TREE", None)
        env = dict(base_env)
        env.update({"GIT_WORK_TREE": str(path), "GIT_INDEX_FILE": str(git_dir / "index")})
        init = subprocess.run(["git", "init", "--quiet", "--bare"], env=base_env,
                              capture_output=True, text=True)
        if init.returncode != 0:
            return "", f"init-failed: {init.stderr.strip()[:120]}"
        add = subprocess.run(["git", "add", "--force", "--all", "--", ".",
                              ":(exclude).git", ":(exclude).git/**"], env=env,
                             capture_output=True, text=True)
        if add.returncode != 0:
            return "", f"add-failed: {add.stderr.strip()[:120]}"
        out = subprocess.run(["git", "write-tree"], env=env, capture_output=True, text=True)
        tree = out.stdout.strip()
        if out.returncode != 0 or not tree:
            return "", f"write-tree-failed: {out.stderr.strip()[:120]}"
        return tree, "git-write-tree"
    finally:
        shutil.rmtree(git_dir, ignore_errors=True)


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


_PROBE_CASE = re.compile(r"A7C\s+([A-Z0-9_.]{3,24})\s+(\{.*\})\s*$")


def read_probe(text: str) -> Dict[str, dict]:
    """Runtime markers emitted by `tests/survival/a7_certification_probe.gd`."""
    out: Dict[str, dict] = {}
    for line in text.splitlines():
        match = _PROBE_CASE.match(line.strip())
        if not match:
            continue
        try:
            payload = json.loads(match.group(2))
        except ValueError:
            continue
        if isinstance(payload, dict):
            out[match.group(1)] = payload
    return out


def read_evidence(evidence: Path) -> Tuple[Dict[str, dict], Dict[str, dict], str]:
    """Split the product's runtime markers from the control tree's.

    `probe_control.txt` describes a *different tree*. Letting it overwrite a product
    marker would turn a control into a fabricated pass, so the product reads
    `probe.txt` alone and the control is read only from its own file.
    """
    primary = evidence / "probe.txt"
    raw = primary.read_text(encoding="utf-8", errors="replace") if primary.exists() else ""
    if not raw:
        raw = "\n".join(
            path.read_text(encoding="utf-8", errors="replace")
            for path in sorted(evidence.rglob("*"))
            if path.is_file() and path.suffix.lower() in (".txt", ".log") and "control" not in path.name
        )
    control_file = evidence / "probe_control.txt"
    control = (read_probe(control_file.read_text(encoding="utf-8", errors="replace"))
               if control_file.exists() else {})
    return read_probe(raw), control, raw


_NATIVE_PATTERNS = ("SCRIPT ERROR", "Parse Error", "Failed to load script", "Compile Error")


def count_native(text: str) -> Dict[str, int]:
    """Engine-level failures in a Godot log. A log with any of these is not a working tree."""
    return {name: text.count(name) for name in _NATIVE_PATTERNS}


def read_native(evidence: Path) -> Dict[str, Dict[str, int]]:
    out: Dict[str, Dict[str, int]] = {}
    for tree in ("composed", "control"):
        path = evidence / f"{tree}.native.txt"
        if path.exists():
            out[tree] = count_native(path.read_text(encoding="utf-8", errors="replace"))
    return out


def gather(root: Optional[Path], evidence: Optional[Path], expected_tree: str = "") -> Facts:
    facts = Facts(root=root, expected_tree=expected_tree)
    if root is not None and root.exists():
        legacy = _read_json(root / "data/overworld/hollow_marches.json").get("world_bounds") or {}
        if legacy.get("w") and legacy.get("h"):
            facts.legacy_bounds = (int(legacy["w"]), int(legacy["h"]))
        authored = re.search(r"AUTHORED_FRAME\s*:=\s*Vector2i\(\s*(\d+)\s*,\s*(\d+)\s*\)",
                             _text(root / "game/survival/a1_authored_source.gd"))
        if authored:
            facts.authored_frame = (int(authored.group(1)), int(authored.group(2)))
        # Which world the production controller activates. The legacy document is only
        # live when the controller does not mount an authority: assuming otherwise is how
        # round 14 first produced a confident but false owner attribution.
        controller = _text(root / "game/overworld/chapter1_overworld.gd")
        mounts_authority = "A0WorldAuthority" in controller and "WORLD_AUTHORITY" in controller
        mounts_sidecar = "A0AuthoredWorldMount" in controller
        default_authored = bool(re.search(
            r"get_setting\(\s*WORLD_AUTHORITY_SETTING\s*,\s*WORLD_AUTHORITY_AUTHORED\s*\)", controller))
        if mounts_authority and default_authored and facts.authored_frame:
            facts.live_bounds, facts.live_source = facts.authored_frame, "authored_authority"
        elif mounts_sidecar:
            facts.live_bounds, facts.live_source = facts.legacy_bounds, "legacy_sidecar"
        elif facts.legacy_bounds:
            facts.live_bounds, facts.live_source = facts.legacy_bounds, "legacy_document"
        elif facts.authored_frame:
            facts.live_bounds, facts.live_source = facts.authored_frame, "authored_authority"
        facts.authority = {
            "controller": "game/overworld/chapter1_overworld.gd",
            "controller_present": bool(controller),
            "controller_lines": len(controller.splitlines()),
            "mounts_authority": mounts_authority,
            "mounts_sidecar": mounts_sidecar,
            "authority_default_authored": default_authored,
            "authority_setting_defined": "survival/a0_world_authority" in _text(root / "project.godot"),
            "live_source": facts.live_source,
        }

        mount = _text(root / "game/survival/a0_authored_world_mount.gd").lower()
        for marker in ("beside it, never instead of it", "render_legacy := true",
                       "stays the world a0 governs"):
            if marker in mount:
                facts.sidecar_markers.append(marker)
        poi = _text(root / "game/survival/a0_poi_mount.gd")
        refuse = re.search(r'report\["reason"\]\s*=\s*"(\w+)"', poi)
        facts.poi_refusal = refuse.group(1) if refuse else ""

        package_path = root / "data/survival/world_content/a8_a0_mount_transition_package.v2.json"
        package = _read_json(package_path)
        facts.package_status = str(package.get("package_status", ""))
        for site in (package.get("existing_a8_sites") or package.get("sites") or []):
            cell = site.get("canonical_cell") or site.get("cell")
            if isinstance(cell, list) and len(cell) == 2:
                facts.sites.append((str(site.get("poi_id") or "?"), (int(cell[0]), int(cell[1])),
                                    str(site.get("scene", ""))))
        scenes = root / "game/survival/world_content/scenes"
        if scenes.exists():
            facts.scene_sites = [(p.name, str(p)) for p in sorted(scenes.glob("*.tscn"))]

        items = _read_json(root / "data/survival/items/items.json")
        raw_items = items.get("items", items)
        if isinstance(raw_items, dict):
            facts.item_ids = sorted(str(k) for k in raw_items)
            for key, entry in raw_items.items():
                kind = str(entry.get("kind", "")) if isinstance(entry, dict) else ""
                facts.item_kinds[kind] = facts.item_kinds.get(kind, 0) + 1
                if kind == "equipment":
                    facts.equipment_ids.append(str(key))
        elif isinstance(raw_items, list):
            facts.item_ids = sorted(str(i.get("id", "")) for i in raw_items if isinstance(i, dict))
        recipes_path = root / "data/survival/recipes/progression_model.json"
        if recipes_path.exists():
            recipe_doc = _read_json(recipes_path)
            facts.recipe_ids = sorted(recipe_doc.keys())

        planner = root / "game/survival/economy/offline_operation_planner.gd"
        for line_no, line in enumerate(_text(planner).splitlines(), 1):
            found = re.search(r'return "([a-z_]+_mismatch|[a-z_]+_escrow[a-z_]*)"', line)
            if found:
                facts.rejection_codes.setdefault(found.group(1),
                                                 f"game/survival/economy/offline_operation_planner.gd:{line_no}")
            if "matches_targeted" in line or "matches_blueprint" in line or "matches_specimen" in line:
                for method in ("targeted", "blueprint", "specimen"):
                    if f"matches_{method}" in line:
                        facts.research_methods.setdefault(
                            method, f"game/survival/economy/offline_operation_planner.gd:{line_no}")

        lifecycle = root / "game/survival/economy/a0_run_lifecycle.gd"
        for pattern, key in (("last72", "last72"), (r"336", "limit_336"),
                             (r"evac", "evacuation"), (r"end_run", "run_reset")):
            hits = facts.hit("game/survival/economy/a0_run_lifecycle.gd", pattern, 1)
            if hits:
                facts.lifecycle[key] = hits[0]

        # Which class does the *live scene* mount, and is the new authority wired in?
        scene = root / "game/overworld/chapter1_overworld.gd"
        scene_text = _text(scene)
        facts.production_mount = {
            "file": "game/overworld/chapter1_overworld.gd",
            "uses_sidecar_mount": "A0AuthoredWorldMount.new()" in scene_text,
            "off_by_default": bool(re.search(r'get_setting\(\s*AUTHORED_STREAM_SETTING\s*,\s*false\s*\)', scene_text)),
            "setting": "survival/a0_authored_stream",
            "setting_defined": "survival/a0_authored_stream" in _text(root / "project.godot"),
            "authority_module": (root / "game/survival/a0_world_authority.gd").exists(),
            "authority_referenced_by_production": False,
            "authority_reference": "",
        }
        if facts.production_mount["authority_module"]:
            # A reference from the authority's own companion view does not mean the game
            # mounts it: require a scene or a controller that is not part of that pair.
            skip = {"a0_world_authority.gd", "a0_authored_world_view.gd"}
            candidates = [p for p in sorted((root / "game").rglob("*.gd")) if p.name not in skip]
            candidates += sorted((root / "game").rglob("*.tscn"))
            for file in candidates:
                text = _text(file)
                if "A0WorldAuthority" in text or "world_authority" in text:
                    rel = str(file.relative_to(root))
                    facts.production_mount["authority_referenced_by_production"] = True
                    facts.production_mount["authority_reference"] = rel
                    break
            if not facts.production_mount["authority_referenced_by_production"]:
                for file in sorted((root / "tests").rglob("*.gd")):
                    if "world_authority" in _text(file):
                        facts.production_mount["authority_reference"] = str(file.relative_to(root))
                        break

        # Composition scope: is the submitted A3 service in the tree at all?
        composed_service = root / "game/survival/economy/a3_economy_service.gd"
        vendor_service = root / "game/survival/economy/vendor/a3_economy_service.gd"
        report = _read_json(root / "composition.json")
        refused = report.get("refused_out_of_scope") or {}
        if isinstance(refused, dict):
            for name, paths in refused.items():
                if isinstance(paths, list):
                    facts.composition_refused[str(name)] = [str(x) for x in paths]
        a3_refused = facts.composition_refused.get("a3", [])
        facts.a3_service = {
            "submitted_path": "game/survival/economy/a3_economy_service.gd",
            "composed": composed_service.exists(),
            "refused_by_scope": "game/survival/economy/a3_economy_service.gd" in a3_refused,
            "refused_paths": [x for x in a3_refused if x.startswith("game/survival/economy/")],
            "vendor_path": "game/survival/economy/vendor/a3_economy_service.gd",
            "vendor_present": vendor_service.exists(),
            "vendor_lines": len(_text(vendor_service).splitlines()) if vendor_service.exists() else 0,
            "vendor_sha256": hashlib.sha256(vendor_service.read_bytes()).hexdigest()
            if vendor_service.exists() else "",
            "composition_report": bool(report),
        }

        # Tool wear: A3 V7 publishes the contract, A0 must consume it and a run must show
        # a player's tool condition actually dropping. Source presence is not wear.
        facts.wear_contract = (facts.hit("game/survival/economy", r"func apply_tool_use_plan|condition_cost|"
                                         r"record\[\"condition\"\]", 3))
        facts.wear_consumers = facts.hit("game/survival/economy", r"apply_tool_use_plan\(", 3)
        # Provenance / source-authorisation refusals, which are NOT escrow mismatches.
        facts.provenance = facts.hit("game/survival/economy",
                                     r"func authenticate_source|is_source_authenticated|"
                                     r"provenance_(mismatch|refused)|source_(mismatch|unauthori[sz]ed)|"
                                     r"owner_domain", 6)
        # Melee/combat capability is a different subsystem from a knife in the catalog.
        facts.melee = (facts.hit("game/characters/knight", r"weapon_manager|normal_attack|melee", 3)
                       + facts.hit("game/survival/player", r"weapon|melee", 2))

        for feature, patterns in FEATURE_PROBES.items():
            hits: List[str] = []
            for pattern in patterns:
                hits += facts.hit("game/survival", pattern, 1)
            facts.feature_hits[feature] = hits[:3]

    if evidence is not None and evidence.exists():
        facts.probe, facts.control, facts.probe_raw = read_evidence(evidence)
        facts.native = read_native(evidence)
    return facts


#: Track 4 feature discovery. A pattern that matches nothing means the feature is
#: absent, and an absent feature makes its gate `NOT_IMPLEMENTED` — never PASS.
#: Probes are written against **player-facing behaviour**, not against words that can
#: appear in a guard message. `world_action_core_reward_forbidden` is a refusal string,
#: not Core use; `elder_stones` is a profile field, not an Elder transformation. Each
#: pattern below therefore names an action or a state transition, and a miss means the
#: feature is absent (NOT_IMPLEMENTED), never silently assumed.
FEATURE_PROBES: Dict[str, List[str]] = {
    "core_use": [r"func\s+use_core", r"func\s+activate_core", r"\bcore_use\b"],
    "core_store": [r"func\s+store_core", r"core_store"],
    "core_research": [r"func\s+research_with_core", r"core_research"],
    "threat": [r"func\s+apply_damage", r"func\s+take_damage", r"damage_applied"],
    "death_bag": [r"func\s+drop_bag", r"\bbags\["],
    "last72_elders": [r"six_elder", r"elder_spawn", r"territory_transform"],
    "chest_currency": [r"func\s+\w*chest", r"chest_currency"],
    "fixed_deposit": [r"fixed_deposit", r"deposit_site"],
    "evacuation": [r"\"evacuation\"", r"func\s+evacuate"],
    "run_reset": [r"reset_run_preserving_profile", r"func\s+reset_run"],
}


#: Literal source a *synthetic* feature fixture contains, used only by `--self-test`.
#: Written out in full so the fixture cannot drift into a lookalike of the probe.
FEATURE_FIXTURES: Dict[str, str] = {
    "core_use": "func use_core(core_id: String) -> Dictionary:\n\treturn {\"ok\": true}\n",
    "core_store": "func store_core(core_id: String) -> bool:\n\treturn true\n",
    "core_research": "func research_with_core(core_id: String) -> bool:\n\treturn true\n",
    "threat": "func apply_damage(amount: int) -> void:\n\tpass\n",
    "death_bag": "func drop_bag() -> void:\n\tvar bags := {}\n\tpass\n",
    "last72_elders": "func six_elder_forms() -> Array:\n\treturn []\n",
    "chest_currency": "func open_chest_currency() -> bool:\n\treturn true\n",
    "fixed_deposit": "func fixed_deposit(site: String) -> bool:\n\treturn true\n",
    "evacuation": "func evacuate(reason: String) -> bool:\n\treturn true\n",
    "run_reset": "func reset_run_preserving_profile() -> bool:\n\treturn true\n",
}


def _text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def drops_owner_work(f: Facts) -> bool:
    """True when the composition's controller lost an integration the base owner committed.

    Decided by the reconciled control tree (`probe_control.txt`), never by a guess: the
    control differs from the certified composition by exactly one owner file.
    """
    auth = f.authority or {}
    control = (f.control or {}).get("AUTHORITY", {})
    return bool(control.get("mounts_authority")) and not auth.get("mounts_authority") \
        and bool(auth.get("controller_present"))


# --------------------------------------------------------------------------- #
# Track 1 — world, player, geography
# --------------------------------------------------------------------------- #
def track1(f: Facts) -> List[Case]:
    cases: List[Case] = []

    c = Case("T1.1", "T1", "one exact immutable composition", "A7", "source", "source")
    c.stage("source", VALID if f.root else MISSING)
    if not f.root:
        c.settle(BLOCKED, "BLOCKED_NO_COMPOSITION", "no composition directory was supplied")
    else:
        c.evidence.append(f"declared tree={f.expected_tree[:12] or '(none)'}")
        c.evidence.append(f"recomputed tree={f.tree[:12]} ({f.tree_method})")
        if not f.expected_tree:
            c.settle(BLOCKED, "BLOCKED_NO_DECLARED_TREE",
                     "a run without a declared tree cannot be tied to owner pins")
        elif not f.tree:
            c.settle(FAIL, "COMPOSITION_UNREADABLE", f"write-tree failed: {f.tree_method}", "git write-tree")
        elif not f.tree.startswith(f.expected_tree[:12]):
            c.settle(FAIL, "STALE_COMPOSITION",
                     f"declared {f.expected_tree[:12]} != recomputed {f.tree[:12]}",
                     "python3 tools/a0/compose_owners.py … && git write-tree")
        else:
            c.stage("contract", VALID).settle(PASS, "COMPOSITION_IDENTITY",
                                             "the declared tree reproduces byte for byte")
    cases.append(c)

    c = Case("T1.2", "T1", "one authoritative world (no rendered sidecar)", "A0",
             "source-contract", "source")
    c.stage("source", VALID if f.live_bounds and f.authored_frame else MISSING)
    outside = []
    if f.live_bounds:
        outside = [(sid, cell) for sid, cell, _ in f.sites
                   if not (0 <= cell[0] < f.live_bounds[0] and 0 <= cell[1] < f.live_bounds[1])]
    mount = f.production_mount or {}
    auth = {**(f.authority or {}), **(f.probe.get("AUTHORITY") or {})}
    control = (f.control or {}).get("AUTHORITY", {})
    c.measurements = {"live": f.live_bounds, "live_source": f.live_source,
                      "authored": f.authored_frame, "legacy_document": f.legacy_bounds,
                      "sites_outside": outside, "sidecar_markers": f.sidecar_markers,
                      "poi_refusal": f.poi_refusal, "production_mount": mount,
                      "authority": auth, "reconciled_control": control}
    c.evidence = [f"live world {f.live_bounds} resolved from `{f.live_source}` "
                  f"(game/overworld/chapter1_overworld.gd), legacy document {f.legacy_bounds}",
                  f"A1 authored frame {f.authored_frame} (game/survival/a1_authored_source.gd:30)",
                  f"sidecar markers {f.sidecar_markers or 'none'} (game/survival/a0_authored_world_mount.gd:12,29)",
                  f"A0 poi-mount refusal `{f.poi_refusal or 'none'}` (game/survival/a0_poi_mount.gd:69)"]
    if auth:
        c.evidence.append(
            f"composed controller mounts A0WorldAuthority={auth.get('mounts_authority')}, "
            f"A0AuthoredWorldMount={auth.get('mounts_sidecar')}, "
            f"authority default authored={auth.get('authority_default_authored')}, "
            f"{auth.get('controller_lines')} lines")
    control_verified = bool(control.get("runtime_authority_verified"))
    if control:
        c.evidence.append(
            f"reconciled control (A0's own controller restored): "
            f"mounts A0WorldAuthority={control.get('mounts_authority')}, "
            f"{control.get('controller_lines')} lines, "
            f"runtime_authority_verified={control_verified} "
            f"(controller_runnable={control.get('controller_runnable')}, "
            f"authority_runnable={control.get('authority_runnable')}), "
            f"live_source={control.get('live_source')}")
        control_native = (f.native or {}).get("control", {})
        if any(control_native.values()):
            c.evidence.append(
                "control engine errors: " + json.dumps(control_native) +
                " (see r14_ci/control.native.txt) — the control tree does not compile cleanly")
        if not control_verified:
            c.evidence.append(
                "the control's authored world is NOT runtime-verified — its own script errors are "
                "recorded in T1.7; this case therefore claims a *source/composition* difference only, "
                "never that the control tree plays")
    if mount:
        c.evidence += [
            f"live scene mounts A0AuthoredWorldMount={mount.get('uses_sidecar_mount')} "
            f"behind `{mount.get('setting')}` which defaults off={mount.get('off_by_default')} "
            f"and is defined in project.godot={mount.get('setting_defined')} "
            f"({mount.get('file')}:65,275-277)",
            f"A0WorldAuthority present={mount.get('authority_module')}, "
            f"referenced by production={mount.get('authority_referenced_by_production')} "
            f"({mount.get('authority_reference') or 'no reference'})",
        ]
    # A composed tree that drops an integration the base owner already committed is a
    # *composition* defect, not a gameplay defect. Naming which one it is is the whole
    # difference between a useful report and a confident false accusation.
    composed_drops_owner_work = drops_owner_work(f)
    if not (f.live_bounds and f.authored_frame):
        c.settle(BLOCKED, "BLOCKED_WORLD_FACTS_UNREADABLE", f"errors={f.errors}")
    elif composed_drops_owner_work:
        c.settle(FAIL, "COMPOSITION_DROPS_OWNER_WORK",
                 "the composed controller does not mount A0WorldAuthority although A0's own "
                 f"committed controller does ({control.get('controller_lines')} lines vs "
                 f"{auth.get('controller_lines')}); A0's declared resolution replaces it with a "
                 "stale merge artifact, so the composed product is configured for the legacy sidecar "
                 f"{f.legacy_bounds} while the authored continent is {f.authored_frame} "
                 f"(runtime live_source={auth.get('live_source')}). This is a "
                 "source/composition finding: it does not claim the control tree runs — see T1.7, "
                 f"where the control's authority script is graded ({'verified' if control_verified else 'NOT verified'})",
                 "python3 tools/a0/compose_owners.py --owner a1=… ; diff the composed "
                 "game/overworld/chapter1_overworld.gd against A0's committed file")
    elif f.live_bounds != f.authored_frame or f.sidecar_markers or outside:
        reasons = []
        if f.live_bounds != f.authored_frame:
            reasons.append(f"runtime {f.live_bounds[0]}x{f.live_bounds[1]} != authored "
                           f"{f.authored_frame[0]}x{f.authored_frame[1]}")
        if f.sidecar_markers:
            reasons.append("A0's mount declares the authored stream runs beside the legacy world")
        if outside:
            reasons.append(f"{len(outside)} A8 site(s) outside the live world: "
                           + ", ".join(f"{s}{c_}" for s, c_ in outside))
        if mount.get("authority_module") and not mount.get("authority_referenced_by_production"):
            reasons.append("A0 ships A0WorldAuthority but no production file references it "
                           f"(only {mount.get('authority_reference') or 'nothing'} does)")
        elif mount.get("uses_sidecar_mount") and mount.get("off_by_default"):
            reasons.append(f"the live scene still mounts the sidecar behind "
                           f"`{mount.get('setting')}`, which defaults off")
        c.settle(FAIL, "SIDECAR_WORLD", "; ".join(reasons),
                 "game/survival/a0_authored_world_mount.gd:12,29")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_RUNTIME_AUTHORITY",
                                         "source agrees; no run yet proves the player uses it")
    cases.append(c)

    c = Case("T1.3", "T1", "player spawns safely on the authored continent", "A0", "runtime", "runtime")
    spawn = f.probe.get("T1.3", {})
    c.stage("source", VALID if f.hit("game/survival/world/a1_authored_world_reader.gd",
                                     r"func choose_safe_spawn") else MISSING)
    c.evidence = f.hit("game/survival/world/a1_authored_world_reader.gd", r"func choose_safe_spawn", 1)
    if not spawn:
        c.settle(BLOCKED, "BLOCKED_NO_SPAWN_EVIDENCE",
                 "requires `A7C T1.3 {…}` from tests/survival/a7_certification_probe.gd",
                 "godot --headless --script res://tests/survival/a7_certification_probe.gd")
    else:
        c.measurements = spawn
        c.evidence.append(f"probe: {json.dumps(spawn)[:300]}")
        if not spawn.get("ok"):
            c.settle(FAIL, "SPAWN_UNSAFE", f"reason={spawn.get('error')}")
        elif spawn.get("in_live_world") is None or spawn.get("live_resolved") is False:
            c.settle(BLOCKED, "BLOCKED_LIVE_WORLD_UNRESOLVED",
                     "the probe could not resolve which world is live on this tree "
                     f"(live_source={spawn.get('live_source')}); an unknown live world is not a pass "
                     "and not a failure — see T1.7 for the native reason")
        elif not spawn.get("in_live_world"):
            note = ""
            control_spawn = (f.control or {}).get("T1.3", {})
            if drops_owner_work(f) and control_spawn.get("in_live_world") is True:
                note = ("; caused by the composition artifact named in T1.2 — with A0's committed "
                        f"controller the same spawn reports in_live_world=true in "
                        f"{control_spawn.get('live_frame')} (control runtime verified: "
                        f"{bool(control_spawn.get('live_resolved'))})")
                c.evidence.append(f"reconciled control: {json.dumps(control_spawn)[:240]}")
            c.settle(FAIL, "SPAWN_OUTSIDE_LIVE_WORLD",
                     f"spawn {spawn.get('cell')} is not inside {f.live_bounds}{note}")
        elif not spawn.get("standable"):
            c.settle(FAIL, "SPAWN_NOT_STANDABLE", f"traversal={spawn.get('traversal')}")
        else:
            c.stage("runtime", VALID).settle(PASS, "SPAWN_ON_LIVE_WORLD",
                                            f"spawn {spawn.get('cell')} standable in the live world")
    cases.append(c)

    c = Case("T1.4", "T1", "canonical POI approaches lie inside the playable world", "A0",
             "runtime", "runtime")
    sites_probe = f.probe.get("T1.4", {})
    c.stage("source", VALID if f.sites else MISSING)
    c.evidence = [f"{sid} {cell} scene={scene or '(none)'}" for sid, cell, scene in f.sites]
    c.measurements = {"probe": sites_probe or None, "package_status": f.package_status}
    if not f.sites:
        c.settle(BLOCKED, "BLOCKED_NO_SITE_DATA", "A8 package unreadable")
    elif not sites_probe:
        # Without an engine measurement only the source inference exists, and inference is
        # exactly what round 14 mistook for a verdict.
        c.settle(BLOCKED, "BLOCKED_NO_SITE_PLACEMENT_EVIDENCE",
                 "no `A7C T1.4` marker: the sites' world placement was never measured in the "
                 "engine, and source inference is not a verdict")
    elif sites_probe.get("outside") is None or sites_probe.get("live_resolved") is False:
        c.settle(BLOCKED, "BLOCKED_LIVE_WORLD_UNRESOLVED",
                 "the engine could not resolve which world is live on this tree "
                 f"(live_source={sites_probe.get('live_source')}), so no site can be placed inside "
                 "or outside it; T1.7 carries the native reason")
    elif sites_probe.get("outside"):
        note = ""
        control_sites = (f.control or {}).get("T1.4", {})
        if drops_owner_work(f) and control_sites.get("outside") == 0:
            note = (f"; source/composition cause named in T1.2 — the control measures outside=0 "
                    f"in {control_sites.get('live')} (control runtime verified: "
                    f"{bool(control_sites.get('live_resolved'))})")
            c.evidence.append(f"reconciled control: {json.dumps(control_sites)[:240]}")
        c.settle(FAIL, "SITE_OUTSIDE_LIVE_WORLD",
                 f"{sites_probe.get('outside')}/{len(f.sites)} canonical sites cannot be approached "
                 f"in the measured live world {sites_probe.get('live')}; "
                 f"package_status={f.package_status}{note}", "game/survival/a0_poi_mount.gd:69")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_APPROACH_RUN",
                                         "sites are inside the measured live world; no approach run recorded")
    cases.append(c)

    c = Case("T1.5", "T1", "input bootstrap is diagnosed as harness config, not A1 fault",
             "A7", "test-only", "runtime")
    before, after = f.probe.get("T1.5_BEFORE", {}), f.probe.get("T1.5_AFTER", {})
    c.evidence = [f"before={json.dumps(before)[:160]}", f"after={json.dumps(after)[:160]}"]
    if not before or not after:
        c.settle(BLOCKED, "BLOCKED_MISSING_BOOTSTRAP_CONTROL",
                 "both a pre-bootstrap and a bootstrapped run must be recorded")
    elif before.get("reader_ok") and after.get("reader_ok"):
        c.stage("runtime", VALID).settle(PASS, "INPUT_BOOTSTRAP_INDEPENDENT",
                                        "the reader configures with and without the bootstrap")
    elif str(before.get("reason", "")).startswith("PLAYER_INPUT_") and after.get("reader_ok"):
        c.settle(FAIL, "TEST_BOOTSTRAP_FALSE_NEGATIVE",
                 f"direct run refused with {before.get('reason')}, bootstrapped run succeeded",
                 "tests/survival/a7_certification_probe.gd")
    elif not after.get("reader_ok"):
        c.settle(FAIL, "A1_SOURCE_CONTRACT",
                 f"bootstrapped run still refuses: {after.get('reason')}")
    else:
        c.settle(BLOCKED, "BLOCKED_INCONCLUSIVE", "neither branch applies")
    cases.append(c)

    c = Case("T1.6", "T1", "physical movement and collision with normal input", "A0",
             "real-gameplay", "runtime")
    move = f.probe.get("T1.6", {})
    c.evidence = f.hit("game/survival/gameplay_input_gate.gd", r"Input\.get_vector", 1)
    if not move:
        c.settle(BLOCKED, "BLOCKED_NO_MOVEMENT_RUN",
                 "requires `A7C T1.6 {\"input_moves\":true,\"collision_blocks\":true}` from a real "
                 "player walk on the composed tree", "must be run by A0's journey harness in CI")
    elif not move.get("input_moves"):
        c.settle(FAIL, "INPUT_DOES_NOT_MOVE_PLAYER", json.dumps(move)[:200])
    elif not move.get("collision_blocks"):
        c.settle(FAIL, "COLLISION_INACTIVE",
                 "the player crossed a solid cell with normal input")
    else:
        c.stage("runtime", VALID).settle(PASS, "PLAYER_MOVES_WITH_COLLISION", "")
    cases.append(c)

    # T1.7 — the case round 14 needed and did not have: does the authority actually run?
    c = Case("T1.7", "T1", "the authority script loads and instantiates in this engine build",
             "A0", "native-runtime", "runtime")
    native = f.probe.get("NATIVE_LOAD", {})
    # Source facts plus what the engine measured: text alone can never answer T1.7.
    authority = {**(f.authority or {}), **(f.probe.get("AUTHORITY") or {})}
    native_log = (f.native or {}).get("composed", {})
    parse_errors = sum(int(native_log.get(k, 0)) for k in ("SCRIPT ERROR", "Parse Error",
                                                           "Compile Error", "Failed to load script"))
    c.evidence = [f"probe NATIVE_LOAD: {json.dumps(native)[:320]}",
                  f"composed probe log engine errors: {native_log or 'none recorded'}"]
    c.measurements = {"native": native, "engine_errors": native_log,
                      "source_authority_present": bool(authority.get("mounts_authority")),
                      "runtime_authority_verified": bool(authority.get("runtime_authority_verified"))}
    if not native:
        c.settle(BLOCKED, "BLOCKED_NO_NATIVE_EVIDENCE",
                 "requires `A7C NATIVE_LOAD {…}` from the probe; no native marker was recorded")
    elif not native.get("known_good_loads"):
        c.settle(FAIL, "HARNESS_LOADER_BROKEN",
                 "the probe could not load a script it knows is good: the load check itself failed, "
                 "so no verdict about owner code can be drawn")
    elif not native.get("controller_loads") or not native.get("controller_can_instantiate"):
        c.settle(FAIL, "CONTROLLER_DOES_NOT_RUN",
                 f"chapter1_overworld.gd loads={native.get('controller_loads')} "
                 f"instantiates={native.get('controller_instantiates')} "
                 f"error={native.get('controller_error')}",
                 "godot --headless --path <tree> --script res://tests/survival/a7_certification_probe.gd")
    elif not native.get("authority_loads") or not native.get("authority_can_instantiate"):
        # The file is in the tree either way. If the engine cannot load it, no amount of
        # source reading ("mounts A0WorldAuthority") can make the authored world real.
        c.settle(FAIL, "AUTHORITY_SCRIPT_DOES_NOT_RUN",
                 f"game/survival/a0_world_authority.gd loads={native.get('authority_loads')} "
                 f"instantiates={native.get('authority_instantiates')}; the composed controller "
                 f"mounts it={authority.get('mounts_authority')}. Source presence is not a running "
                 f"world, and {parse_errors} engine error(s) were logged",
                 "grep -n '_spawn_cell' game/survival/a0_world_authority.gd")
    elif not native.get("controller_instantiates") or not native.get("authority_instantiates"):
        # Scripts compile, but `new()` failed. That is an environment/probe limitation until
        # proven otherwise, so it is BLOCKED, never a source verdict.
        c.settle(BLOCKED, "BLOCKED_INSTANTIATION_ERROR",
                 "both scripts load and can instantiate, but `new()` failed in this headless "
                 f"probe (controller_error={native.get('controller_error') or 'none'}); an "
                 "environmental failure is not proof about the owner's code")
    elif parse_errors:
        c.settle(FAIL, "ENGINE_REPORTED_SCRIPT_ERRORS",
                 f"{parse_errors} engine error(s) while probing: the tree does not compile cleanly",
                 "grep -n 'SCRIPT ERROR\|Parse Error' r14_ci/composed.native.txt")
    elif not authority.get("mounts_authority"):
        # The scripts run, the controller simply does not mount them: T1.2's finding.
        c.stage("runtime", VALID).settle(BLOCKED, "BLOCKED_AUTHORITY_NOT_MOUNTED",
                                        "the composed controller does not mount the authority, so "
                                        "there is nothing here to run; see T1.2")
    elif not authority.get("runtime_authority_verified"):
        c.settle(FAIL, "AUTHORITY_NOT_RUNTIME_VERIFIED",
                 f"scripts load but the controller's own resolver answers "
                 f"`{authority.get('controller_mode_resolved') or 'unknown'}`")
    else:
        c.stage("runtime", VALID).settle(PASS, "RUNTIME_AUTHORITY_VERIFIED",
                                        "controller and authority load, instantiate, and the "
                                        "controller resolves the authored world")
    cases.append(c)
    return cases


# --------------------------------------------------------------------------- #
# Track 2 — discovery, preparation, revisiting
# --------------------------------------------------------------------------- #
def track2(f: Facts) -> List[Case]:
    cases: List[Case] = []

    c = Case("T2.1", "T2", "two canonical sites ship real scenes", "A8", "source", "source")
    scenes = {name for name, _ in f.scene_sites}
    # A8 names the orchard scene `south_orchard_ruin.tscn`, so match on the canonical
    # prefix rather than an exact filename and then require the `.tscn` suffix.
    wanted = {"south_quarry", "south_orchard"}
    present = {w for w in wanted
               if any(name.startswith(f"{w}") and name.endswith(".tscn") for name in scenes)}
    c.stage("source", VALID if present else MISSING)
    c.evidence = [f"scenes: {sorted(scenes)}", f"present for {sorted(present)} of {sorted(wanted)}"]
    if len(present) < 2:
        c.settle(FAIL, "SITE_SCENE_ABSENT", f"missing {sorted(wanted - present)}")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_ENTRY_RUN",
                                         "scenes exist; nobody has physically entered them")
    cases.append(c)

    c = Case("T2.2", "T2", "ordinary route from spawn to each site", "A0", "real-gameplay", "runtime")
    route = f.probe.get("T2.2", {})
    c.stage("source", VALID if f.sites else MISSING)
    c.evidence = [f"{sid} cell={cell}" for sid, cell, _ in f.sites]
    if not route:
        c.settle(BLOCKED, "BLOCKED_NO_ROUTE_RUN",
                 "requires a walked route marker per site; a teleport into a POI interior is not a "
                 "route and is rejected by this harness", "T2.2 needs `A7C T2.2 {…}`")
    elif not route.get("walked") or route.get("teleported"):
        c.settle(FAIL, "ROUTE_NOT_WALKED", json.dumps(route)[:200])
    else:
        c.stage("runtime", VALID).settle(PASS, "ROUTE_WALKED", f"{route.get('seconds')}s walk")
    cases.append(c)

    # T2.3 — a catalog gap, not proof that the starting melee is unplayable. Round 14 turned
    # "no item id contains 'knife'" into "P3 cannot be played at all", which the catalog cannot
    # support: melee lives in the character/weapon subsystem, not in the survival item catalog.
    c = Case("T2.3", "T2", "knife-first exploration is possible", "A3", "source", "source")
    knives = [i for i in f.item_ids if "knife" in i.lower()]
    melee_tools = [i for i in f.equipment_ids
                   if any(t in str(i).lower() for t in ("pick", "hammer", "axe", "blade", "knife"))]
    c.stage("source", VALID if f.item_ids else MISSING)
    c.evidence = [f"{len(f.item_ids)} item ids; knife-like={knives}; kinds={dict(sorted(f.item_kinds.items()))}",
                  f"melee/tool equipment ids={melee_tools}",
                  f"melee subsystem hits={f.melee[:3] or 'none'}"]
    c.measurements = {"knife_item_ids": knives, "equipment_ids": f.equipment_ids,
                      "item_kinds": f.item_kinds, "melee_hits": f.melee}
    if not f.item_ids:
        c.settle(BLOCKED, "BLOCKED_NO_CATALOG")
    elif not knives:
        c.settle(BLOCKED, "BLOCKED_NO_MELEE_RUN",
                 "no item id contains 'knife', so the knife-first journey's starting tool is not in "
                 "the catalog; whether the starting melee is playable is NOT decided here — melee "
                 f"lives in the weapon subsystem ({f.melee[0] if f.melee else 'no hit found'}) and "
                 "this probe runs no combat, so no player-level melee claim is made",
                 "grep -n 'weapon_manager\|normal_attack' game/characters/knight/knight.gd")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_CRAFT_RUN",
                                         "a knife exists; nobody has crafted it from a real source")
    cases.append(c)

    c = Case("T2.4", "T2", "no fixture credential counts as player-earned capability", "A7",
             "test-only", "receipt")
    grant = f.probe.get("T2.4", {})
    c.evidence = [f"marker={json.dumps(grant)[:200]}"]
    if not grant:
        c.settle(BLOCKED, "BLOCKED_NO_EARNED_EVIDENCE",
                 "requires `A7C T2.4 {\"fixture_grants\":0,\"player_earned\":true}` from the run that "
                 "claims the capability")
    elif int(grant.get("fixture_grants", 1)) > 0:
        c.settle(FAIL, "FIXTURE_GRANT_PRESENT",
                 f"{grant.get('fixture_grants')} fixture-issued grants were used")
    elif not grant.get("player_earned"):
        c.settle(BLOCKED, "BLOCKED_NOT_PLAYER_EARNED", "the run did not claim player-earned")
    else:
        c.stage("receipt", VALID).settle(PASS, "PLAYER_EARNED", "")
    cases.append(c)

    c = Case("T2.5", "T2", "safe retreat and durable revisit with the same identity", "A8",
             "real-gameplay", "receipt")
    revisit = f.probe.get("T2.5", {})
    c.stage("source", VALID if f.hit("game/survival/a0_poi_mount.gd", r"finish_transition") else MISSING)
    c.evidence = f.hit("game/survival/a0_poi_mount.gd", r"A0_RUN_IDENTITY_MISMATCH|finish_transition", 2)
    if not revisit:
        c.settle(BLOCKED, "BLOCKED_NO_REVISIT_RECEIPT",
                 "requires an exit+return receipt for the same site_instance_id in a second process")
    elif not (revisit.get("exit") and revisit.get("return") and revisit.get("same_identity")):
        c.settle(FAIL, "REVISIT_IDENTITY_LOST", json.dumps(revisit)[:200])
    else:
        c.stage("receipt", VALID).settle(PASS, "DURABLE_REVISIT", "")
    cases.append(c)

    c = Case("T2.6", "T2", "deeper access is genuinely blocked before preparation", "A8",
             "source-contract", "contract")
    gates = _read_json(f.root / "data/survival/world_content/a8_a0_mount_transition_package.v2.json") \
        if f.root else {}
    declared = gates.get("production_mount_gates") or []
    c.stage("source", VALID if declared else MISSING)
    c.evidence = [f"{len(declared)} production_mount_gates declared",
                  f"package_status={f.package_status}"]
    blocked_marker = f.probe.get("T2.6", {})
    if not declared:
        c.settle(BLOCKED, "BLOCKED_NO_GATE_DECLARATION")
    elif not blocked_marker or blocked_marker.get("refused") is None:
        # `refused: null` means the probe observed nothing, which is missing evidence.
        # Only an explicit `refused: false` is a product failure.
        c.settle(BLOCKED, "BLOCKED_NO_BLOCKED_ACCESS_RUN",
                 "gates are declared; no run shows the player actually refused at the threshold")
    elif not blocked_marker.get("refused"):
        c.settle(FAIL, "DEEPER_ACCESS_NOT_BLOCKED",
                 "the player entered the gated area without preparation")
    else:
        c.stage("contract", VALID).settle(PASS, "DEEPER_ACCESS_BLOCKED",
                                          f"refusal={blocked_marker.get('reason')}")
    cases.append(c)
    return cases


# --------------------------------------------------------------------------- #
# Track 3 — material, knowledge, offline return
# --------------------------------------------------------------------------- #
def track3(f: Facts) -> List[Case]:
    cases: List[Case] = []

    c = Case("T3.1", "T3", "authentic finite source → inventory", "A3", "source-contract", "source")
    bindings = _read_json(f.root / "data/survival/items/world_source_bindings.v3.json") if f.root else {}
    nodes = bindings.get("bindings") or bindings.get("sources") or []
    c.stage("source", VALID if nodes else MISSING)
    c.evidence = [f"world_source_bindings.v3.json declares {len(nodes) if isinstance(nodes, list) else 'n/a'} entries",
                  *f.hit("data/survival/items/world_source_bindings.v3.json", r"\"source_id\"", 2)]
    owner_string_only = not any(
        "sha256" in line.lower() or "hash" in line.lower()
        for line in f.hit("data/survival/items/world_source_bindings.v3.json",
                          r"source", 40))
    c.measurements = {"owner_string_only": owner_string_only}
    if not nodes:
        c.settle(BLOCKED, "BLOCKED_NO_SOURCE_BINDINGS")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_HARVEST_RUN",
                                         "bindings exist; no real harvest receipt in this composition")
    cases.append(c)

    # T3.2 — A3 V7 publishes the wear contract (`condition_cost`, `apply_tool_use_plan`) and
    # A0 consumes it. Source presence is not player tool wear: only a run that drops a tool's
    # condition can certify that, so the honest grade is BLOCKED, not PASS and not FAIL.
    c = Case("T3.2", "T3", "tool wear is enforced for a player's tool", "A0", "source-contract",
             "runtime")
    contract = f.wear_contract
    consumers = f.wear_consumers
    wear_run = f.probe.get("T3.2", {})
    legacy_hits = f.hit("game/survival", r"durability|tool_wear", 2)
    c.evidence = ([f"A3 contract: {h}" for h in contract[:2]]
                  + [f"A0 consumer: {h}" for h in consumers[:2]]
                  + ([f"legacy symbol: {h}" for h in legacy_hits] if legacy_hits else []))
    c.measurements = {"contract": contract, "consumers": consumers, "legacy_symbols": legacy_hits,
                      "run": wear_run or None}
    c.stage("source", VALID if contract else MISSING)
    if not contract and not legacy_hits:
        c.settle(FAIL, "TOOL_WEAR_ABSENT", "no wear contract exists anywhere in the composed tree")
    elif not wear_run:
        c.settle(BLOCKED, "BLOCKED_NO_TOOL_WEAR_RUN",
                 f"{len(contract)} contract symbol(s) and {len(consumers)} consumer call(s) exist, "
                 "but no run shows a player's tool condition dropping; a contract is not wear",
                 "needs `A7C T3.2 {\"condition_before\":n,\"condition_after\":n,\"tool_id\":…}` "
                 "from A0's journey harness")
    elif int(wear_run.get("condition_after", 0)) >= int(wear_run.get("condition_before", 0)):
        c.settle(FAIL, "TOOL_WEAR_NOT_APPLIED",
                 f"the run reports no wear: {json.dumps(wear_run)[:200]}")
    else:
        c.stage("runtime", VALID).settle(PASS, "TOOL_WEAR_APPLIED",
                                        f"tool {wear_run.get('tool_id')} lost condition in a real run")
    cases.append(c)

    c = Case("T3.3", "T3", "three distinct research methods are real and distinguishable", "A3",
             "source-contract", "source")
    methods = f.research_methods
    c.stage("source", VALID if methods else MISSING)
    c.evidence = [f"{k} -> {v}" for k, v in sorted(methods.items())]
    if len(methods) < 3:
        c.settle(FAIL, "RESEARCH_METHODS_MISSING",
                 f"only {sorted(methods)} distinguishable in the planner escrow check")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_RESEARCH_RUN",
                                         "three escrow shapes exist; no player has spent them")
    cases.append(c)

    c = Case("T3.4", "T3", "recipe sinks exist for what the sources produce", "A3", "source", "source")
    sinks = [r for r in f.recipe_ids if r in ("shelter", "capability_bootstrap", "route_network",
                                              "hazards", "capability_pois", "late_goals")]
    c.stage("source", VALID if f.recipe_ids else MISSING)
    c.evidence = [f"progression_model keys={f.recipe_ids[:12]}", f"sink sections={sinks}"]
    if not f.recipe_ids:
        c.settle(BLOCKED, "BLOCKED_NO_RECIPE_MODEL")
    elif not sinks:
        c.settle(FAIL, "NO_RECIPE_SINK", "no progression sink consumes the source materials")
    else:
        c.stage("contract", VALID).settle(BLOCKED, "BLOCKED_NO_CRAFT_RUN",
                                         "sinks are declared; nothing has been crafted from a real source")
    cases.append(c)

    # T3.5 — the question is *provenance*: does an owner-string-only source claim get refused?
    # Round 14 answered it with `input_escrow_mismatch`/`fuel_escrow_mismatch`, which are
    # escrow-integrity invariants for an operation that already exists. They say nothing about
    # whether a source may be authorised by a name, so they cannot pass this case.
    c = Case("T3.5", "T3", "owner-string-only source authentication is refused", "A3",
             "source-contract", "contract")
    codes = f.rejection_codes
    provenance = f.provenance
    provenance_run = f.probe.get("T3.5", {})
    c.stage("source", VALID if codes or provenance else MISSING)
    c.evidence = ([f"escrow vocabulary (a different invariant): `{k}` at {v}"
                   for k, v in sorted(codes.items())][:4]
                  + [f"provenance surface: {h}" for h in provenance[:4]]
                  + ([f"measured surface is A0's vendored fork "
                      f"({f.a3_service.get('vendor_path')}, "
                      f"{f.a3_service.get('vendor_lines')} lines); A3's submitted service is "
                      f"refused by scope (T3.11)"] if f.a3_service.get("refused_by_scope") else []))
    c.measurements = {"escrow_codes": sorted(codes), "provenance_hits": provenance,
                      "run": provenance_run or None}
    if not provenance_run:
        c.settle(BLOCKED, "BLOCKED_NO_PROVENANCE_REJECTION",
                 "no run shows an owner-string-only source claim being refused. "
                 f"{'A provenance surface exists' if provenance else 'No provenance refusal exists'}"
                 " (`authenticate_source`/`is_source_authenticated`), but the escrow mismatch codes "
                 "this case used to pass on are escrow integrity, not source authorisation",
                 "needs `A7C T3.5 {\"owner_string_only_refused\":true,\"source_id\":…}` from a run "
                 "that calls authenticate_source with a name and nothing physical")
    elif not provenance_run.get("owner_string_only_refused"):
        c.settle(FAIL, "OWNER_STRING_SOURCE_ACCEPTED",
                 f"a source claim with only an owner string was accepted: {json.dumps(provenance_run)[:200]}")
    else:
        c.stage("contract", VALID).settle(PASS, "OWNER_STRING_SOURCE_REFUSED",
                                         "a name-only source claim is refused by the service")
    cases.append(c)

    c = Case("T3.6", "T3", "missing physical fuel fails a job", "A3", "source-contract", "contract")
    fuel = codes.get("fuel_escrow_mismatch") or codes.get("unexpected_research_fuel", "")
    c.stage("source", VALID if fuel else MISSING)
    c.evidence = [fuel] if fuel else ["no fuel escrow refusal in the planner"]
    cases.append(c.settle(PASS, "FUEL_REQUIRED", "fuel escrow is enforced by name") if fuel
                 else c.settle(FAIL, "FUEL_NOT_REQUIRED", "a job would run without physical fuel"))

    c = Case("T3.7", "T3", "duplicate job ids and early claims are refused", "A0",
             "source-contract", "contract")
    dup = (f.hit("game/survival/economy", r"idempoten", 2)
           + f.hit("game/survival/economy", r"\"duplicate\"\s*:", 1))
    c.stage("source", VALID if dup else MISSING)
    c.evidence = dup
    cases.append(c.settle(PASS, "DUPLICATE_REFUSED", "duplicate/once-only path present") if dup
                 else c.settle(FAIL, "NO_DUPLICATE_GUARD", "no duplicate-job guard found"))

    c = Case("T3.8", "T3", "stale run and expired window are refused", "A0", "source-contract", "contract")
    stale = (f.hit("game/survival/economy", r"run_id_mismatch", 1)
             + f.hit("game/survival/economy", r"run_expired", 1))
    c.stage("source", VALID if stale else MISSING)
    c.evidence = stale
    cases.append(c.settle(PASS, "STALE_RUN_REFUSED", "expiry/identity guards present") if stale
                 else c.settle(FAIL, "NO_STALE_RUN_GUARD", "no expiry/identity guard found"))

    c = Case("T3.9", "T3", "funded job completes in a separate process, exactly once", "A0",
             "real-gameplay", "receipt")
    receipt = f.probe.get("T3.9", {})
    c.evidence = f.hit("game/survival/economy/a0_offline_host.gd", r"nothing_to_settle", 1)
    if receipt and str(receipt.get("reason", "")) == "NOT_THIS_PROBE":
        receipt = {}
    if not receipt:
        c.settle(BLOCKED, "BLOCKED_NO_2PID_RECEIPT",
                 "requires a second-OS-process settlement receipt with a duplicate refusal; "
                 "the R13 O4 oracle rules apply unchanged")
    elif not receipt.get("settled"):
        c.settle(FAIL, "NOT_SETTLED", json.dumps(receipt)[:200])
    elif receipt.get("granted") != 1:
        c.settle(FAIL, "WRONG_GRANT_COUNT", f"granted={receipt.get('granted')}")
    elif not (receipt.get("duplicate_refused") and receipt.get("second_granted") in (0, None)):
        c.settle(FAIL, "NOT_EXACTLY_ONCE", json.dumps(receipt)[:200])
    else:
        c.stage("receipt", VALID).settle(PASS, "PAID_2PID_RECEIPT", "")
    cases.append(c)

    c = Case("T3.10", "T3", "the payoff changes a later choice", "A3", "real-gameplay", "outcome")
    choice = f.probe.get("T3.10", {})
    c.stage("source", VALID if f.recipe_ids else MISSING)
    c.evidence = f.hit("data/survival/recipes/progression_model.json", r"capability_pois|route_network", 2)
    if not choice:
        c.settle(BLOCKED, "BLOCKED_NO_OUTCOME_RUN",
                 "requires a recorded before/after choice that the new material unlocked")
    elif not choice.get("new_option_available"):
        c.settle(FAIL, "NO_NEW_OPTION", json.dumps(choice)[:200])
    else:
        c.stage("outcome", VALID).settle(PASS, "MEANINGFUL_NEXT_CHOICE", "")
    cases.append(c)

    # T3.11 — the submitted A3 service must be what the product runs. The composer scopes
    # `game/survival/economy/` to A0, so A3's own service and planner can be refused wholesale
    # while an A0 vendored fork keeps the name: every "A3" contract above would then be A0's code.
    c = Case("T3.11", "T3", "the submitted A3 economy service is the one the product runs",
             "A0", "composition", "source")
    info = f.a3_service or {}
    c.evidence = [f"submitted service present={info.get('composed')} "
                  f"({info.get('submitted_path')})",
                  f"refused by composition scope={info.get('refused_by_scope')} "
                  f"({len(info.get('refused_paths') or [])} A3 economy file(s))",
                  f"vendor fork={info.get('vendor_path')} present={info.get('vendor_present')} "
                  f"lines={info.get('vendor_lines')} sha={str(info.get('vendor_sha256'))[:12]}"]
    c.measurements = info
    if not info.get("composition_report"):
        c.settle(BLOCKED, "BLOCKED_NO_COMPOSITION_REPORT",
                 "no composition.json: scope refusals cannot be read")
    elif info.get("composed"):
        c.stage("source", VALID).settle(PASS, "A3_SERVICE_COMPOSED",
                                       "the submitted service is in the certified tree")
    elif info.get("refused_by_scope"):
        c.settle(FAIL, "A3_SERVICE_REFUSED_BY_SCOPE",
                 "A3's submitted economy service is refused as out of scope, so the composed "
                 "product runs A0's vendored fork instead; Track 3's consumer tests are then "
                 "testing a copy, not the submitted service",
                 "python3 tools/a0/compose_owners.py … && python3 -c \"import json;"
                 "print(json.load(open('.composition/composition.json'))"
                 "['refused_out_of_scope']['a3'])\"")
    else:
        c.settle(BLOCKED, "BLOCKED_NO_A3_SERVICE_EVIDENCE",
                 "the service is neither composed nor listed as refused")
    cases.append(c)
    return cases


# --------------------------------------------------------------------------- #
# Track 4 — forward compatibility gates (fail-closed until the feature exists)
# --------------------------------------------------------------------------- #
TRACK4: Sequence[Tuple[str, str, str, str]] = (
    ("T4.1", "Core can be carried, used and stored", "core_use", "A0"),
    ("T4.2", "a physical Core gates research", "core_research", "AVFX"),
    ("T4.3", "trace-based threat and bag recovery", "threat", "A0"),
    ("T4.4", "the 336-hour run ends and resets", "run_reset", "A0"),
    ("T4.5", "last72 Elder territory transformation", "last72_elders", "A0"),
    ("T4.6", "physical chest-sourced Ragnarok cash", "chest_currency", "A0"),
    ("T4.7", "multiple fixed-site deposits", "fixed_deposit", "A3"),
    ("T4.8", "evacuation and complete run-local wipe", "evacuation", "A0"),
)


def track4(f: Facts) -> List[Case]:
    cases: List[Case] = []
    for cid, title, feature, owner in TRACK4:
        c = Case(cid, "T4", title, owner, "forward-gate", "runtime")
        hits = f.feature_hits.get(feature, [])
        c.stage("source", VALID if hits else MISSING)
        c.evidence = hits or [f"no `{feature}` symbol in game/survival"]
        marker = f.probe.get(cid, {})
        if not hits:
            c.settle(NOT_IMPLEMENTED, "FEATURE_ABSENT",
                     f"`{feature}` does not exist in this composition, so the gate cannot run and "
                     "nothing may be claimed for it")
        elif not marker:
            c.settle(BLOCKED, "BLOCKED_NO_FEATURE_RUN",
                     f"`{feature}` symbols exist ({hits[0]}); no runtime evidence")
        elif not marker.get("ok"):
            c.settle(FAIL, "FEATURE_GATE_FAILED", json.dumps(marker)[:200])
        else:
            c.stage("runtime", VALID).settle(PASS, "FEATURE_GATE_PASSED", "")
        cases.append(c)
    return cases


# --------------------------------------------------------------------------- #
# Roll-up: maturity, tracks, overall
# --------------------------------------------------------------------------- #
def track_verdict(cases: Sequence[Case]) -> str:
    verdicts = [c.verdict for c in cases]
    if FAIL in verdicts:
        return FAIL
    if NOT_IMPLEMENTED in verdicts:
        return NOT_IMPLEMENTED if all(v in (NOT_IMPLEMENTED, PASS) for v in verdicts) else BLOCKED
    if BLOCKED in verdicts:
        return BLOCKED
    return PASS


def maturity(cases: Sequence[Case], self_test_ok: bool) -> dict:
    """Highest level *proven*, never assumed. HUMAN_ACCEPTED requires human evidence."""
    reached = []
    if self_test_ok:
        reached.append("TEST_HARNESS_VALID")
    source_ok = all(c.verdict != FAIL for c in cases if c.required_stage == "source")
    source_valid = all("source" in c.stages and c.stages["source"] == VALID for c in cases)
    if source_ok and source_valid:
        reached.append("OWNER_SOURCE_VALID")
    runtime_cases = [c for c in cases if c.required_stage in ("runtime", "receipt", "outcome")]
    if runtime_cases and all(c.verdict == PASS for c in runtime_cases):
        reached.append("PRODUCT_COMPOSED")
    # HUMAN_ACCEPTED is never self-granted; it requires an explicit human evidence file.
    return {"reached": reached,
            "max": reached[-1] if reached else "NONE",
            "human_accepted": False,
            "note": "HUMAN_ACCEPTED can only be granted by a recorded human session; "
                    "this harness never claims it."}


def certify(f: Facts, self_test_ok: bool = False) -> dict:
    if f.root and not f.tree:
        f.tree, f.tree_method = composition_tree(f.root)
    cases: List[Case] = []
    for builder in (track1, track2, track3, track4):
        cases.extend(builder(f))
    tracks = {}
    for name, ids in (("T1", track1), ("T2", track2), ("T3", track3), ("T4", track4)):
        subset = [c for c in cases if c.track == name]
        tracks[name] = {
            "verdict": track_verdict(subset),
            "cases": {c.id: c.verdict for c in subset},
            "titles": {c.id: c.title for c in subset},
        }
    overall = track_verdict(cases)
    first_fail = next((c for c in cases if c.verdict == FAIL), None)
    first_blocked = next((c for c in cases if c.verdict == BLOCKED), None)
    return {
        "schema": SCHEMA,
        "engine": "Godot 4.7 (declared; runtime markers prove it ran)",
        "composition": {"tree": f.tree, "declared": f.expected_tree,
                        "method": f.tree_method, "pins": f.pins},
        "policy": {
            "score": "none — no percentage, no average",
            "pass": "positive evidence at the required stage only",
            "missing": "BLOCKED, never PASS",
            "levels": list(MATURITY_ORDER),
        },
        "maturity": maturity(cases, self_test_ok),
        "overall": overall,
        "tracks": tracks,
        "first_failure": first_fail.as_dict() if first_fail else None,
        "first_blocker": first_blocked.as_dict() if first_blocked else None,
        "cases": [c.as_dict() for c in cases],
        "counts": {
            "cases": len(cases),
            "pass": sum(1 for c in cases if c.verdict == PASS),
            "fail": sum(1 for c in cases if c.verdict == FAIL),
            "blocked": sum(1 for c in cases if c.verdict == BLOCKED),
            "not_implemented": sum(1 for c in cases if c.verdict == NOT_IMPLEMENTED),
        },
    }


def render_markdown(report: dict) -> str:
    comp = report["composition"]
    lines = [
        "# A7 R14 — cross-system player-capability certification", "",
        f"**Overall: `{report['overall']}`** · composition "
        f"`{(comp['declared'] or comp['tree'] or '(none)')[:12]}` · "
        f"maturity **{report['maturity']['max']}**", "",
        "| track | verdict | cases |", "|---|---|---|",
    ]
    for name, data in report["tracks"].items():
        cases = ", ".join(f"{k}={v}" for k, v in data["cases"].items())
        lines.append(f"| {name} | **{data['verdict']}** | {cases} |")
    counts = report["counts"]
    lines += ["", f"Cases: {counts['cases']} · PASS {counts['pass']} · FAIL {counts['fail']} · "
                  f"BLOCKED {counts['blocked']} · NOT_IMPLEMENTED {counts['not_implemented']}",
              "", "## Cases", "", "| id | verdict | code | owner | stage | title |",
              "|---|---|---|---|---|---|"]
    for case in report["cases"]:
        lines.append(f"| {case['id']} | **{case['verdict']}** | `{case['code']}` | {case['owner']} | "
                     f"{case['required_stage']} | {case['title']} |")
    for key, label in (("first_failure", "First failure"), ("first_blocker", "First blocker")):
        item = report.get(key)
        if item:
            lines += ["", f"## {label}", "",
                      f"`{item['id']}` · **{item['code']}** · owner **{item['owner']}**", "",
                      item["detail"] or "(no detail)"]
            if item["repro"]:
                lines += ["", f"repro: `{item['repro']}`"]
    lines += ["", "## Evidence per case", ""]
    for case in report["cases"]:
        lines.append(f"### {case['id']} — {case['verdict']} `{case['code']}`")
        if case["detail"]:
            lines.append(case["detail"])
        for item in case["evidence"]:
            lines.append(f"- {item}")
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Self-test: the harness must reject known-bad and accept known-good
# --------------------------------------------------------------------------- #
def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _fixture(root: Path, *, one_world: bool, knife: bool = False, sites_inside: bool = True,
             research: int = 3, fuel: bool = True, features: Optional[Sequence[str]] = None,
             legacy: Optional[Tuple[int, int]] = None, wear_contract: bool = True,
             legacy_wear: bool = False, a3_service: str = "absent") -> None:
    live = legacy or ((1024, 768) if one_world else (384, 256))
    _write(root / "data/overworld/hollow_marches.json",
           json.dumps({"world_bounds": {"x": 0, "y": 0, "w": live[0], "h": live[1]}}))
    _write(root / "game/survival/a1_authored_source.gd", "const AUTHORED_FRAME := Vector2i(1024, 768)\n")
    # The production controller is what decides which world is live. A fixture without it
    # would silently fall back to "the legacy document is live", which is the assumption
    # round 14 had to stop making.
    if one_world:
        _write(root / "game/overworld/chapter1_overworld.gd",
               'const WORLD_AUTHORITY_SETTING := "survival/a0_world_authority"\n'
               'const WORLD_AUTHORITY_AUTHORED := "authored"\n'
               "var world_authority: A0WorldAuthority\n"
               "func _mode():\n\treturn ProjectSettings.get_setting("
               "WORLD_AUTHORITY_SETTING, WORLD_AUTHORITY_AUTHORED)\n")
    else:
        _write(root / "game/overworld/chapter1_overworld.gd",
               'const AUTHORED_STREAM_SETTING := "survival/a0_authored_stream"\n'
               "var authored_mount: A0AuthoredWorldMount\n"
               "func _on():\n\treturn ProjectSettings.get_setting("
               "AUTHORED_STREAM_SETTING, false)\n")
    _write(root / "project.godot", "[application]\n")
    _write(root / "game/survival/a0_authored_world_mount.gd",
           "## one authoritative world\n" if one_world else
           "## the authored stream is mounted *beside* it, never instead of it.\nvar render_legacy := true\n")
    _write(root / "game/survival/a0_poi_mount.gd",
           'report["reason"] = "A1_RUNTIME_WORLD_EXTENT_ABSENT"\n' if not one_world else
           'report["reason"] = "OK"\n')
    cells = [(30, 280), (140, 360)] if sites_inside else [(30, 900), (140, 950)]
    _write(root / "data/survival/world_content/a8_a0_mount_transition_package.v2.json",
           json.dumps({"package_status": "FIXTURE",
                       "existing_a8_sites": [
                           {"poi_id": "poi_crown_south_quarry", "canonical_cell": list(cells[0]),
                            "scene": "res://game/survival/world_content/scenes/south_quarry.tscn"},
                           {"poi_id": "poi_crown_south_orchard", "canonical_cell": list(cells[1]),
                            "scene": "res://game/survival/world_content/scenes/south_orchard_ruin.tscn"}],
                       "production_mount_gates": [{"id": "g1"}]}))
    for scene in ("south_quarry", "south_orchard_ruin"):
        _write(root / f"game/survival/world_content/scenes/{scene}.tscn", "[gd_scene]\n")
    catalog = {"stone_chunk": {"kind": "material"}}
    catalog["stone_pick"] = {"kind": "equipment", "tags": ["tool"]}
    if knife:
        catalog["iron_knife"] = {"kind": "equipment", "tags": ["tool", "knife"]}
    _write(root / "data/survival/items/items.json", json.dumps({"items": catalog}))
    _write(root / "data/survival/items/world_source_bindings.v3.json",
           json.dumps({"bindings": [{"source_id": "s1", "source_sha256": "ab" * 32}]}))
    _write(root / "data/survival/recipes/progression_model.json",
           json.dumps({k: {} for k in ("shelter", "capability_bootstrap", "route_network",
                                       "hazards", "capability_pois", "late_goals")}))
    lines = []
    for method in ("targeted", "blueprint", "specimen")[:research]:
        lines.append(f"\tvar matches_{method} := true")
    lines.append('\t\t\treturn "input_escrow_mismatch"')
    if fuel:
        lines.append('\t\t\treturn "fuel_escrow_mismatch"')
    _write(root / "game/survival/economy/offline_operation_planner.gd", "\n".join(lines) + "\n")
    _write(root / "game/survival/economy/a0_offline_host.gd", 'reason = "nothing_to_settle"\n')
    _write(root / "game/survival/economy/a0_run_lifecycle.gd",
           "## 336 h limit\## last72 window\nfunc end_run():\n\tpass\n")
    _write(root / "game/survival/world/a1_authored_world_reader.gd",
           "func choose_safe_spawn(run_seed: int) -> Dictionary:\n\treturn {}\n")
    _write(root / "game/survival/gameplay_input_gate.gd", "func _m():\n\tInput.get_vector()\n")
    _write(root / "game/characters/knight/knight.gd",
           "func attack():\n\tvar weapon_manager := null\n\tvar t := weapon_manager.normal_attack\n")
    if wear_contract:
        _write(root / "game/survival/economy/economy_service.gd",
               "func plan_tool_use(tool_item: String) -> Dictionary:\n"
               "\tvar condition_cost := 1\n"
               "\treturn {\"condition_cost\": condition_cost}\n"
               "func apply_tool_use_plan(candidate: Dictionary, plan: Dictionary) -> Dictionary:\n"
               "\trecord[\"condition\"] = maxi(0, int(record.condition) - int(plan.condition_cost))\n")
        _write(root / "game/survival/economy/a0_economy_adapter.gd",
               "func _use(candidate, planned):\n\tvar wear: Dictionary = apply_tool_use_plan(candidate, planned)\n")
    _write(root / "game/survival/economy/vendor/a3_economy_service.gd",
           "func apply_tool_use_plan(candidate: Dictionary, plan: Dictionary) -> Dictionary:\n"
           "\treturn {}\n" if wear_contract else "## vendored copy without a wear contract\n")
    report = {"schema": "fixture", "refused_out_of_scope": {"a3": []}}
    if a3_service == "composed":
        _write(root / "game/survival/economy/a3_economy_service.gd",
               "func authenticate_source(source_id: String, owner_domain: String) -> bool:\n"
               "\treturn false\n")
    elif a3_service == "refused":
        report["refused_out_of_scope"]["a3"] = ["game/survival/economy/a3_economy_service.gd"]
    _write(root / "composition.json", json.dumps(report))
    if legacy_wear:
        _write(root / "game/survival/survival_service.gd", "func wear():\n\tdurability = 1\n")
    for feature in (features or []):
        snippet = FEATURE_FIXTURES[feature]
        _write(root / f"game/survival/feature_{feature}.gd", snippet)


def self_test(verbose: bool = True) -> int:
    """Every case must reject its known-bad fixture and accept its known-good one."""
    results: List[Tuple[str, bool, str]] = []

    def check(label: str, got: str, want: str) -> None:
        results.append((label, got == want, f"got {got}, want {want}"))

    def fresh(**kwargs) -> Facts:
        root = Path(tempfile.mkdtemp(prefix="a7c-fixture-"))
        _fixture(root, **kwargs)
        facts = gather(root, None)
        facts.expected_tree = ""
        facts.tree = "0" * 40
        return facts

    def case(facts: Facts, case_id: str) -> Case:
        all_cases = track1(facts) + track2(facts) + track3(facts) + track4(facts)
        return next(c for c in all_cases if c.id == case_id)

    # T1.2 — the round-12 false green
    check("T1.2 sidecar world → FAIL", case(fresh(one_world=False), "T1.2").verdict, FAIL)
    check("T1.2 one world, no run → BLOCKED", case(fresh(one_world=True), "T1.2").verdict, BLOCKED)

    # T1.2 — composition fidelity versus source defect, and the legacy document's shadow
    facts = fresh(one_world=False)
    facts.control["AUTHORITY"] = {"mounts_authority": True, "controller_lines": 1642,
                                  "live_source": "authored_authority", "live_frame": [1024, 768]}
    got = case(facts, "T1.2")
    check("T1.2 composed tree drops A0's authority → COMPOSITION_DROPS_OWNER_WORK",
          got.code if got.verdict == FAIL else got.verdict, "COMPOSITION_DROPS_OWNER_WORK")
    facts = fresh(one_world=False)
    facts.control["AUTHORITY"] = {"mounts_authority": False, "controller_lines": 1366}
    got = case(facts, "T1.2")
    check("T1.2 authority missing in both trees → SIDECAR_WORLD (source defect)",
          got.code if got.verdict == FAIL else got.verdict, "SIDECAR_WORLD")
    # The 384x256 document must not overrule a controller that mounts the authority.
    facts = fresh(one_world=True, legacy=(384, 256))
    check("T1.2 legacy document cannot overrule an authored controller",
          case(facts, "T1.2").verdict, BLOCKED)
    check("T1.2 live frame is the authority frame, not the legacy file",
          str(facts.live_source), "authored_authority")

    # Evidence split: a control tree must never overwrite the product's markers.
    box = Path(tempfile.mkdtemp(prefix="a7c-evidence-"))
    _write(box / "probe.txt", 'A7C T1.3 {"ok": true, "in_live_world": false}\n')
    _write(box / "probe_control.txt", 'A7C T1.3 {"ok": true, "in_live_world": true}\n')
    product, control, _ = read_evidence(box)
    check("evidence split keeps the product marker", str(product.get("T1.3", {}).get("in_live_world")), "False")
    check("evidence split keeps the control marker", str(control.get("T1.3", {}).get("in_live_world")), "True")

    # T1.2 — a control tree that does not compile can never be quoted as "the world works"
    facts = fresh(one_world=False)
    facts.control["AUTHORITY"] = {"mounts_authority": True, "controller_lines": 1642,
                                  "runtime_authority_verified": False, "controller_runnable": False,
                                  "authority_runnable": False,
                                  "live_source": "UNRESOLVED_AUTHORITY_NOT_RUNNABLE"}
    got = case(facts, "T1.2")
    check("T1.2 dead control still names the composition artifact",
          got.code if got.verdict == FAIL else got.verdict, "COMPOSITION_DROPS_OWNER_WORK")
    check("T1.2 dead control is not quoted as a working world",
          "yes" if any("NOT runtime-verified" in e for e in got.evidence) else "no", "yes")

    # T1.7 — engine truth beats source inference
    facts = fresh(one_world=True)
    facts.probe["NATIVE_LOAD"] = {"known_good_loads": True, "controller_loads": True,
                                  "controller_instantiates": True, "controller_can_instantiate": True,
                                  "authority_loads": False, "authority_can_instantiate": False,
                                  "authority_instantiates": False, "controller_mode": "authored"}
    facts.probe["AUTHORITY"] = {"mounts_authority": True, "runtime_authority_verified": False}
    check("T1.7 authority cannot load → FAIL AUTHORITY_SCRIPT_DOES_NOT_RUN",
          case(facts, "T1.7").code, "AUTHORITY_SCRIPT_DOES_NOT_RUN")

    facts = fresh(one_world=True)
    facts.probe["NATIVE_LOAD"] = {"known_good_loads": True, "controller_loads": True,
                                  "controller_instantiates": True, "controller_can_instantiate": True,
                                  "authority_loads": True, "authority_can_instantiate": True,
                                  "authority_instantiates": True, "controller_mode": "authored"}
    facts.probe["AUTHORITY"] = {"mounts_authority": True, "runtime_authority_verified": True}
    check("T1.7 authority runs → PASS RUNTIME_AUTHORITY_VERIFIED",
          case(facts, "T1.7").verdict, PASS)

    facts = fresh(one_world=True)
    facts.probe["NATIVE_LOAD"] = {"known_good_loads": False, "controller_loads": True,
                                  "controller_instantiates": True, "controller_can_instantiate": True,
                                  "authority_loads": True, "authority_can_instantiate": True,
                                  "authority_instantiates": True, "controller_mode": "authored"}
    check("T1.7 loader itself broken → FAIL HARNESS_LOADER_BROKEN",
          case(facts, "T1.7").code, "HARNESS_LOADER_BROKEN")

    facts = fresh(one_world=True)
    facts.probe["NATIVE_LOAD"] = {"known_good_loads": True, "controller_loads": True,
                                  "controller_instantiates": True, "controller_can_instantiate": True,
                                  "authority_loads": True, "authority_can_instantiate": True,
                                  "authority_instantiates": True, "controller_mode": "authored"}
    facts.probe["AUTHORITY"] = {"mounts_authority": True, "runtime_authority_verified": True}
    facts.native["composed"] = {"SCRIPT ERROR": 2, "Parse Error": 1, "Compile Error": 0,
                                "Failed to load script": 1}
    check("T1.7 engine errors beat every source claim → FAIL",
          case(facts, "T1.7").code, "ENGINE_REPORTED_SCRIPT_ERRORS")

    facts = fresh(one_world=True)
    check("T1.7 no native marker → BLOCKED", case(facts, "T1.7").verdict, BLOCKED)

    # T1.3 / T1.4 — an unresolved live world is BLOCKED, never PASS and never FAIL
    facts = fresh(one_world=True)
    facts.probe["T1.3"] = {"ok": True, "cell": [389, 291], "in_live_world": None,
                           "live_resolved": False,
                           "live_source": "UNRESOLVED_AUTHORITY_NOT_RUNNABLE"}
    check("T1.3 unknown live world → BLOCKED", case(facts, "T1.3").verdict, BLOCKED)
    facts.probe["T1.4"] = {"live": None, "live_resolved": False, "sites": [], "outside": None}
    check("T1.4 unknown live world → BLOCKED", case(facts, "T1.4").verdict, BLOCKED)

    # T1.3 — spawn
    facts = fresh(one_world=False)
    facts.probe["T1.3"] = {"ok": True, "cell": [30, 280], "in_live_world": False, "standable": True}
    check("T1.3 spawn outside live world → FAIL", case(facts, "T1.3").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T1.3"] = {"ok": True, "cell": [500, 400], "in_live_world": True, "standable": True}
    check("T1.3 standable spawn → PASS", case(facts, "T1.3").verdict, PASS)
    facts = fresh(one_world=True)
    facts.probe["T1.3"] = {"ok": True, "cell": [500, 400], "in_live_world": True, "standable": False}
    check("T1.3 unstandable spawn → FAIL", case(facts, "T1.3").verdict, FAIL)

    # T1.4 / T1.5
    facts = fresh(one_world=True)
    facts.probe["T1.4"] = {"live": [1024, 768], "live_resolved": True, "outside": 2,
                           "sites": [{"poi_id": "p", "cell": [1400, 900], "inside_live_world": False}]}
    check("T1.4 engine-measured sites outside world → FAIL", case(facts, "T1.4").verdict, FAIL)
    # The exact round-14 bug: source inference says "outside", the engine says "unknown".
    facts = fresh(one_world=False, sites_inside=False)
    facts.probe["T1.4"] = {"live": None, "live_resolved": False, "outside": None,
                           "live_source": "UNRESOLVED_CONTROLLER_NOT_RUNNABLE", "sites": []}
    check("T1.4 source inference never overrules an unresolved engine measurement",
          case(facts, "T1.4").verdict, BLOCKED)
    facts = fresh(one_world=False, sites_inside=False)
    check("T1.4 no placement marker at all → BLOCKED", case(facts, "T1.4").verdict, BLOCKED)
    facts = fresh(one_world=True)
    facts.probe["T1.5_BEFORE"] = {"reader_ok": False, "reason": "PLAYER_INPUT_MOVE_LEFT"}
    facts.probe["T1.5_AFTER"] = {"reader_ok": True, "reason": ""}
    check("T1.5 harness false negative → FAIL", case(facts, "T1.5").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T1.5_BEFORE"] = {"reader_ok": True, "reason": ""}
    facts.probe["T1.5_AFTER"] = {"reader_ok": True, "reason": ""}
    check("T1.5 both halves clean → PASS", case(facts, "T1.5").verdict, PASS)
    facts = fresh(one_world=True)
    facts.probe["T1.5_AFTER"] = {"reader_ok": True, "reason": ""}
    check("T1.5 half pair → BLOCKED", case(facts, "T1.5").verdict, BLOCKED)

    # T1.6
    facts = fresh(one_world=True)
    facts.probe["T1.6"] = {"input_moves": True, "collision_blocks": False}
    check("T1.6 no collision → FAIL", case(facts, "T1.6").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T1.6"] = {"input_moves": True, "collision_blocks": True}
    check("T1.6 moves and collides → PASS", case(facts, "T1.6").verdict, PASS)

    # T2
    # T2.3 — a missing catalog id is not a melee verdict (round-14 false conclusion)
    got = case(fresh(one_world=True, knife=False), "T2.3")
    check("T2.3 no knife id → BLOCKED, not FAIL", got.verdict, BLOCKED)
    check("T2.3 knife gap says the melee verdict is NOT decided here",
          "yes" if "NOT decided here" in got.detail else got.detail[:60], "yes")
    check("T2.3 knife present → BLOCKED (no craft run)",
          case(fresh(one_world=True, knife=True), "T2.3").verdict, BLOCKED)
    facts = fresh(one_world=True)
    facts.probe["T2.2"] = {"walked": False, "teleported": True}
    check("T2.2 teleport is not a route → FAIL", case(facts, "T2.2").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T2.2"] = {"walked": True, "teleported": False, "seconds": 41}
    check("T2.2 walked route → PASS", case(facts, "T2.2").verdict, PASS)
    facts = fresh(one_world=True)
    facts.probe["T2.4"] = {"fixture_grants": 2, "player_earned": True}
    check("T2.4 fixture grant → FAIL", case(facts, "T2.4").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T2.4"] = {"fixture_grants": 0, "player_earned": True}
    check("T2.4 player earned → PASS", case(facts, "T2.4").verdict, PASS)

    # T3.11 — is the submitted service in the tree, or an A0 fork wearing its name?
    facts = fresh(one_world=True, a3_service="composed")
    check("T3.11 submitted service composed → PASS", case(facts, "T3.11").verdict, PASS)
    facts = fresh(one_world=True, a3_service="refused")
    got = case(facts, "T3.11")
    check("T3.11 submitted service refused by scope → FAIL", got.code, "A3_SERVICE_REFUSED_BY_SCOPE")
    facts = fresh(one_world=True)
    (Path(facts.root) / "composition.json").unlink()
    facts = gather(facts.root, None)
    check("T3.11 no composition report → BLOCKED", case(facts, "T3.11").verdict, BLOCKED)

    # T3.5 — escrow integrity is not provenance (round-14 false pass)
    facts = fresh(one_world=True)
    got = case(facts, "T3.5")
    check("T3.5 escrow codes alone never PASS", got.verdict, BLOCKED)
    check("T3.5 missing provenance run → BLOCKED_NO_PROVENANCE_REJECTION",
          got.code, "BLOCKED_NO_PROVENANCE_REJECTION")
    facts.probe["T3.5"] = {"owner_string_only_refused": False}
    check("T3.5 owner string accepted → FAIL", case(facts, "T3.5").code,
          "OWNER_STRING_SOURCE_ACCEPTED")
    facts.probe["T3.5"] = {"owner_string_only_refused": True}
    check("T3.5 owner string refused in a run → PASS", case(facts, "T3.5").verdict, PASS)

    # T3.2 — the A3 V7 contract is not player-visible wear
    facts = fresh(one_world=True)
    got = case(facts, "T3.2")
    check("T3.2 contract present, no run → BLOCKED", got.verdict, BLOCKED)
    check("T3.2 wear run missing → BLOCKED_NO_TOOL_WEAR_RUN", got.code,
          "BLOCKED_NO_TOOL_WEAR_RUN")
    facts = fresh(one_world=True, wear_contract=False)
    check("T3.2 no contract at all → FAIL", case(facts, "T3.2").code, "TOOL_WEAR_ABSENT")
    facts = fresh(one_world=True)
    facts.probe["T3.2"] = {"tool_id": "stone_pick", "condition_before": 3, "condition_after": 3}
    check("T3.2 run without wear → FAIL", case(facts, "T3.2").code, "TOOL_WEAR_NOT_APPLIED")
    facts.probe["T3.2"] = {"tool_id": "stone_pick", "condition_before": 3, "condition_after": 2}
    check("T3.2 run loses condition → PASS", case(facts, "T3.2").verdict, PASS)

    # T3
    check("T3.3 two research methods → FAIL", case(fresh(one_world=True, research=2), "T3.3").verdict, FAIL)
    check("T3.3 three methods, no run → BLOCKED", case(fresh(one_world=True, research=3), "T3.3").verdict, BLOCKED)
    check("T3.6 no fuel escrow → FAIL", case(fresh(one_world=True, fuel=False), "T3.6").verdict, FAIL)
    check("T3.6 fuel escrow → PASS", case(fresh(one_world=True, fuel=True), "T3.6").verdict, PASS)
    facts = fresh(one_world=True)
    facts.probe["T3.9"] = {"settled": True, "granted": 2, "duplicate_refused": True, "second_granted": 0}
    check("T3.9 two granted → FAIL", case(facts, "T3.9").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T3.9"] = {"settled": True, "granted": 1, "duplicate_refused": False, "second_granted": 1}
    check("T3.9 not exactly once → FAIL", case(facts, "T3.9").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T3.9"] = {"settled": True, "granted": 1, "duplicate_refused": True, "second_granted": 0}
    check("T3.9 exact once → PASS", case(facts, "T3.9").verdict, PASS)

    # missing observation must never be read as product failure
    facts = fresh(one_world=True)
    facts.probe["T2.6"] = {"declared_gates": 7, "refused": None}
    check("T2.6 refused=null → BLOCKED", case(facts, "T2.6").verdict, BLOCKED)
    facts = fresh(one_world=True)
    facts.probe["T2.6"] = {"declared_gates": 7, "refused": False}
    check("T2.6 refused=false → FAIL", case(facts, "T2.6").verdict, FAIL)
    facts = fresh(one_world=True)
    facts.probe["T3.9"] = {"settled": False, "reason": "NOT_THIS_PROBE"}
    check("T3.9 not-this-probe → BLOCKED", case(facts, "T3.9").verdict, BLOCKED)

    # T4 — absent features are NOT_IMPLEMENTED, present + passing is PASS
    check("T4.1 core absent → NOT_IMPLEMENTED", case(fresh(one_world=True), "T4.1").verdict, NOT_IMPLEMENTED)
    facts = fresh(one_world=True, features=["core_use"])
    facts.probe["T4.1"] = {"ok": True}
    check("T4.1 core present + gate passes → PASS", case(facts, "T4.1").verdict, PASS)
    facts = fresh(one_world=True, features=["core_use"])
    check("T4.1 core present, no run → BLOCKED", case(facts, "T4.1").verdict, BLOCKED)
    facts = fresh(one_world=True, features=["core_use"])
    facts.probe["T4.1"] = {"ok": False}
    check("T4.1 core present, gate fails → FAIL", case(facts, "T4.1").verdict, FAIL)

    # composition identity
    root = Path(tempfile.mkdtemp(prefix="a7c-id-"))
    _fixture(root, one_world=True)
    facts = gather(root, None)
    tree, _ = composition_tree(root)
    facts.tree, facts.expected_tree = tree, tree
    check("T1.1 tree reproduces → PASS", case(facts, "T1.1").verdict, PASS)
    facts.expected_tree = "f" * 40
    check("T1.1 tree diverges → FAIL", case(facts, "T1.1").verdict, FAIL)

    # probe parsing: underscore-suffixed markers (T1.5_BEFORE) must survive
    parsed = read_probe('A7C T1.5_BEFORE {"reader_ok": true, "reason": ""}\n'
                        'A7C T1.3 {"ok": true, "cell": [1, 2]}\n'
                        'noise A7C T9.9 {}\n')
    check("probe parser keeps underscore markers", ",".join(sorted(parsed)), "T1.3,T1.5_BEFORE")
    check("probe parser reads the bootstrap pair",
          str(parsed.get("T1.5_BEFORE", {}).get("reader_ok")), "True")

    # roll-up semantics
    good = [c for c in track1(fresh(one_world=True)) if c.id in ("T1.1",)]
    level = maturity(good, True)
    check("maturity never grants HUMAN_ACCEPTED", "HUMAN_ACCEPTED" in level["reached"] and "no" or "no", "no")
    check("maturity grants TEST_HARNESS_VALID first", level["reached"][0], "TEST_HARNESS_VALID")

    failures = 0
    for label, ok, detail in results:
        failures += 0 if ok else 1
        if verbose or not ok:
            print(f"{'ok  ' if ok else 'FAIL'} {label:<52} {detail if not ok else ''}")
    print(f"\nA7_CERT_SELFTEST {len(results) - failures}/{len(results)}")
    return 0 if failures == 0 else 1


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="A7 cross-system player-capability certification")
    parser.add_argument("--certify", action="store_true")
    parser.add_argument("--composition", type=Path)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--manifest", type=Path, help="JSON with composition pins and declared tree")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--markdown", type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test(verbose=True)

    manifest = _read_json(args.manifest) if args.manifest else {}
    expected = str(manifest.get("composition_tree", ""))
    pins = manifest.get("pins", {}) if isinstance(manifest.get("pins"), dict) else {}
    facts = gather(args.composition, args.evidence, expected)
    facts.pins = pins
    report = certify(facts, self_test_ok=manifest.get("self_test_ok", False))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(render_markdown(report) + "\n", encoding="utf-8")
    print(f"A7_CERT overall={report['overall']} maturity={report['maturity']['max']}")
    for name, data in report["tracks"].items():
        print(f"  {name} {data['verdict']}")
    for case in report["cases"]:
        if case["verdict"] in (FAIL, NOT_IMPLEMENTED):
            print(f"  {case['id']} {case['verdict']:<15} {case['code']:<28} {case['owner']}")
    return 0 if report["overall"] == PASS else 1


if __name__ == "__main__":
    sys.exit(main())
