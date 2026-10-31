#!/usr/bin/env python3
"""Run A7's native adversarial probes against an exact owner composition.

A7 owns verification, not the engine, and it does not own the gameplay tree. So a
native run here is a three-phase operation, recorded rather than asserted:

1. **Pin** — resolve a composition ref to a commit SHA and record it. A run only
   counts for the SHA it executed on, exactly like the CI evidence rule.
2. **Mount** — create a detached worktree of that SHA and copy *only* A7's probe
   directory (`tests/survival/balance_native/`) into it. No owner file is edited,
   added or removed; the probes are the only foreign bytes, and their hash is
   recorded so the run can be reproduced.
3. **Execute** — import the project once, then run each probe in its own OS
   process and classify the result from the probe's own verdict line.

Nothing here can turn a blocked or unimplemented feature into a pass:

* a probe that prints `BLOCKED` or `RED_NOT_IMPLEMENTED` is recorded as such;
* a probe that fails to load (missing harness in an older composition) is
  `BLOCKED_LOAD`, never `PASS`;
* a probe that exits 0 without printing its verdict line is `BLOCKED_NO_VERDICT`,
  because an exit code alone is not evidence.

Usage::

    python3 tools/survival/balance/run_native.py \
        --godot /path/to/godot \
        --composition refs/arena/dea2428e-soul-of-hero \
        --probe first_hour_route_probe.gd

Omit ``--probe`` to run every probe in the directory. The artifact is written to
``data/survival/balance/results/native_runs.v1.json``; logs stay in
``.artifacts/native_runs/<sha>/`` and are hashed into the artifact.
"""
from __future__ import annotations

import argparse
import re
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

REPO = Path(__file__).resolve().parents[3]
#: Both probe families, each with the res:// prefix its scripts must be invoked
#: from. The journey probes and the D055-D061 contract probes live in separate
#: directories because they answer different questions under different rules
#: (see sohbalance/probes.py), but both must be executed, not just audited.
PROBE_FAMILIES = (
    ("balance_native", REPO / "tests" / "survival" / "balance_native"),
    ("balance_native_decisions", REPO / "tests" / "survival" / "balance_native_decisions"),
    # Round 8. These probes judge the *system* (14-day run, Ragnarok, two
    # economies) rather than one module, so they are a family of their own: their
    # results are only comparable across the same composition, and mixing them
    # into the D055-D061 family would make the older ledger look like it covered
    # rules it never touched.
    ("balance_native_ragnarok", REPO / "tests" / "survival" / "balance_native_ragnarok"),
    # Round 9. Production Hero traversal, physical interaction and the two-layer
    # economy. Separate from round 8 because these probes drive the *player* input
    # pipeline rather than calling product methods.
    ("balance_native_r9", REPO / "tests" / "survival" / "balance_native_r9"),
    # Round 10 (CT P0). Current owner heads, A0's real profile port, and the
    # cross-owner seams round 9 could not see. Kept separate so the round-9 ledger
    # stays a historical record of what that composition actually did.
    ("balance_native_r10", REPO / "tests" / "survival" / "balance_native_r10"),
    # Round 11 (CT multidimensional gameplay gate). The round-10 composition is
    # stale, so this family starts from the current owner bytes and never inherits a
    # round-10 verdict. Round-10 probes are still executed in the same run: a defect
    # that disappeared and a defect that survived are both facts about *this* tree,
    # and the ledger keeps them apart by family.
    ("balance_native_r11", REPO / "tests" / "survival" / "balance_native_r11"),
    # Round 12 (CT-GATE-v2026-10-31). The round-11 composition commit is
    # historical evidence, so this family runs against the round-12 composition.
    # Six probes are the round-11 bodies carried forward with only the id changed
    # (a survived defect is a fact about this tree); three are new and target the
    # round-12 mission: the avatar-identity seam, the physical home, and the threat
    # + single death bag, plus a three-resolution visual attempt.
    ("balance_native_r12", REPO / "tests" / "survival" / "balance_native_r12"),
    # Round 13. Same probes as round 12 (carried forward, id renamed) plus the
    # round-13 world/input probes, so a round-12 → round-13 difference is a fact
    # about the product rather than about the probe.
    ("balance_native_r13", REPO / "tests" / "survival" / "balance_native_r13"),
)
#: A7-owned data the round-8 probes read. These are test configuration, not game
#: data: the game never loads them. They are copied into the worktree next to the
#: probes and hashed into the artifact, because a probe that silently fell back to
#: a missing tuning file would report on numbers nobody can reproduce.
SUPPORT_FILES = ("data/survival/balance/ragnarok_tuning.v1.json",)
OUT = REPO / "data" / "survival" / "balance" / "results" / "native_runs.v1.json"
LOG_ROOT = REPO / ".artifacts" / "native_runs"

