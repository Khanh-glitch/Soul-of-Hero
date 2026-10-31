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


def oracle_bootstrap(ctx: Ctx) -> Result:
    """O1 — `PLAYER_INPUT_*` before app init must never be scored as A1's fault."""
    text = _evidence_text(ctx)
    before = _BEFORE.search(text)
    after = _AFTER.search(text)
    result = _RESULT.search(text)
    if before is None and after is None:
        return Result(
            "O1", BLOCKED, "BLOCKED_NO_BOOTSTRAP_EVIDENCE", "A7", "evidence-integrity",
            "no before/after input-bootstrap pair in the evidence",
            "A reader refusal is unattributable without a bootstrapped control run: "
            "`a1_runtime_compatibility.gd` gates on `InputMap.has_action`, which only "
            "exists after the game's `InputBootstrap` autoload has entered the tree.",
        )
    before_ok, before_reason = _truth(before.group(1)), before.group(2)
    after_ok = _truth(after.group(1)) if after else None
    after_reason = after.group(2) if after else ""
    evidence = [
        f"direct run: reader_ok={before_ok} reason={before_reason or '(none)'}",
        f"bootstrapped run: reader_ok={after_ok} reason={after_reason or '(none)'}",
    ]
    if result:
        evidence.append(f"runner verdict: {result.group(1).strip()[:160]}")

    measurements = {"before_ok": before_ok, "after_ok": after_ok,
                    "before_reason": before_reason, "after_reason": after_reason}

    if before_ok and (after_ok in (True, None)):
        return Result("O1", PASS, "NO_INPUT_BLOCKER", "A1", "source-contract",
                      "the reader configures without waiting for the application bootstrap",
                      "", evidence, measurements)
    if before_reason.startswith("PLAYER_INPUT_"):
        if after_ok is True:
            return Result(
                "O1", FAIL, "TEST_BOOTSTRAP_FALSE_NEGATIVE", "A7", "test-only",
                "a direct-scene-tree run reported a player-input refusal that the "
                "bootstrapped application run does not reproduce",
                f"The direct run failed with `{before_reason}` and the bootstrapped run "
                "succeeded. That is a harness ordering defect, so it is neither an A1 "
                "source failure nor a player PASS. Exercise the reader after the "
                "application has initialised, or the run proves nothing.",
                evidence, measurements)
        if after_ok is False:
            return Result(
                "O1", FAIL, "A1_SOURCE_CONTRACT", "A1", "source-contract",
                "the reader still refuses after a real application bootstrap",
                f"Bootstrapped run failed with `{after_reason or before_reason}`; this is "
                "an A1 contract failure and must be fixed in A1's reader/connector, not "
                "worked around by the caller.",
                evidence, measurements)
        return Result(
            "O1", BLOCKED, "BLOCKED_NO_BOOTSTRAPPED_RUN", "A7", "evidence-integrity",
            "a pre-bootstrap refusal was recorded with no bootstrapped control",
            "Run the same reader after `InputBootstrap` has entered the tree before "
            "attributing anything to A1.",
            evidence, measurements)
    return Result(
        "O1", FAIL, "A1_SOURCE_CONTRACT", "A1", "source-contract",
        "the reader refuses for a non-input reason",
        f"Reason `{before_reason}` is an A1 contract failure; no bootstrap control can "
        "excuse it.",
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
_SETTLE_BAD = ("nothing_to_settle", "no_job", "nothing_pending", "already_pending")


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


def oracle_paid_2pid(ctx: Ctx) -> Result:
    """O4 — the only accepted offline payoff is a committed, exactly-once receipt."""
    if ctx.evidence is None or not ctx.evidence.exists():
        return Result("O4", BLOCKED, "BLOCKED_NO_JOURNEY_EVIDENCE", "A7", "evidence-integrity",
                      "no evidence directory")
    logs = {p.name: p for p in _evidence_files(ctx, (".txt", ".log"))}
    p1 = logs.get("process1.txt")
    p2 = logs.get("process2.txt")
    t1 = _read(p1) if p1 else ""
    t2 = _read(p2) if p2 else ""
    both = t1 + "\n" + t2
    exit1 = _exit_code(p1) if p1 else None
    exit2 = _exit_code(p2) if p2 else None

    prefix = re.search(r"prefix_complete=(true|false)", both, re.I)
    freed = re.search(r"previously freed", both, re.I)
    departure = _settle_json(t1, "A0_CONNECTED_DEPARTURE")
    settle = _settle_json(t2 or t1, "A0_CONNECTED_OFFLINE_SETTLE")
    resettle = _settle_json(t2 or t1, "A0_CONNECTED_RESETTLE")
    receipt = settle or {}
    reason = str(receipt.get("reason", ""))
    evidence = [
        f"process1 exit={exit1} file={p1.name if p1 else '(absent)'}",
        f"process2 exit={exit2} file={p2.name if p2 else '(absent)'}",
        f"prefix_complete={prefix.group(1) if prefix else '(absent)'}",
        f"departure={departure}",
        f"offline settlement={settle}",
        f"re-settlement={resettle}",
        f"first 'previously freed' line: {freed.group(0) if freed else '(none)'}",
    ]
    m = {"exit1": exit1, "exit2": exit2,
         "prefix_complete": _truth(prefix.group(1)) if prefix else None,
         "settle_reason": reason, "resettle": resettle}

    def fail(code: str, title: str, detail: str, owner: str = "A0", kind: str = "real-gameplay") -> Result:
        return Result("O4", FAIL, code, owner, kind, title, detail, evidence, m)

    if p1 is None:
        return Result("O4", BLOCKED, "BLOCKED_NO_FIRST_PROCESS", "A7", "evidence-integrity",
                      "no process1 log in the evidence", "", evidence, m)
    if prefix is None:
        return fail("NO_PREFIX_MARKER", "the run never printed its own prefix verdict",
                    "Without `A0_CONNECTED prefix_complete=` a green exit code is unreadable.", "A7", "test-only")
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
                    f"departure={departure}")
    if settle is None:
        return fail("NO_SETTLEMENT_RECEIPT", "the second process printed no offline settlement",
                    "A skipped or crashed second process leaves no receipt.")
    if reason in _SETTLE_BAD or not receipt.get("ok", False):
        return fail("NOTHING_TO_SETTLE", "the second process had nothing to settle",
                    f"reason=`{reason}`: no funded job survived the first process, so no "
                    "offline payoff was paid.")
    if any(code not in (0, None) for code in (exit1, exit2)):
        return fail("PROCESS_FAILED", "a process exited non-zero",
                    f"exit codes process1={exit1} process2={exit2}")
    if exit1 != 0 or exit2 != 0:
        return fail("PROCESS_FAILED", "a process exit code is missing",
                    f"exit codes process1={exit1} process2={exit2}")
    if not resettle:
        return fail("NO_DUPLICATE_CONTROL", "no second claim was attempted",
                    "Proving 'exactly once' needs a duplicate attempt that is refused.")
    if bool(resettle.get("duplicate", False)) is False and bool(resettle.get("paid", False)):
        return fail("DOUBLE_SETTLEMENT", "the second claim paid again",
                    f"resettle={resettle}")
    return Result("O4", PASS, "PAID_2PID_RECEIPT", "A0", "real-gameplay",
                  "a funded job survived one process and settled exactly once in a second",
                  f"settle reason=`{reason}`, duplicate control refused", evidence, m)


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
    return Result("O5", PASS, "FRAMES_HAVE_CONTENT", "A7", "visual-product",
                  "every frame has real content at a reviewable resolution", "",
                  evidence, {"frames": rows, "resolutions": resolutions})


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


