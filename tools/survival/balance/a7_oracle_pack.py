#!/usr/bin/env python3
"""A7 fail-closed acceptance oracles for the joined SOH product.

Round 12 accepted things it should have refused. Each oracle in this pack exists
because a specific false-success pattern was observed, and each one is written so
that the *only* way to reach PASS is positive, attributable evidence:

  O1  an authored reader that refuses because the harness never ran the game's
      input bootstrap is a harness defect, not an A1 source failure and not a
      player PASS (round 12 and the CT pilot both hit `PLAYER_INPUT_MOVE_LEFT`).
  O2  A1 chunks rendered beside the legacy 384x256 collision map is a sidecar,
      not `PLAYER_WORLD_MOUNTED`.
  O3  31 green assertions plus `PHYSICAL_NOT_TESTED` is a FAIL, not a pass.
  O4  `prefix_complete=false`, a freed GUI row, an unfunded job, a skipped second
      process or `nothing_to_settle` is not a paid 2PID factory receipt.
  O5  `error=0` on a black or flat frame is not visual evidence.
  O6  a stale owner pin, a workflow that pins a different owner set, or evidence
      stamped with another composition is not current product evidence.

Design rules, deliberately blunt:

* **PASS needs evidence; FAIL is contagious.** Missing evidence is BLOCKED, never
  PASS. One FAIL in any oracle fails the pack; there is no score and no average.
* The pack never runs the product and never imports A0's tooling. It reads the
  composition tree, the evidence directory and the declared pins.
* Every verdict names an owner and a kind: `test-only`, `source-contract`,
  `real-gameplay`, `visual-product`, `evidence-integrity`.

Usage:

    python3 tools/survival/balance/a7_oracle_pack.py \
        --composition /path/to/composed/tree \
        --evidence /path/to/evidence \
        --pins pins.json --expected-tree <40 hex> \
        --out results.json --markdown report.md

    python3 tools/survival/balance/a7_oracle_pack.py --self-test

`--self-test` builds synthetic negative and positive fixtures and asserts that
each oracle rejects the known-bad case with the expected code and accepts the
known-good one. It is the proof that the oracles discriminate.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

PASS = "PASS"
FAIL = "FAIL"
BLOCKED = "BLOCKED"

OWNER_ORDER = ("A0", "A1", "A3", "A6", "A7", "A8", "AVFX", "CT")


# --------------------------------------------------------------------------- #
# Result type
# --------------------------------------------------------------------------- #
@dataclass
class Result:
    oracle: str
    verdict: str
    code: str
    owner: str
    kind: str
    title: str
    detail: str = ""
    evidence: List[str] = field(default_factory=list)
    measurements: Dict[str, object] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "oracle": self.oracle,
            "verdict": self.verdict,
            "code": self.code,
            "owner": self.owner,
            "kind": self.kind,
            "title": self.title,
            "detail": self.detail,
            "evidence": self.evidence,
            "measurements": self.measurements,
        }


@dataclass
class Ctx:
    composition: Optional[Path] = None
    evidence: Optional[Path] = None
    pins: Dict[str, str] = field(default_factory=dict)
    expected_tree: str = ""
    require_resolutions: int = 3
    pin_policy: Dict[str, object] = field(default_factory=dict)


# --------------------------------------------------------------------------- #
# Small io helpers
# --------------------------------------------------------------------------- #
def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _json(path: Path) -> dict:
    try:
        return json.loads(_read(path))
    except (ValueError, OSError):
        return {}


def _comp(ctx: Ctx, rel: str) -> Optional[Path]:
    if ctx.composition is None:
        return None
    path = ctx.composition / rel
    return path if path.exists() else None


def _comp_text(ctx: Ctx, rel: str) -> str:
    path = _comp(ctx, rel)
    return _read(path) if path else ""


def _evidence_files(ctx: Ctx, suffixes: Sequence[str]) -> List[Path]:
    if ctx.evidence is None or not ctx.evidence.exists():
        return []
    out: List[Path] = []
    for path in sorted(ctx.evidence.rglob("*")):
        if path.is_file() and path.suffix.lower() in suffixes:
            out.append(path)
    return out


def _evidence_text(ctx: Ctx, suffixes: Sequence[str] = (".txt", ".log", ".md")) -> str:
    return "\n".join(_read(p) for p in _evidence_files(ctx, suffixes))


def _truth(value: str) -> bool:
    return str(value).strip().lower() in ("true", "1", "yes", "ok")


def _exit_code(path: Path) -> Optional[int]:
    for candidate in (path.with_suffix(path.suffix + ".exit"), path.with_suffix(".exit")):
        if candidate.exists():
            text = _read(candidate).strip()
            try:
                return int(text.split()[0])
            except (ValueError, IndexError):
                return None
    return None


# --------------------------------------------------------------------------- #
# O1 — an input-bootstrap refusal is a harness artefact, not an owner failure
# --------------------------------------------------------------------------- #
_BEFORE = re.compile(r"(?:CT_BOOTSTRAP_BEFORE|A7_O1_BEFORE).*?reader_ok=(true|false).*?reason=(\S*)", re.I)
_AFTER = re.compile(r"(?:CT_BOOTSTRAP_READER_AFTER|A7_O1_AFTER).*?ok=(true|false).*?reason=(\S*)", re.I)
_RESULT = re.compile(r"(?:CT_BOOTSTRAP_RESULT|A7_O1_RESULT)\s+(.+)", re.I)


def both_missing(before, after) -> bool:
    return before is None and after is None


def oracle_bootstrap(ctx: Ctx) -> Result:
    """O1 — `PLAYER_INPUT_*` before app init must never be scored as A1's fault.

    Both halves are mandatory. A lone `AFTER` record is not a control, and a lone
    `BEFORE` record is not a comparison: each returns a structured BLOCKED with a
    machine-readable code instead of raising, because an oracle that crashes is an
    oracle that could be mistaken for "untested".
    """
    text = _evidence_text(ctx)
    before = _BEFORE.search(text)
    after = _AFTER.search(text)
    result = _RESULT.search(text)
    if before is None or after is None:
        missing = [name for name, value in (("BEFORE", before), ("AFTER", after)) if value is None]
        present = None if both_missing(before, after) else ("AFTER" if before is None else "BEFORE")
        runner = result.group(1).strip()[:160] if result else "(none)"
        code = "BLOCKED_NO_BOOTSTRAP_EVIDENCE" if present is None else "BLOCKED_MISSING_BOOTSTRAP_CONTROL"
        headline = ("no before/after input-bootstrap pair in the evidence" if present is None
                    else f"the evidence has a {present} half and no {missing[0]} half")
        return Result(
            "O1", BLOCKED, code, "A7", "evidence-integrity",
            headline,
            "A single half cannot distinguish a harness ordering defect from a genuine A1 "
            "refusal. `a1_runtime_compatibility.gd:124-131` gates on `InputMap.has_action`, "
            "which only exists once the `InputBootstrap` autoload has entered the tree, so "
            "both the pre-bootstrap and the bootstrapped run must be recorded. "
            f"runner verdict present: {runner}",
            [f"missing half: {name}" for name in missing] + [f"runner verdict: {runner}"],
            {"missing": missing, "present": present},
        )
    before_ok, before_reason = _truth(before.group(1)), before.group(2)
    after_ok, after_reason = _truth(after.group(1)), after.group(2)
    evidence = [
        f"direct run: reader_ok={before_ok} reason={before_reason or '(none)'}",
        f"bootstrapped run: reader_ok={after_ok} reason={after_reason or '(none)'}",
    ]
    if result:
        evidence.append(f"runner verdict: {result.group(1).strip()[:160]}")
    measurements = {"before_ok": before_ok, "after_ok": after_ok,
                    "before_reason": before_reason, "after_reason": after_reason}

    if before_ok and after_ok:
        return Result("O1", PASS, "NO_INPUT_BLOCKER", "A1", "source-contract",
                      "the reader configures in both the direct and the bootstrapped run",
                      "", evidence, measurements)
    if before_reason.startswith("PLAYER_INPUT_"):
        if after_ok:
            return Result(
                "O1", FAIL, "TEST_BOOTSTRAP_FALSE_NEGATIVE", "A7", "test-only",
                "a direct-scene-tree run reported a player-input refusal that the "
                "bootstrapped application run does not reproduce",
                f"The direct run failed with `{before_reason}` and the bootstrapped run "
                "succeeded. That is a harness ordering defect, so it is neither an A1 "
                "source failure nor a player PASS. Exercise the reader after the "
                "application has initialised, or the run proves nothing.",
                evidence, measurements)
        return Result(
            "O1", FAIL, "A1_SOURCE_CONTRACT", "A1", "source-contract",
            "the reader still refuses after a real application bootstrap",
            f"Bootstrapped run failed with `{after_reason or before_reason}`; this is "
            "an A1 contract failure and must be fixed in A1's reader/connector, not "
            "worked around by the caller. The harness did initialise input, so this is "
            "not a bootstrap artefact.",
            evidence, measurements)
    return Result(
        "O1", FAIL, "A1_SOURCE_CONTRACT", "A1", "source-contract",
        "the reader refuses for a non-input reason",
        f"Direct reason `{before_reason}`, bootstrapped reason `{after_reason}`: an A1 "
        "contract failure that no bootstrap control can excuse.",
        evidence, measurements)


# --------------------------------------------------------------------------- #
# O2 — one authoritative world, not authority plus a rendered sidecar
# --------------------------------------------------------------------------- #
_AUTHORED = re.compile(r"AUTHORED_FRAME\s*:=\s*Vector2i\(\s*(\d+)\s*,\s*(\d+)\s*\)")
_SIDECAR_MARKERS = (
    "beside it, never instead of it",
    "render_legacy := true",
    "stays the world a0 governs",
    "mounted *beside*",
)


def _world_facts(ctx: Ctx) -> dict:
    facts: dict = {"live": None, "authored": None, "sites": [], "sidecar_markers": [],
                   "refusal_reason": "", "errors": []}
    legacy = _comp(ctx, "data/overworld/hollow_marches.json")
    if legacy:
        bounds = _json(legacy).get("world_bounds") or {}
        if bounds.get("w") and bounds.get("h"):
            facts["live"] = (int(bounds["w"]), int(bounds["h"]))
        else:
            facts["errors"].append("LEGACY_BOUNDS_UNREADABLE")
    else:
        facts["errors"].append("LEGACY_WORLD_ABSENT")

    authored = _AUTHORED.search(_comp_text(ctx, "game/survival/a1_authored_source.gd"))
    if authored:
        facts["authored"] = (int(authored.group(1)), int(authored.group(2)))
    else:
        facts["errors"].append("AUTHORED_FRAME_UNREADABLE")

    mount = _comp_text(ctx, "game/survival/a0_authored_world_mount.gd").lower()
    facts["sidecar_markers"] = [m for m in _SIDECAR_MARKERS if m in mount]

    poi = _comp_text(ctx, "game/survival/a0_poi_mount.gd")
    reason = re.search(r"refused with (\w+)", poi)
    facts["refusal_reason"] = reason.group(1) if reason else ""

    package = _comp(ctx, "data/survival/world_content/a8_a0_mount_transition_package.v2.json")
    if package:
        payload = _json(package)
        sites = (payload.get("existing_a8_sites") or payload.get("sites")
                 or payload.get("pois") or [])
        for site in sites:
            cell = site.get("canonical_cell") or site.get("cell")
            if isinstance(cell, list) and len(cell) == 2:
                facts["sites"].append((_site_id(site), (int(cell[0]), int(cell[1]))))
        facts["package_status"] = str(payload.get("package_status", ""))
    if not facts["sites"]:
        facts["errors"].append("A8_SITES_UNREADABLE")
    return facts


def _site_id(site: dict) -> str:
    return str(site.get("poi_id") or site.get("site_id") or site.get("id") or "?")


def oracle_world_authority(ctx: Ctx) -> Result:
    """O2 — render/collision/spawn/resource/building must share one world."""
    facts = _world_facts(ctx)
    live, authored = facts["live"], facts["authored"]
    outside = []
    if live:
        outside = [(sid, cell) for sid, cell in facts["sites"]
                   if not (0 <= cell[0] < live[0] and 0 <= cell[1] < live[1])]
    evidence = [
        f"live runtime world bounds: {live}",
        f"A1 authored frame: {authored}",
        f"A8 declared sites: {facts['sites']}",
        f"sites outside the live bounds: {outside}",
        f"A0 mount declares sidecar: {facts['sidecar_markers'] or 'no'}",
        f"A0 poi-mount refusal reason: {facts['refusal_reason'] or '(none)'}",
        f"A8 package status: {facts.get('package_status') or '(unknown)'}",
    ]
    measurements = {"live": live, "authored": authored, "outside_sites": outside,
                    "sidecar_markers": facts["sidecar_markers"]}

    if not live or not authored:
        return Result("O2", BLOCKED, "BLOCKED_WORLD_FACTS_UNREADABLE", "A7", "evidence-integrity",
                      "the composition does not expose both world extents",
                      f"errors={facts['errors']}", evidence, measurements)

    contradictions = []
    if live != authored:
        contradictions.append(f"runtime world {live[0]}x{live[1]} != authored {authored[0]}x{authored[1]}")
    if facts["sidecar_markers"]:
        contradictions.append("A0's own mount declares the authored stream runs beside the legacy world")
    if outside:
        contradictions.append(f"{len(outside)} of {len(facts['sites'])} A8 sites lie outside the live world")
    if facts["refusal_reason"] and contradictions:
        # Corroboration only: a refusal sentence inside A0's own file must not be able
        # to fail a composition that the measurements above say is consistent.
        contradictions.append(
            f"A0's mount documents its own refusal as {facts['refusal_reason']}")

    if contradictions:
        return Result("O2", FAIL, "SIDECAR_WORLD", "A0", "source-contract",
                      "the player's authoritative world and A1's authored world are two different documents",
                      "; ".join(contradictions), evidence, measurements)

    runtime = re.search(r"A7_O2\s+same_source=(true|false).*?(?:authority=(\S+))?", _evidence_text(ctx))
    if runtime is None:
        return Result("O2", BLOCKED, "BLOCKED_NO_RUNTIME_AUTHORITY_EVIDENCE", "A7", "evidence-integrity",
                      "the source is consistent but no run proves the player really uses it",
                      "Require `A7_O2 same_source=true` from a run that walks the real player and "
                      "compares its collision, camera, spawn, resource and building sources.",
                      evidence, measurements)
    if not _truth(runtime.group(1)):
        return Result("O2", FAIL, "RUNTIME_SPLIT_AUTHORITY", "A0", "real-gameplay",
                      "the run reports the player is not on the authored world",
                      "A7_O2 same_source=false", evidence, measurements)
    return Result("O2", PASS, "PLAYER_WORLD_MOUNTED", "A0", "real-gameplay",
                  "one authoritative world serves render, collision, spawn and building",
                  "", evidence, measurements)


# --------------------------------------------------------------------------- #
# O3 — a physical POI is two sites entered and left by the real player
# --------------------------------------------------------------------------- #
_O3_SITE = re.compile(r"A7_O3\s+site=(\S+).*?entry=(true|false).*?exit=(true|false).*?return=(true|false)", re.I)
_NOT_TESTED = re.compile(r"PHYSICAL_NOT_TESTED|PHYSICAL_TEST_(?:SKIPPED|ABSENT)", re.I)
_OK_LINE = re.compile(r"^\s*(?:ok|PASS)\b", re.I)


def oracle_physical_poi(ctx: Ctx) -> Result:
    """O3 — green assertions plus PHYSICAL_NOT_TESTED is a product failure."""
    text = _evidence_text(ctx)
    ok_count = sum(1 for line in text.splitlines() if _OK_LINE.match(line))
    physical = {m.group(1): tuple(_truth(m.group(i)) for i in (2, 3, 4))
                for m in _O3_SITE.finditer(text)}
    not_tested = _NOT_TESTED.search(text)
    probe_lines = [line for line in text.splitlines() if line.startswith("A0_POI_PROBE")][:6]
    evidence = [
        f"assertions printed as ok: {ok_count}",
        f"physical site records: {physical}",
        f"NOT_TESTED marker: {not_tested.group(0) if not_tested else '(none)'}",
    ] + probe_lines

    if not_tested:
        return Result("O3", FAIL, "PHYSICAL_NOT_TESTED", "A8", "real-gameplay",
                      "the suite says the sites were never physically entered",
                      f"`{not_tested.group(0)}` appears in the evidence alongside {ok_count} "
                      "green assertions. Assertion count is not coverage: a site that no real "
                      "player can enter and leave is not a delivered POI.",
                      evidence, {"ok_count": ok_count, "physical": {k: list(v) for k, v in physical.items()}})

    complete = {sid: rec for sid, rec in physical.items() if all(rec)}
    if len(complete) < 2:
        if not physical:
            return Result("O3", BLOCKED, "BLOCKED_NO_PHYSICAL_EVIDENCE", "A7", "evidence-integrity",
                          "no physical site record in the evidence",
                          f"{ok_count} assertions were printed, none of them about entering a site.",
                          evidence, {"ok_count": ok_count})
        return Result("O3", FAIL, "INSUFFICIENT_PHYSICAL_SITES", "A8", "real-gameplay",
                      "fewer than two distinct sites were entered, left and returned from",
                      f"complete sites={sorted(complete)}; records={ {k: list(v) for k, v in physical.items()} }",
                      evidence, {"ok_count": ok_count, "complete": sorted(complete)})
    return Result("O3", PASS, "TWO_PHYSICAL_SITES", "A8", "real-gameplay",
                  "two distinct canonical sites were entered, left and returned from by the player",
                  f"complete sites={sorted(complete)}", evidence,
                  {"ok_count": ok_count, "complete": sorted(complete)})


# --------------------------------------------------------------------------- #
# O4 — a paid two-process factory receipt, or nothing
# --------------------------------------------------------------------------- #
def _settle_json(text: str, marker: str) -> Optional[dict]:
    for line in text.splitlines():
        if line.startswith(marker):
            payload = line[len(marker):].strip()
            try:
                value = json.loads(payload)
                return value if isinstance(value, dict) else None
            except ValueError:
                return None
    return None


_IDENTITY_KEYS = ("proposal_id", "receipt", "receipt_id", "key", "job_id", "job")
_BAD_SETTLE_REASONS = ("nothing_to_settle", "no_job", "nothing_pending", "already_pending", "")


def _identity(record: dict) -> str:
    """The one non-empty receipt identity a settlement record carries."""
    for key in _IDENTITY_KEYS:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _granted_total(record: dict) -> Optional[int]:
    """How many items a settlement actually granted, or None when unknowable.

    A0's host reports `applied` plus an `operations` count. Anything that cannot be
    counted this way is *unknown*, and unknown must never be read as "one".
    """
    applied = record.get("applied")
    if isinstance(applied, dict) and applied:
        total = 0
        counted = False
        for value in applied.values():
            if isinstance(value, bool):
                continue
            if isinstance(value, int):
                total += value
                counted = True
            elif isinstance(value, float):
                total += int(value)
                counted = True
            elif isinstance(value, dict):
                for inner_key in ("count", "amount", "quantity", "granted"):
                    inner = value.get(inner_key)
                    if isinstance(inner, int) and not isinstance(inner, bool):
                        total += inner
                        counted = True
                        break
        if counted:
            return total
    for key in ("granted", "outputs_granted", "ingots", "amount"):
        value = record.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    return None


def oracle_paid_2pid(ctx: Ctx) -> Result:
    """O4 — the only accepted offline payoff is a *positively* exactly-once receipt.

    Round 13's first version accepted `{"duplicate": false, "paid": false}`, which is
    the absence of a duplicate *claim*, not proof of a refusal. This version requires
    a funded first settlement with a real receipt identity and exactly one granted
    output, and a second attempt that is explicitly `duplicate=true` **and**
    `paid=false` against that same identity. A log marker alone cannot manufacture
    custody proof.
    """
    if ctx.evidence is None or not ctx.evidence.exists():
        return Result("O4", BLOCKED, "BLOCKED_NO_JOURNEY_EVIDENCE", "A7", "evidence-integrity",
                      "no evidence directory")
    logs = {p.name: p for p in _evidence_files(ctx, (".txt", ".log"))}
    p1, p2 = logs.get("process1.txt"), logs.get("process2.txt")
    t1 = _read(p1) if p1 else ""
    t2 = _read(p2) if p2 else ""
    both = t1 + "\n" + t2
    exit1 = _exit_code(p1) if p1 else None
    exit2 = _exit_code(p2) if p2 else None

    prefix = re.search(r"prefix_complete=(true|false)", both, re.I)
    freed = re.search(r"previously freed", both, re.I)
    departure = _settle_json(t1, "A0_CONNECTED_DEPARTURE")
    settle = _settle_json(t1, "A0_CONNECTED_OFFLINE_SETTLE") or _settle_json(t2, "A0_CONNECTED_OFFLINE_SETTLE")
    resettle = _settle_json(t1, "A0_CONNECTED_RESETTLE") or _settle_json(t2, "A0_CONNECTED_RESETTLE")
    parts = re.search(r"A0_CONNECTED_PARTS\s+job=(\S+)\s+ingots=(-?\d+)\s+parts=(-?\d+)", both)

    settle = settle or {}
    resettle = resettle or {}
    settle_reason = str(settle.get("reason", ""))
    settle_identity = _identity(settle)
    resettle_identity = _identity(resettle)
    granted = _granted_total(settle)
    regranted = _granted_total(resettle) if resettle else None
    evidence = [
        f"process1 exit={exit1} file={p1.name if p1 else '(absent)'}",
        f"process2 exit={exit2} file={p2.name if p2 else '(absent)'}",
        f"prefix_complete={prefix.group(1) if prefix else '(absent)'}",
        f"departure={departure}",
        f"offline settlement={settle or '(absent)'}",
        f"re-settlement={resettle or '(absent)'}",
        f"granted total from first settlement={granted}",
        f"receipt identity first/second={settle_identity or '(none)'} / {resettle_identity or '(none)'}",
        f"custody line={parts.group(0) if parts else '(absent)'}",
        f"first 'previously freed' line: {freed.group(0) if freed else '(none)'}",
    ]
    m = {"exit1": exit1, "exit2": exit2,
         "prefix_complete": _truth(prefix.group(1)) if prefix else None,
         "settle_reason": settle_reason, "settle_identity": settle_identity,
         "resettle_identity": resettle_identity,
         "granted": granted, "regranted": regranted,
         "resettle_duplicate": resettle.get("duplicate") if resettle else None,
         "resettle_paid": resettle.get("paid") if resettle else None,
         "resettle_has_paid_key": "paid" in resettle if resettle else False}

    def fail(code: str, title: str, detail: str, owner: str = "A0",
             kind: str = "real-gameplay") -> Result:
        return Result("O4", FAIL, code, owner, kind, title, detail, evidence, m)

    def block(code: str, title: str, detail: str) -> Result:
        return Result("O4", BLOCKED, code, "A7", "evidence-integrity", title, detail, evidence, m)

    # --- stage gates: a run that never reached the factory is not a receipt at all
    if p1 is None:
        return block("BLOCKED_NO_FIRST_PROCESS", "no process1 log in the evidence", "")
    if prefix is None:
        return fail("NO_PREFIX_MARKER", "the run never printed its own prefix verdict",
                    "Without `A0_CONNECTED prefix_complete=` a green exit code is unreadable.",
                    "A7", "test-only")
    if not _truth(prefix.group(1)):
        return fail("PREFIX_INCOMPLETE", "the run failed before the paid factory stage",
                    "`prefix_complete=false`: any later line is a partial trace, not a receipt.")
    if freed:
        return fail("FREED_GUI_NODE", "the run touched a GUI node after the panel rebuilt it",
                    "A legitimate click may rebuild its rows; the test must verify committed "
                    "state and the transaction receipt, never a cached object. "
                    f"First occurrence: {freed.group(0)}.")
    if p2 is None:
        return fail("SECOND_PROCESS_SKIPPED", "no second OS process was executed",
                    "Exactly-once settlement cannot be shown inside one process.")
    if not departure or not departure.get("ok", False):
        return fail("NO_NORMAL_DEPARTURE", "the first process never departed through the normal path",
                    f"departure={departure or '(absent)'}")
    if not settle:
        return block("BLOCKED_NO_SETTLEMENT_RECEIPT", "the second process printed no settlement",
                     "A skipped or crashed second process leaves no receipt. This is missing "
                     "evidence, not a pass and not a payout.")
    if settle_reason in _BAD_SETTLE_REASONS or not bool(settle.get("ok", False)):
        return fail("NOTHING_TO_SETTLE", "the second process had nothing to settle",
                    f"reason=`{settle_reason or '(empty)'}`: no funded job survived the first "
                    "process, so no offline payoff was paid.")
    if exit1 != 0 or exit2 != 0:
        return fail("PROCESS_FAILED", "a process did not exit cleanly",
                    f"exit codes process1={exit1} process2={exit2}")

    # --- positive exactly-once proof
    if not settle_identity:
        return block("BLOCKED_MISSING_RECEIPT_IDENTITY", "the first settlement has no receipt identity",
                     "Without a job/receipt id the second attempt cannot be tied to the first, "
                     "so 'exactly once' is unfalsifiable.")
    if granted is None:
        return block("BLOCKED_MISSING_GRANT_DETAIL", "the first settlement does not say what it granted",
                     f"settle={settle}. A receipt without a countable output cannot prove "
                     "'exactly one output'.")
    if granted != 1:
        return fail("WRONG_GRANT_COUNT", "the first settlement did not grant exactly one output",
                    f"granted={granted} from applied={settle.get('applied')!r} "
                    f"operations={settle.get('operations')!r}")
    if parts and (int(parts.group(2)) != 1 or int(parts.group(3)) != 0):
        return fail("CUSTODY_MISMATCH", "the custody line disagrees with the settlement",
                    f"`{parts.group(0)}` reports ingots={parts.group(2)} parts={parts.group(3)} "
                    "after a settlement that claims one granted output.")
    if bool(settle.get("duplicate", False)):
        return fail("FIRST_SETTLEMENT_WAS_A_DUPLICATE", "the 'first' settlement is itself a duplicate",
                    "A duplicate cannot be the paid baseline that proves exactly-once.")

    if not resettle:
        return fail("NO_DUPLICATE_CONTROL", "no second claim was attempted",
                    "Proving 'exactly once' needs a duplicate attempt that is refused.")
    if resettle.get("duplicate") is not True:
        return fail("NO_DUPLICATE_REFUSAL", "the second claim was not recorded as a duplicate refusal",
                    f"resettle={resettle}: `duplicate` must be exactly true. A record with "
                    "`duplicate=false` proves nothing, whether `paid` is true or false.")
    if "paid" not in resettle and regranted not in (0, None):
        return fail("SECOND_PAYOUT", "the second claim granted something without saying it paid",
                    f"resettle={resettle} granted={regranted}")
    if "paid" in resettle and resettle.get("paid") is not False:
        return fail("SECOND_PAYOUT", "the second claim was recorded as paid",
                    f"resettle={resettle}: `paid` must be exactly false.")
    if regranted not in (None, 0):
        return fail("SECOND_PAYOUT", "the second claim granted a second output",
                    f"regranted={regranted} from resettle={resettle}")
    if resettle_identity and resettle_identity != settle_identity:
        return fail("RECEIPT_IDENTITY_MISMATCH", "the refused claim used a different receipt identity",
                    f"first={settle_identity} second={resettle_identity}: the two records are "
                    "about different jobs, so no refusal of *this* job was demonstrated.")
    if not resettle_identity:
        return block("BLOCKED_MISSING_RECEIPT_IDENTITY",
                     "the refused second claim carries no receipt identity",
                     f"resettle={resettle}: a refusal that names no job cannot be tied to the "
                     "paid one, so it cannot demonstrate exactly-once.")
    return Result("O4", PASS, "PAID_2PID_RECEIPT", "A0", "real-gameplay",
                  "a funded job settled exactly once and the same receipt was then refused",
                  f"granted={granted}, receipt={settle_identity}, duplicate refusal confirmed, "
                  f"second grant={regranted if regranted is not None else 'none recorded'}",
                  evidence, m)


# --------------------------------------------------------------------------- #
# O5 — a frame with no content is not visual evidence
# --------------------------------------------------------------------------- #
def _pixel_stats(path: Path) -> dict:
    try:
        from PIL import Image  # imported here so the rest of the pack runs without Pillow
    except ImportError:  # pragma: no cover - dependency reported as BLOCKED
        raise RuntimeError("PIL_UNAVAILABLE")
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        width, height = rgb.size
        sample = rgb.resize((min(width, 320), min(height, 180)))
        colors = sample.getcolors(maxcolors=1 << 24) or []
        total = sample.size[0] * sample.size[1]
        modal = max((count for count, _ in colors), default=total)
        luminance = [
            0.299 * r + 0.587 * g + 0.114 * b
            for count, (r, g, b) in colors
            for _ in range(min(count, 1))
        ]
        weighted = [(0.299 * r + 0.587 * g + 0.114 * b, count) for count, (r, g, b) in colors]
        mean = sum(value * count for value, count in weighted) / max(total, 1)
        variance = sum(count * (value - mean) ** 2 for value, count in weighted) / max(total, 1)
        return {
            "width": width, "height": height,
            "unique_colors": len(colors),
            "stdev": round(variance ** 0.5, 3),
            "nonmodal_fraction": round(1.0 - modal / max(total, 1), 4),
            "mean_luminance": round(mean, 2),
            "samples": len(luminance),
        }


def oracle_pixels(ctx: Ctx) -> Result:
    """O5 — reject blank, flat and missing frames; `error=0` proves nothing."""
    frames = _evidence_files(ctx, (".png",))
    claims = re.findall(r"A0_CAPTURE\s+(\S+)\s+(\S+)\s+error=(\d+)", _evidence_text(ctx))
    missing_claims = [c for c in claims if Path(c[1]).name and not Path(c[1]).exists()]
    if not frames:
        return Result("O5", BLOCKED, "BLOCKED_NO_FRAMES", "A7", "evidence-integrity",
                      "no PNG in the evidence",
                      f"render claims={len(claims)}; a claim without a file is not a capture.")
    rows, failures = [], []
    for path in frames:
        try:
            stats = _pixel_stats(path)
        except RuntimeError:
            return Result("O5", BLOCKED, "BLOCKED_PILLOW_ABSENT", "A7", "evidence-integrity",
                          "Pillow is required to judge pixels",
                          "pip install pillow")
        except Exception as error:  # unreadable / truncated file
            failures.append(f"{path.name}: unreadable ({error})")
            continue
        stats["file"] = path.name
        rows.append(stats)
        if stats["width"] < 640 or stats["height"] < 360:
            failures.append(f"{path.name}: {stats['width']}x{stats['height']} below the 640x360 canvas")
        if stats["unique_colors"] <= 4 or stats["stdev"] < 1.5 or stats["nonmodal_fraction"] < 0.01:
            failures.append(
                f"{path.name}: blank/flat (colors={stats['unique_colors']}, "
                f"stdev={stats['stdev']}, nonmodal={stats['nonmodal_fraction']})")
        elif stats["unique_colors"] < 16 or stats["nonmodal_fraction"] < 0.02:
            failures.append(
                f"{path.name}: too little content to review (colors={stats['unique_colors']}, "
                f"nonmodal={stats['nonmodal_fraction']})")
    resolutions = sorted({(row["width"], row["height"]) for row in rows})
    if ctx.require_resolutions > 1 and len(resolutions) < ctx.require_resolutions:
        failures.append(f"{len(resolutions)} distinct resolutions; {ctx.require_resolutions} required")
    evidence = [f"{row['file']}: {row['width']}x{row['height']} colors={row['unique_colors']} "
                f"stdev={row['stdev']} nonmodal={row['nonmodal_fraction']}" for row in rows]
    if missing_claims:
        evidence.append(f"render claims whose file is absent: {len(missing_claims)}")
    if failures:
        code = "BLANK_FRAME" if any("blank/flat" in f for f in failures) else "INSUFFICIENT_FRAMES"
        return Result("O5", FAIL, code, "A7", "visual-product",
                      "a capture is missing, blank or too flat to judge", "; ".join(failures),
                      evidence, {"frames": rows, "resolutions": resolutions})
    return Result("O5", PASS, "NONBLANK_FRAMES_ONLY", "A7", "visual-product",
                  "every frame is non-blank and reviewable in size — this is NOT a visual-quality verdict",
                  "This gate only refuses black, flat, undersized or missing frames. It says "
                  "nothing about art quality, readability, composition or lighting; those "
                  "remain NOT_GRADED until a human or a specified visual rubric runs, and no "
                  "report may cite this PASS as visual acceptance.",
                  evidence, {"frames": rows, "resolutions": resolutions,
                             "visual_quality": "NOT_GRADED",
                             "scope": "nonblank_gate_only"})


# --------------------------------------------------------------------------- #
# O6 — provenance: pins, workflow agreement, composition identity
# --------------------------------------------------------------------------- #
_PIN = re.compile(r"^\s*([A-Z0-9]+)_SHA:\s*\"?([0-9a-f]{40})\"?", re.M)


def composition_tree(path: Path) -> Tuple[str, str]:
    """Return (tree sha, method) for a composed directory, without touching it."""
    git_dir = Path(tempfile.mkdtemp(prefix="a7-tree-"))
    try:
        base_env = dict(os.environ)
        base_env.update({"GIT_DIR": str(git_dir), "GIT_CONFIG_NOSYSTEM": "1"})
        base_env.pop("GIT_WORK_TREE", None)
        env = dict(base_env)
        env.update({"GIT_WORK_TREE": str(path), "GIT_INDEX_FILE": str(git_dir / "index")})
        def run(*args: str) -> subprocess.CompletedProcess:
            return subprocess.run(["git", *args], env=env, capture_output=True, text=True)
        init = subprocess.run(["git", "init", "--quiet", "--bare"],
                              env=base_env, capture_output=True, text=True)
        if init.returncode != 0:
            return f"init-failed: {init.stderr.strip()[:120]}", "git-write-tree"
        # `git add` skips a nested `.git` itself, but a composition may carry one from
        # an earlier check; excluding it explicitly keeps this a pure read.
        add = run("add", "--force", "--all", "--", ".", ":(exclude).git", ":(exclude).git/**")
        if add.returncode != 0:
            return f"add-failed: {add.stderr.strip()[:120]}", "git-write-tree"
        out = run("write-tree")
        tree = out.stdout.strip()
        if out.returncode != 0 or not tree:
            return f"write-tree-failed: {out.stderr.strip()[:120]}", "git-write-tree"
        return tree, "git-write-tree"
    finally:
        shutil.rmtree(git_dir, ignore_errors=True)


def _workflow_classes(ctx: Ctx, workflows: Sequence[Path]) -> Dict[str, Tuple[str, str]]:
    """Classify each workflow as CURRENT or HISTORICAL, with a stated reason.

    The default is CURRENT and that default is load-bearing: anything not explicitly
    declared historical in `ctx.pin_policy` is held to the live pins. A frozen
    Round-12 workflow must be *labelled* frozen rather than silently forgiven, and a
    labelled-historical workflow can never be cited as current production evidence.
    """
    declared = ctx.pin_policy.get("historical", {}) if isinstance(ctx.pin_policy, dict) else {}
    classes: Dict[str, Tuple[str, str]] = {}
    for workflow in workflows:
        name = workflow.name
        if name in declared:
            reason = declared[name].get("reason", "") if isinstance(declared[name], dict) else str(declared[name])
            classes[name] = ("HISTORICAL", reason or "declared historical")
            continue
        marker = re.search(r"#\s*a7-pin-policy:\s*historical\b[^\n]*", _read(workflow))
        if marker:
            classes[name] = ("HISTORICAL", marker.group(0)[2:].strip())
            continue
        classes[name] = ("CURRENT", "not declared historical: held to the live pins")
    return classes


def oracle_provenance(ctx: Ctx) -> Result:
    """O6 — stale pins, foreign trees and split owners never qualify as current evidence.

    Historical workflows are labelled and excluded from the *current* pin requirement;
    they are still listed, because a workflow that pins another owner's SHA is exactly
    how a stale composition gets quoted as current.
    """
    evidence: List[str] = []
    details: Dict[str, object] = {}

    workflows = []
    if ctx.composition is not None:
        workflows = sorted((ctx.composition / ".github/workflows").glob("*.yml"))
        workflows += sorted((ctx.composition / ".github/workflows").glob("*.yaml"))
    classes = _workflow_classes(ctx, workflows)
    details["workflow_classes"] = {name: cls for name, (cls, _) in classes.items()}
    details["workflow_reasons"] = {name: reason for name, (_, reason) in classes.items()}

    stale_current: List[dict] = []
    stale_historical: List[dict] = []
    for workflow in workflows:
        bucket = stale_current if classes[workflow.name][0] == "CURRENT" else stale_historical
        for match in _PIN.finditer(_read(workflow)):
            owner, sha = match.group(1), match.group(2)
            expected = ctx.pins.get(owner)
            if expected and not (sha.startswith(expected[:12]) or expected.startswith(sha[:12])):
                bucket.append({"file": workflow.name, "owner": owner,
                               "pinned": sha[:12], "expected": expected[:12],
                               "class": classes[workflow.name][0]})
    details["stale_pins_current"] = stale_current
    details["stale_pins_historical"] = stale_historical
    if stale_historical:
        evidence.append("historical workflows with their own frozen pins (not current evidence): "
                        + json.dumps(stale_historical))
    if stale_current:
        by_owner: Dict[str, List[str]] = {}
        for item in stale_current:
            by_owner.setdefault(item["owner"], []).append(item["file"])
        evidence.append("current workflows with stale pins: " + json.dumps(stale_current))

    tree_measure = None
    if ctx.composition is not None and ctx.expected_tree:
        try:
            actual, method = composition_tree(ctx.composition)
        except Exception as error:  # pragma: no cover
            actual, method = f"error: {error}", "failed"
        tree_measure = {"expected": ctx.expected_tree, "actual": actual, "method": method}
        details["composition"] = tree_measure
        evidence.append(f"composition tree: expected {ctx.expected_tree[:12]}, "
                        f"recomputed {actual[:12]} ({method})")

    stamps = set()
    text = _evidence_text(ctx)
    for match in re.finditer(r"composition[^0-9a-f]{0,8}([0-9a-f]{12,40})", text, re.I):
        stamps.add(match.group(1))
    details["evidence_composition_stamps"] = sorted(stamps)
    if stamps:
        evidence.append("evidence composition stamps: " + ", ".join(sorted(stamps)))

    failures: List[str] = []
    if tree_measure and not tree_measure["actual"].startswith(ctx.expected_tree[:12]):
        failures.append(f"composition identity mismatch: expected {ctx.expected_tree[:12]}, "
                        f"recomputed {tree_measure['actual'][:12]}")
    if stamps and ctx.expected_tree and not any(
            stamp.startswith(ctx.expected_tree[:12]) or ctx.expected_tree.startswith(stamp[:12])
            for stamp in stamps):
        failures.append("evidence is stamped with a different composition: "
                        + ", ".join(sorted(stamps))[:200])
    if stale_current:
        owners = sorted({item["owner"] for item in stale_current})
        files = sorted({item["file"] for item in stale_current})
        failures.append(f"{len(stale_current)} stale pin(s) in {len(files)} CURRENT workflow(s) "
                        f"({', '.join(files)}) for owner(s) {', '.join(owners)}")

    if failures:
        code = "STALE_PIN" if stale_current else ("STALE_COMPOSITION" if tree_measure else "PROVENANCE_MISMATCH")
        owner = "A0" if stale_current else "A7"
        return Result("O6", FAIL, code, owner, "evidence-integrity",
                      "current-product provenance cannot be established",
                      "; ".join(failures), evidence, details)

    has_current = any(cls == "CURRENT" for cls, _ in classes.values())
    if not has_current and not tree_measure:
        return Result("O6", BLOCKED, "BLOCKED_NO_CURRENT_WORKFLOW", "A7", "evidence-integrity",
                      "every workflow in this tree is declared historical",
                      "Without at least one CURRENT workflow, or a reproduced tree identity, "
                      "the tree cannot be tied to the live owner pins.", evidence, details)
    if not workflows and not stamps and not tree_measure:
        return Result("O6", BLOCKED, "BLOCKED_NO_PROVENANCE_INPUT", "A7", "evidence-integrity",
                      "nothing to check provenance against")
    note = (f"{len(stale_historical)} stale pin(s) live only in declared historical workflows"
            if stale_historical else "no stale pins anywhere")
    return Result("O6", PASS, "PROVENANCE_CURRENT", "A7", "evidence-integrity",
                  "current workflows and composition identity agree", note, evidence, details)


# --------------------------------------------------------------------------- #
# Runner
# --------------------------------------------------------------------------- #
ORACLES = {
    "O1": ("input bootstrap attribution", oracle_bootstrap),
    "O2": ("world authority", oracle_world_authority),
    "O3": ("physical POI", oracle_physical_poi),
    "O4": ("paid two-process factory", oracle_paid_2pid),
    "O5": ("pixel evidence", oracle_pixels),
    "O6": ("provenance", oracle_provenance),
}


def run_pack(ctx: Ctx, only: Sequence[str] = ()) -> dict:
    results: List[Result] = []
    for key, (_, fn) in ORACLES.items():
        if only and key not in only:
            continue
        try:
            results.append(fn(ctx))
        except Exception as error:  # an oracle that crashes must not pass
            results.append(Result(key, BLOCKED, "ORACLE_CRASHED", "A7", "evidence-integrity",
                                  "the oracle itself failed", repr(error)))
    verdicts = [r.verdict for r in results]
    if FAIL in verdicts:
        overall = FAIL
    elif BLOCKED in verdicts:
        overall = BLOCKED
    else:
        overall = PASS
    blocking = [r for r in results if r.verdict == FAIL]
    return {
        "schema": "soh.a7.oracle_pack.v1",
        "overall": overall,
        "policy": "no score, no average; PASS requires positive evidence, missing evidence is BLOCKED",
        "first_blocker": blocking[0].as_dict() if blocking else None,
        "results": [r.as_dict() for r in results],
        "composition": str(ctx.composition) if ctx.composition else None,
        "evidence": str(ctx.evidence) if ctx.evidence else None,
        "pins": ctx.pins,
        "expected_tree": ctx.expected_tree,
    }


def render_markdown(pack: dict) -> str:
    lines = ["# A7 oracle pack — fail-closed run", "",
             f"**Overall: `{pack['overall']}`** · composition `{(pack.get('expected_tree') or '(none)')[:12]}`",
             "", "| oracle | verdict | code | owner | kind | title |",
             "|---|---|---|---|---|---|"]
    for row in pack["results"]:
        lines.append(f"| {row['oracle']} | **{row['verdict']}** | `{row['code']}` | {row['owner']} | "
                     f"{row['kind']} | {row['title']} |")
    blocker = pack.get("first_blocker")
    if blocker:
        lines += ["", "## First blocker", "",
                  f"`{blocker['oracle']}` · **{blocker['code']}** · owner **{blocker['owner']}** "
                  f"({blocker['kind']})", "", blocker["detail"] or "(no detail)", ""]
    lines += ["", "## Evidence", ""]
    for row in pack["results"]:
        lines.append(f"### {row['oracle']} — {row['verdict']} `{row['code']}`")
        if row["detail"]:
            lines.append(row["detail"])
        for item in row["evidence"]:
            lines.append(f"- {item}")
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Self-test: prove the oracles reject the known-bad and accept the known-good
# --------------------------------------------------------------------------- #
def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _png(path: Path, kind: str, size: Tuple[int, int] = (640, 360)) -> None:
    from PIL import Image
    path.parent.mkdir(parents=True, exist_ok=True)
    if kind == "black":
        Image.new("RGB", size, (0, 0, 0)).save(path)
    elif kind == "flat":
        Image.new("RGB", size, (40, 60, 40)).save(path)
    else:
        import random
        random.seed(7)
        image = Image.new("RGB", size)
        image.putdata([(random.randrange(256), random.randrange(256), random.randrange(256))
                       for _ in range(size[0] * size[1])])
        image.save(path)


def _mini_composition(root: Path, consistent: bool) -> None:
    live = (1024, 768) if consistent else (384, 256)
    _write(root / "data/overworld/hollow_marches.json",
           json.dumps({"world_bounds": {"x": 0, "y": 0, "w": live[0], "h": live[1]}}))
    _write(root / "game/survival/a1_authored_source.gd", "const AUTHORED_FRAME := Vector2i(1024, 768)\n")
    statement = ("## The authored stream replaces the legacy inset; one authoritative world.\n"
                 if consistent else
                 "## the authored stream is mounted *beside* it, never instead of it.\n"
                 "var render_legacy := true\n")
    _write(root / "game/survival/a0_authored_world_mount.gd", statement)
    _write(root / "game/survival/a0_poi_mount.gd",
           "## all three A8 south sites are refused with A1_RUNTIME_WORLD_EXTENT_ABSENT.\n"
           if not consistent else "## every A8 site lies inside the live world.\n")
    _write(root / "data/survival/world_content/a8_a0_mount_transition_package.v2.json",
           json.dumps({"sites": [
               {"poi_id": "poi_crown_south_quarry", "canonical_cell": [30, 280]},
               {"poi_id": "poi_crown_south_orchard", "canonical_cell": [140, 360]}]}))
    pins = {"A1": "a030cb89a5033ba5faba39995762b4bea1332cec"} if consistent else \
           {"A1": "ffffffffffffffffffffffffffffffffffffffff"}
    _write(root / ".github/workflows/a0-connected-journey.yml",
           "env:\n  A1_SHA: " + list(pins.values())[0] + "\n")


def self_test(verbose: bool = True) -> int:
    """Prove every oracle rejects the known-bad case and accepts the known-good one.

    Each case states the verdict **and** the code, because a FAIL for the wrong reason
    is how a fail-closed pack quietly stops discriminating.
    """
    def fresh() -> Path:
        return Path(tempfile.mkdtemp(prefix="a7-oracle-"))

    good_pins = {"A1": "a030cb89a5033ba5faba39995762b4bea1332cec"}
    cases: List[Tuple[str, "Ctx", str, str, Optional[str]]] = []

    # ------------------------------------------------------------------ O1
    root = fresh(); _write(root / "ev/process1.txt",
                           "CT_BOOTSTRAP_BEFORE action_registered=false reader_ok=false reason=PLAYER_INPUT_MOVE_LEFT\n"
                           "CT_BOOTSTRAP_READER_AFTER ok=true reason=\n"
                           "CT_BOOTSTRAP_RESULT PASS_DIRECT_SCRIPT_FALSE_BLOCKER\n")
    cases.append(("O1 harness false blocker → FAIL", Ctx(evidence=root / "ev"),
                  "O1", FAIL, "TEST_BOOTSTRAP_FALSE_NEGATIVE"))
    root = fresh(); _write(root / "ev/process1.txt",
                           "CT_BOOTSTRAP_BEFORE action_registered=true reader_ok=true reason=\n"
                           "CT_BOOTSTRAP_READER_AFTER ok=true reason=\n")
    cases.append(("O1 both halves clean → PASS", Ctx(evidence=root / "ev"), "O1", PASS, "NO_INPUT_BLOCKER"))
    root = fresh(); _write(root / "ev/process1.txt",
                           "CT_BOOTSTRAP_BEFORE action_registered=false reader_ok=false reason=PLAYER_INPUT_MOVE_LEFT\n"
                           "CT_BOOTSTRAP_READER_AFTER ok=false reason=PLAYER_INPUT_MOVE_LEFT_UNBOUND\n")
    cases.append(("O1 genuine bootstrapped source refusal → FAIL A1", Ctx(evidence=root / "ev"),
                  "O1", FAIL, "A1_SOURCE_CONTRACT"))
    root = fresh(); _write(root / "ev/process1.txt",
                           "CT_BOOTSTRAP_READER_AFTER ok=true reason=\n"
                           "CT_BOOTSTRAP_RESULT PASS_DIRECT_SCRIPT_FALSE_BLOCKER\n")
    cases.append(("O1 AFTER without BEFORE → BLOCKED (was a crash)", Ctx(evidence=root / "ev"),
                  "O1", BLOCKED, "BLOCKED_MISSING_BOOTSTRAP_CONTROL"))
    root = fresh(); _write(root / "ev/process1.txt",
                           "CT_BOOTSTRAP_BEFORE action_registered=false reader_ok=false reason=PLAYER_INPUT_MOVE_LEFT\n")
    cases.append(("O1 BEFORE without AFTER → BLOCKED", Ctx(evidence=root / "ev"),
                  "O1", BLOCKED, "BLOCKED_MISSING_BOOTSTRAP_CONTROL"))
    root = fresh(); _write(root / "ev/process1.txt", "A0_CONNECTED prefix_complete=true\n")
    cases.append(("O1 no bootstrap evidence at all → BLOCKED", Ctx(evidence=root / "ev"),
                  "O1", BLOCKED, "BLOCKED_NO_BOOTSTRAP_EVIDENCE"))

    # ------------------------------------------------------------------ O2
    root = fresh(); _mini_composition(root / "comp", consistent=False)
    cases.append(("O2 sidecar world → FAIL", Ctx(composition=root / "comp"), "O2", FAIL, "SIDECAR_WORLD"))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    _write(root / "ev/run.txt", "A7_O2 same_source=true authority=authored\n")
    cases.append(("O2 one world + runtime proof → PASS",
                  Ctx(composition=root / "comp", evidence=root / "ev"), "O2", PASS, "PLAYER_WORLD_MOUNTED"))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    cases.append(("O2 one world, no runtime proof → BLOCKED (not PASS)",
                  Ctx(composition=root / "comp"), "O2", BLOCKED, "BLOCKED_NO_RUNTIME_AUTHORITY_EVIDENCE"))

    # ------------------------------------------------------------------ O3
    root = fresh()
    _write(root / "ev/poi.txt",
           "".join(f"  ok    assertion {i}\n" for i in range(31))
           + "A0_POI_MOUNT_PHYSICAL_NOT_TESTED no A8 site is reachable in A1's 384x256 runtime world\n")
    cases.append(("O3 31 green assertions + PHYSICAL_NOT_TESTED → FAIL",
                  Ctx(evidence=root / "ev"), "O3", FAIL, "PHYSICAL_NOT_TESTED"))
    root = fresh()
    _write(root / "ev/poi.txt",
           "A7_O3 site=poi_crown_south_quarry entry=true exit=true return=true\n"
           "A7_O3 site=poi_crown_south_orchard entry=true exit=true return=true\n")
    cases.append(("O3 two physical sites → PASS", Ctx(evidence=root / "ev"), "O3", PASS, "TWO_PHYSICAL_SITES"))

    # ------------------------------------------------------------------ O4
    def journey(root: Path, settle_line: str, resettle_line: str = "", parts: str = "") -> Path:
        _write(root / "ev/process1.txt",
               "A0_CONNECTED prefix_complete=true checks=60 failures=0\n"
               'A0_CONNECTED_DEPARTURE {"ok": true, "run_id": "run-1"}\n')
        _write(root / "ev/process1.txt.exit", "0\n")
        body = "A0_CONNECTED prefix_complete=true checks=60 failures=0\n" + settle_line + resettle_line + parts
        _write(root / "ev/process2.txt", body)
        _write(root / "ev/process2.txt.exit", "0\n")
        return root / "ev"

    paid = ('A0_CONNECTED_OFFLINE_SETTLE {"ok": true, "reason": "settled", "duplicate": false, '
            '"proposal_id": "prop-7", "operations": 1, "applied": {"iron_ingot": 1}}\n')
    refused = ('A0_CONNECTED_RESETTLE {"ok": false, "reason": "duplicate_receipt", "duplicate": true, '
               '"paid": false, "proposal_id": "prop-7", "applied": {}}\n')

    root = fresh()
    cases.append(("O4 funded, exactly once → PASS", Ctx(evidence=journey(root, paid, refused)), "O4",
                  PASS, "PAID_2PID_RECEIPT"))
    root = fresh()
    cases.append(("O4 OLD FALSE GREEN duplicate=false,paid=false → FAIL",
                  Ctx(evidence=journey(root, paid,
                                       'A0_CONNECTED_RESETTLE {"ok": true, "duplicate": false, "paid": false, '
                                       '"proposal_id": "prop-7"}\n')), "O4", FAIL, "NO_DUPLICATE_REFUSAL"))
    root = fresh()
    cases.append(("O4 duplicate refusal with no prior paid settlement → BLOCKED",
                  Ctx(evidence=journey(root, "", refused)), "O4", BLOCKED, "BLOCKED_NO_SETTLEMENT_RECEIPT"))
    root = fresh()
    cases.append(("O4 refusal claims duplicate on a job never paid here → BLOCKED",
                  Ctx(evidence=journey(root, 'A0_CONNECTED_OFFLINE_SETTLE {"ok": true, "reason": "nothing_to_settle", '
                                              '"duplicate": false}\n', refused)), "O4", FAIL, "NOTHING_TO_SETTLE"))
    root = fresh()
    cases.append(("O4 two outputs granted → FAIL",
                  Ctx(evidence=journey(root, paid.replace('"iron_ingot": 1', '"iron_ingot": 2'), refused)),
                  "O4", FAIL, "WRONG_GRANT_COUNT"))
    root = fresh()
    cases.append(("O4 refused claim names a different receipt → FAIL",
                  Ctx(evidence=journey(root, paid, refused.replace("prop-7", "prop-8"))), "O4",
                  FAIL, "RECEIPT_IDENTITY_MISMATCH"))
    root = fresh()
    cases.append(("O4 second claim marked paid → FAIL",
                  Ctx(evidence=journey(root, paid, refused.replace('"paid": false', '"paid": true'))),
                  "O4", FAIL, "SECOND_PAYOUT"))
    root = fresh()
    cases.append(("O4 settlement without receipt identity → BLOCKED",
                  Ctx(evidence=journey(root, paid.replace('"proposal_id": "prop-7", ', ''), refused)), "O4",
                  BLOCKED, "BLOCKED_MISSING_RECEIPT_IDENTITY"))
    root = fresh()
    cases.append(("O4 settlement without grant detail → BLOCKED",
                  Ctx(evidence=journey(root, paid.replace(', "applied": {"iron_ingot": 1}', ''), refused)), "O4",
                  BLOCKED, "BLOCKED_MISSING_GRANT_DETAIL"))
    root = fresh()
    cases.append(("O4 malformed settlement JSON → BLOCKED, never PASS",
                  Ctx(evidence=journey(root, 'A0_CONNECTED_OFFLINE_SETTLE {"ok": true, "reason": ')), "O4",
                  BLOCKED, "BLOCKED_NO_SETTLEMENT_RECEIPT"))
    root = fresh()
    cases.append(("O4 no duplicate attempt → FAIL",
                  Ctx(evidence=journey(root, paid)), "O4", FAIL, "NO_DUPLICATE_CONTROL"))
    root = fresh()
    cases.append(("O4 refused claim without an identity → BLOCKED",
                  Ctx(evidence=journey(root, paid, refused.replace('"proposal_id": "prop-7", ', ''))), "O4",
                  BLOCKED, "BLOCKED_MISSING_RECEIPT_IDENTITY"))

    # ------------------------------------------------------------------ O5
    root = fresh(); _png(root / "ev/black.png", "black")
    _png(root / "ev/b.png", "noise"); _png(root / "ev/c.png", "noise")
    cases.append(("O5 black frame among real ones → FAIL", Ctx(evidence=root / "ev"), "O5", FAIL, "BLANK_FRAME"))
    root = fresh()
    for name, size in (("720", (1280, 720)), ("1440", (2560, 1440)), ("2160", (3840, 2160))):
        _png(root / f"ev/{name}.png", "noise", size)
    cases.append(("O5 three resolutions, non-blank → PASS (nonblank gate only)",
                  Ctx(evidence=root / "ev"), "O5", PASS, "NONBLANK_FRAMES_ONLY"))
    root = fresh()
    for name in ("720", "1440", "2160"):
        _png(root / f"ev/{name}.png", "noise")
    cases.append(("O5 three frames, one resolution → FAIL",
                  Ctx(evidence=root / "ev"), "O5", FAIL, "INSUFFICIENT_FRAMES"))

    # ------------------------------------------------------------------ O6
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    tree, _ = composition_tree(root / "comp")
    cases.append(("O6 pins and tree agree → PASS",
                  Ctx(composition=root / "comp", pins=good_pins, expected_tree=tree),
                  "O6", PASS, "PROVENANCE_CURRENT"))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    cases.append(("O6 composition identity mismatch → FAIL",
                  Ctx(composition=root / "comp", pins=good_pins, expected_tree="0" * 40),
                  "O6", FAIL, "STALE_COMPOSITION"))
    # a stale pin in a workflow that is NOT declared historical is a current-workflow failure
    root = fresh(); _mini_composition(root / "comp", consistent=False)
    cases.append(("O6 stale pin in an undeclared workflow → FAIL (fail-closed default)",
                  Ctx(composition=root / "comp", pins=good_pins), "O6", FAIL, "STALE_PIN"))
    # a tree whose only workflow is declared historical has no current provenance at all
    root = fresh(); _mini_composition(root / "comp", consistent=False)
    cases.append(("O6 only historical workflows → BLOCKED, not quietly PASS",
                  Ctx(composition=root / "comp", pins=good_pins,
                      pin_policy={"historical": {"a0-connected-journey.yml": {"reason": "frozen Round 12 fixture"}}}),
                  "O6", BLOCKED, "BLOCKED_NO_CURRENT_WORKFLOW"))
    # historical pins are labelled, and a CURRENT workflow that agrees still passes
    root = fresh(); _mini_composition(root / "comp", consistent=False)
    _write(root / "comp/.github/workflows/a0-current-journey.yml",
           "env:\n  A1_SHA: " + good_pins["A1"] + "\n")
    cases.append(("O6 historical stale + current agreement → PASS, labelled",
                  Ctx(composition=root / "comp", pins=good_pins,
                      pin_policy={"historical": {"a0-connected-journey.yml": {"reason": "frozen Round 12 fixture"}}}),
                  "O6", PASS, "PROVENANCE_CURRENT"))

    failures = 0
    for label, ctx, key, expected, expected_code in cases:
        try:
            result = ORACLES[key][1](ctx)
        except Exception as error:  # a crash is a self-test failure, not a pass
            result = Result(key, "CRASH", "ORACLE_CRASHED", "A7", "evidence-integrity", repr(error))
        ok = result.verdict == expected and (expected_code is None or result.code == expected_code)
        failures += 0 if ok else 1
        if verbose or not ok:
            mark = "ok  " if ok else "FAIL"
            want = f"{expected}/{expected_code}" if expected_code else expected
            print(f"{mark} {label:<62} -> {result.verdict}/{result.code:<34} want {want}")
    print(f"\nself-test: {len(cases) - failures}/{len(cases)} oracle expectations met")
    return 0 if failures == 0 else 1


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="A7 fail-closed oracle pack")
    parser.add_argument("--composition", type=Path)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--pins", type=Path, help="JSON {owner: 40-hex sha}")
    parser.add_argument("--expected-tree", default="")
    parser.add_argument("--pin-policy", type=Path,
                        help="JSON with {\"historical\": {file: {reason: ...}}}; "
                             "anything not declared historical is treated as CURRENT")
    parser.add_argument("--resolutions", type=int, default=3)
    parser.add_argument("--only", nargs="*", default=[])
    parser.add_argument("--out", type=Path)
    parser.add_argument("--markdown", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    pins = _json(args.pins) if args.pins else {}
    policy = _json(args.pin_policy) if args.pin_policy else {}
    ctx = Ctx(composition=args.composition, evidence=args.evidence, pins=pins,
              expected_tree=args.expected_tree, require_resolutions=args.resolutions,
              pin_policy=policy)
    pack = run_pack(ctx, [key.upper() for key in args.only])
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(pack, indent=2) + "\n", encoding="utf-8")
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(render_markdown(pack) + "\n", encoding="utf-8")
    print(f"A7_ORACLE_PACK overall={pack['overall']}")
    for row in pack["results"]:
        print(f"  {row['oracle']} {row['verdict']:<7} {row['code']:<32} {row['owner']:<5} {row['title']}")
    return 0 if pack["overall"] == PASS else 1


if __name__ == "__main__":
    sys.exit(main())