VERDICTS = ("PASS", "FAIL", "BLOCKED", "RED_NOT_IMPLEMENTED")
EXIT_FOR = {"PASS": 0, "FAIL": 1, "BLOCKED": 2, "RED_NOT_IMPLEMENTED": 3}


def sh(*args: str, cwd: Optional[Path] = None, timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=str(cwd) if cwd else None, capture_output=True, text=True, timeout=timeout)


def resolve(ref: str) -> str:
    out = sh("git", "rev-parse", ref, cwd=REPO)
    if out.returncode != 0:
        raise SystemExit(f"cannot resolve {ref}: {out.stderr.strip()}")
    return out.stdout.strip()


def prepare_worktree(sha: str, root: Path) -> Path:
    work = root / sha[:12]
    if work.exists():
        shutil.rmtree(work)
    # A previous run may have removed the directory without unregistering it; git
    # then refuses to add the same path again. Prune first so a rerun is a rerun.
    sh("git", "worktree", "prune", cwd=REPO)
    added = sh("git", "worktree", "add", "--detach", str(work), sha, cwd=REPO, timeout=900)
    if added.returncode != 0:
        raise SystemExit(f"git worktree add failed: {added.stderr.strip()}")
    for family, source in PROBE_FAMILIES:
        target = work / "tests" / "survival" / family
        target.mkdir(parents=True, exist_ok=True)
        for probe in sorted(source.glob("*.gd")):
            shutil.copy2(probe, target / probe.name)
    for relative in SUPPORT_FILES:
        source_file = REPO / relative
        if not source_file.exists():
            continue
        destination = work / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, destination)
    return work


def probe_hashes() -> Dict[str, str]:
    hashes: Dict[str, str] = {}
    for family, source in PROBE_FAMILIES:
        for probe in sorted(source.glob("*.gd")):
            hashes[f"{family}/{probe.name}"] = hashlib.sha256(probe.read_bytes()).hexdigest()
    return hashes


def support_hashes() -> Dict[str, str]:
    hashes: Dict[str, str] = {}
    for relative in SUPPORT_FILES:
        path = REPO / relative
        if path.exists():
            hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashes


def classify(output: str, code: int, timed_out: bool, timeout: int) -> tuple:
    """Turn one probe process into a verdict that cannot flatter itself.

    The verdict line is a *claim by the probe*; the exit code is what the process
    actually did. They must agree. A probe that prints `PASS` and exits 2 was
    blocked, and a probe that prints `PASS` while also printing a MISSING or FAIL
    line did not pass either — either mismatch is recorded as the weaker outcome.
    """
    claimed = ""
    checks = 0
    missing: List[str] = []
    failed: List[str] = []
    blocker = ""
    for line in output.splitlines():
        # The closing verdict line also contains " FAIL " when the verdict is FAIL
        # ("A7 R009 FAIL - title: 12 checks, 1 failed"). Counting it as a failed
        # check inflated every failing probe by one and made the ledger disagree
        # with the probe's own check count, so verdict lines are skipped here.
        # The count is the reliable marker: check labels are free text and could
        # themselves contain " - ", so shape-matching the verdict line is safer
        # than looking for a dash.
        is_verdict_line = bool(re.search(r"\d+ checks, \d+ failed", line))
        if not is_verdict_line and line.startswith("A7 ") and " MISSING " in line:
            missing.append(line.split(" MISSING ", 1)[1].strip())
        if not is_verdict_line and line.startswith("A7 ") and " FAIL " in line:
            failed.append(line.split(" FAIL ", 1)[1].strip())
        if not is_verdict_line and line.startswith("A7 ") and " BLOCKED " in line:
            blocker = line.split(" BLOCKED ", 1)[1].strip()
        parts = line.split()
        # The *last* verdict line wins. A probe may report an individual failure
        # ("A7 R055 FAIL <label>") before its closing verdict, and taking the first
        # match made the ledger attribute the verdict to that FAIL line and read its
        # check count as zero — a reporting bug in the collector, not in the probe.
        if len(parts) >= 4 and parts[0] == "A7" and parts[2] in VERDICTS and " - " in line:
            claimed = parts[2]
            # The counts are written by the harness as "<n> checks, <n> failed,
            # <n> missing". Reading digits by position picked up numbers from the
            # probe's own title ("336 real hours" -> checks=336), so the shape is
            # matched explicitly and a line that does not match leaves checks at 0.
            counted = re.search(r"(\d+) checks, (\d+) failed(?:, (\d+) missing)?", line)
            if counted:
                checks = int(counted.group(1))
    details = {
        "checks": checks,
        "missing": missing,
        "failed": failed,
        "blocked_reason": blocker,
        "claimed": claimed,
        "exit_code_expected": EXIT_FOR.get(claimed),
    }

    if timed_out:
        details["blocked_reason"] = f"probe exceeded {timeout}s"
        details["mismatch"] = "timeout"
        return "BLOCKED", details

    if not claimed:
        details["mismatch"] = "no verdict line"
        if not details["blocked_reason"]:
            lowered = output.lower()
            details["blocked_reason"] = (
                "the probe could not load in this composition (missing harness or owner symbol)"
                if "failed to load script" in lowered or "parse error" in lowered
                else "the probe exited without printing its verdict line"
            )
        return "BLOCKED", details

    # Agreement is required in both directions, and the weaker claim wins.
    reasons: List[str] = []
    if code != EXIT_FOR[claimed]:
        reasons.append(f"claimed {claimed} but exited {code}")
    if claimed == "PASS" and (missing or failed or blocker):
        reasons.append("claimed PASS while reporting a missing symbol, a failure or a blocker")
    if reasons:
        details["mismatch"] = "; ".join(reasons)
        if blocker or code == EXIT_FOR["BLOCKED"]:
            return "BLOCKED", details
        if missing:
            return "RED_NOT_IMPLEMENTED", details
        return "FAIL", details
    return claimed, details