def oracle_provenance(ctx: Ctx) -> Result:
    """O6 — stale pins and foreign compositions never qualify as current evidence."""
    evidence: List[str] = []
    failures: List[str] = []
    details: Dict[str, object] = {}

    stale: List[dict] = []
    workflows = []
    if ctx.composition is not None:
        workflows = sorted((ctx.composition / ".github/workflows").glob("*.yml"))
        workflows += sorted((ctx.composition / ".github/workflows").glob("*.yaml"))
    for workflow in workflows:
        for match in _PIN.finditer(_read(workflow)):
            owner, sha = match.group(1), match.group(2)
            expected = ctx.pins.get(owner)
            if expected and not sha.startswith(expected[:12]) and not expected.startswith(sha[:12]):
                stale.append({"file": workflow.name, "owner": owner, "pinned": sha[:12],
                              "expected": expected[:12]})
    details["stale_pins"] = stale
    if stale:
        by_owner: Dict[str, List[str]] = {}
        for item in stale:
            by_owner.setdefault(item["owner"], []).append(item["file"])
        failures.append(
            f"{len(stale)} stale pin(s) in {len({s['file'] for s in stale})} workflow(s): "
            + "; ".join(f"{owner} in {', '.join(sorted(set(files)))}"
                        for owner, files in sorted(by_owner.items())))
        evidence.append("stale pins: " + json.dumps(stale))

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
        if not actual.startswith(ctx.expected_tree[:12]):
            failures.append(f"composition identity mismatch: expected {ctx.expected_tree[:12]}, "
                            f"recomputed {actual[:12]}")

    stamps = set()
    text = _evidence_text(ctx)
    for match in re.finditer(r"composition[^0-9a-f]{0,8}([0-9a-f]{12,40})", text, re.I):
        stamps.add(match.group(1))
    details["evidence_composition_stamps"] = sorted(stamps)
    if stamps and ctx.expected_tree and not any(
            stamp.startswith(ctx.expected_tree[:12]) or ctx.expected_tree.startswith(stamp[:12])
            for stamp in stamps):
        failures.append("evidence is stamped with a different composition: "
                        + ", ".join(sorted(stamps))[:200])
    if stamps:
        evidence.append("evidence composition stamps: " + ", ".join(sorted(stamps)))

    if failures:
        code = "STALE_PIN" if stale else ("STALE_COMPOSITION" if "composition" in " ".join(failures) else "PROVENANCE_MISMATCH")
        owner = "A0" if stale else "A7"
        return Result("O6", FAIL, code, owner, "evidence-integrity",
                      "current-product provenance cannot be established",
                      "; ".join(failures), evidence, details)
    if not workflows and not stamps and not tree_measure:
        return Result("O6", BLOCKED, "BLOCKED_NO_PROVENANCE_INPUT", "A7", "evidence-integrity",
                      "nothing to check provenance against")
    return Result("O6", PASS, "PROVENANCE_CURRENT", "A7", "evidence-integrity",
                  "pins, workflows and composition identity agree", "", evidence, details)


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
    def fresh() -> Path:
        return Path(tempfile.mkdtemp(prefix="a7-oracle-"))

    good_pins = {"A1": "a030cb89a5033ba5faba39995762b4bea1332cec"}
    cases: List[Tuple[str, object, str, str]] = []

    # O1
    root = fresh(); _write(root / "ev/process1.txt",
                            "CT_BOOTSTRAP_BEFORE action_registered=false reader_ok=false reason=PLAYER_INPUT_MOVE_LEFT\n"
                            "CT_BOOTSTRAP_AFTER registered=true events=4\n"
                            "CT_BOOTSTRAP_READER_AFTER ok=true reason=\n"
                            "CT_BOOTSTRAP_RESULT PASS_DIRECT_SCRIPT_FALSE_BLOCKER\n")
    cases.append(("O1 negative (harness false blocker)", Ctx(evidence=root / "ev"), "O1", FAIL))
    root = fresh(); _write(root / "ev/process1.txt",
                            "CT_BOOTSTRAP_BEFORE action_registered=true reader_ok=true reason=\n"
                            "CT_BOOTSTRAP_READER_AFTER ok=true reason=\n")
    cases.append(("O1 positive", Ctx(evidence=root / "ev"), "O1", PASS))
    root = fresh(); _write(root / "ev/process1.txt",
                            "CT_BOOTSTRAP_BEFORE action_registered=false reader_ok=false reason=PLAYER_INPUT_MOVE_LEFT\n"
                            "CT_BOOTSTRAP_READER_AFTER ok=false reason=PLAYER_INPUT_MOVE_LEFT_UNBOUND\n")
    cases.append(("O1 negative (real A1 failure)", Ctx(evidence=root / "ev"), "O1", FAIL))

    # O2
    root = fresh(); _mini_composition(root / "comp", consistent=False)
    cases.append(("O2 negative (sidecar world)", Ctx(composition=root / "comp"), "O2", FAIL))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    _write(root / "ev/run.txt", "A7_O2 same_source=true authority=authored\n")
    cases.append(("O2 positive", Ctx(composition=root / "comp", evidence=root / "ev"), "O2", PASS))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    cases.append(("O2 blocked (no runtime evidence)", Ctx(composition=root / "comp"), "O2", BLOCKED))

    # O3
    root = fresh()
    _write(root / "ev/poi.txt",
           "".join(f"  ok    assertion {i}\n" for i in range(31))
           + "A0_POI_MOUNT_PHYSICAL_NOT_TESTED no A8 site is reachable in A1's 384x256 runtime world\n")
    cases.append(("O3 negative (31 PASS, PHYSICAL_NOT_TESTED)", Ctx(evidence=root / "ev"), "O3", FAIL))
    root = fresh()
    _write(root / "ev/poi.txt",
           "A7_O3 site=poi_crown_south_quarry entry=true exit=true return=true\n"
           "A7_O3 site=poi_crown_south_orchard entry=true exit=true return=true\n")
    cases.append(("O3 positive (two physical sites)", Ctx(evidence=root / "ev"), "O3", PASS))

    # O4
    root = fresh()
    _write(root / "ev/process1.txt",
           "A0_CONNECTED prefix_complete=false checks=29 failures=1\n"
           "SCRIPT ERROR: Invalid type in function '_owning_scroll' ... (previously freed)\n")
    _write(root / "ev/process1.txt.exit", "1\n")
    cases.append(("O4 negative (prefix false, freed row)", Ctx(evidence=root / "ev"), "O4", FAIL))
    root = fresh()
    _write(root / "ev/process1.txt",
           "A0_CONNECTED prefix_complete=true checks=60 failures=0\n"
           'A0_CONNECTED_DEPARTURE {"ok": true}\n')
    _write(root / "ev/process1.txt.exit", "0\n")
    _write(root / "ev/process2.txt",
           'A0_CONNECTED_OFFLINE_SETTLE {"ok": true, "reason": "nothing_to_settle"}\n')
    _write(root / "ev/process2.txt.exit", "0\n")
    cases.append(("O4 negative (green exits, nothing to settle)", Ctx(evidence=root / "ev"), "O4", FAIL))
    root = fresh()
    _write(root / "ev/process1.txt",
           "A0_CONNECTED prefix_complete=true checks=60 failures=0\n"
           'A0_CONNECTED_DEPARTURE {"ok": true, "run_id": "run-1"}\n')
    _write(root / "ev/process1.txt.exit", "0\n")
    _write(root / "ev/process2.txt",
           'A0_CONNECTED_OFFLINE_SETTLE {"ok": true, "reason": "settled", "amount": 1}\n'
           'A0_CONNECTED_RESETTLE {"ok": true, "duplicate": true, "paid": false}\n')
    _write(root / "ev/process2.txt.exit", "0\n")
    cases.append(("O4 positive (funded, exactly once)", Ctx(evidence=root / "ev"), "O4", PASS))

    # O5
    root = fresh(); _png(root / "ev/black.png", "black")
    _png(root / "ev/b.png", "noise"); _png(root / "ev/c.png", "noise")
    cases.append(("O5 negative (black frame among real ones)", Ctx(evidence=root / "ev"), "O5", FAIL))
    root = fresh()
    for name, size in (("720", (1280, 720)), ("1440", (2560, 1440)), ("2160", (3840, 2160))):
        _png(root / f"ev/{name}.png", "noise", size)
    cases.append(("O5 positive (three resolutions, content)", Ctx(evidence=root / "ev"), "O5", PASS))
    root = fresh()
    for name in ("720", "1440", "2160"):
        _png(root / f"ev/{name}.png", "noise")
    cases.append(("O5 negative (three frames, one resolution)",
                  Ctx(evidence=root / "ev"), "O5", FAIL))

    # O6
    root = fresh(); _mini_composition(root / "comp", consistent=False)  # stale A1 pin
    cases.append(("O6 negative (stale workflow pin)", Ctx(composition=root / "comp", pins=good_pins), "O6", FAIL))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    tree, _ = composition_tree(root / "comp")
    cases.append(("O6 positive (pins and tree agree)",
                  Ctx(composition=root / "comp", pins=good_pins, expected_tree=tree), "O6", PASS))
    root = fresh(); _mini_composition(root / "comp", consistent=True)
    cases.append(("O6 negative (composition identity mismatch)",
                  Ctx(composition=root / "comp", pins=good_pins, expected_tree="0" * 40), "O6", FAIL))

    failures = 0
    for label, ctx, key, expected in cases:
        result = ORACLES[key][1](ctx)
        ok = result.verdict == expected
        failures += 0 if ok else 1
        if verbose or not ok:
            print(f"{'ok  ' if ok else 'FAIL'} {label:<48} -> {result.verdict:<7} {result.code}")
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
    parser.add_argument("--resolutions", type=int, default=3)
    parser.add_argument("--only", nargs="*", default=[])
    parser.add_argument("--out", type=Path)
    parser.add_argument("--markdown", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    pins = _json(args.pins) if args.pins else {}
    ctx = Ctx(composition=args.composition, evidence=args.evidence, pins=pins,
              expected_tree=args.expected_tree, require_resolutions=args.resolutions)
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