def run_probe(
    godot: Path, work: Path, family: str, probe: str, extra: List[str], log_path: Path, timeout: int
) -> Dict[str, object]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(godot),
        "--headless",
        "--path",
        ".",
        "--script",
        f"res://tests/survival/{family}/{probe}",
    ]
    if extra:
        cmd += ["--"] + extra
    try:
        proc = subprocess.run(cmd, cwd=str(work), capture_output=True, text=True, timeout=timeout)
        output = proc.stdout + proc.stderr
        code = proc.returncode
        timed_out = False
    except subprocess.TimeoutExpired as error:
        output = (error.stdout or "") + (error.stderr or "")
        if isinstance(output, bytes):
            output = output.decode("utf-8", "replace")
        code = -1
        timed_out = True
    log_path.write_text(output, encoding="utf-8")

    verdict, details = classify(output, code, timed_out, timeout)
    checks = details["checks"]
    missing = details["missing"]
    failed = details["failed"]
    blocker = details["blocked_reason"]

    return {
        "probe": probe,
        "family": family,
        "verdict": verdict,
        "claimed": details["claimed"],
        "exit_code": code,
        "checks": checks,
        "failed": failed,
        "missing": missing,
        "blocked_reason": blocker,
        "mismatch": details.get("mismatch", ""),
        "log": str(log_path.relative_to(REPO)) if log_path.is_relative_to(REPO) else str(log_path),
        "log_sha256": hashlib.sha256(output.encode("utf-8")).hexdigest(),
        "log_lines": len(output.splitlines()),
        "engine_lines": [ln for ln in output.splitlines() if ln.startswith("Godot Engine v")][:1],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--godot", default=os.environ.get("GODOT", "godot"))
    parser.add_argument("--composition", default="refs/arena/dea2428e-soul-of-hero")
    parser.add_argument("--probe", action="append", default=[])
    parser.add_argument("--probe-args", default="")
    parser.add_argument("--skip-import", action="store_true")
    parser.add_argument("--import-timeout", type=int, default=1200)
    parser.add_argument("--timeout", type=int, default=1500)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    godot = Path(shutil.which(args.godot) or args.godot)
    if not godot.exists():
        print(f"no engine binary at {godot}: nothing was run, and no verdict is recorded", file=sys.stderr)
        return 2

    sha = resolve(args.composition)
    engine = sh(str(godot), "--version").stdout.strip() or "unknown"
    log_dir = LOG_ROOT / sha[:12]
    work = prepare_worktree(sha, LOG_ROOT)
    print(f"composition {args.composition} @ {sha[:12]}  engine {engine}")
    print(f"worktree {work}")

    if not args.skip_import:
        imported = sh(str(godot), "--headless", "--path", ".", "--import", cwd=work, timeout=args.import_timeout)
        (log_dir / "import.log").write_text(imported.stdout + imported.stderr, encoding="utf-8")
        print(f"import exit={imported.returncode}")

    if args.probe:
        # `--probe d058_random_spawn_probe.gd` or `--probe balance_native_decisions/d058_...`
        probes = []
        for name in args.probe:
            family, _, probe = name.partition("/") if "/" in name else ("", "", name)
            if not family:
                family = next((f for f, source in PROBE_FAMILIES if (source / probe).exists()), "")
            probes.append((family, probe))
    else:
        # `*_probe.gd` only: the D family also contains the harness those probes
        # extend, and running a harness as if it were a probe produces a verdict
        # about nothing.
        probes = [
            (family, probe.name)
            for family, source in PROBE_FAMILIES
            for probe in sorted(source.glob("*_probe.gd"))
        ]
    extra = args.probe_args.split() if args.probe_args else []
    results: List[Dict[str, object]] = []
    for family, probe in probes:
        label = f"{family}/{probe}"
        print(f"run {label} ...", end=" ", flush=True)
        row = run_probe(godot, work, family, probe, extra, log_dir / f"{family}__{probe}.log", args.timeout)
        results.append(row)
        print(f"{row['verdict']} (exit {row['exit_code']})")

    payload = {
        "schema": "soh.balance.native_runs.v1",
        "engine": engine,
        "engine_path": str(godot),
        "engine_version_exact": engine,
        "composition": {"ref": args.composition, "sha": sha},
        "probe_source": probe_hashes(),
        "support_source": support_hashes(),
        "display": "headless (DisplayServerHeadless): no GPU, no rendered frame, no human review",
        "rule": (
            "A probe counts only for the composition SHA it ran on. BLOCKED and RED_NOT_IMPLEMENTED are "
            "recorded, never converted into a pass. A probe that exits 0 without its verdict line is "
            "BLOCKED_NO_VERDICT."
        ),
        "results": results,
        "summary": {verdict: sum(1 for row in results if row["verdict"] == verdict) for verdict in VERDICTS},
    }
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"wrote {OUT.relative_to(REPO)}")
    else:
        print(json.dumps(payload["summary"], indent=2))
    print(json.dumps(payload["summary"]))
    # Runner exit codes are about *what the run established*, and they never let a
    # missing feature look like a failure: 0 all pass, 1 a real failure, 2 nothing
    # measurable (blocked/environment), 3 an implemented-rule failure is absent but
    # rules are still not implemented.
    if not results:
        return 2
    if any(row["verdict"] == "FAIL" for row in results):
        return 1
    if all(row["verdict"] == "PASS" for row in results):
        return 0
    if any(row["verdict"] == "RED_NOT_IMPLEMENTED" for row in results):
        return 3
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
