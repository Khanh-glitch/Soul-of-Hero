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
)
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
    return work


def probe_hashes() -> Dict[str, str]:
    hashes: Dict[str, str] = {}
    for family, source in PROBE_FAMILIES:
        for probe in sorted(source.glob("*.gd")):
            hashes[f"{family}/{probe.name}"] = hashlib.sha256(probe.read_bytes()).hexdigest()
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
        if line.startswith("A7 ") and " MISSING " in line:
            missing.append(line.split(" MISSING ", 1)[1].strip())
        if line.startswith("A7 ") and " FAIL " in line:
            failed.append(line.split(" FAIL ", 1)[1].strip())
        if line.startswith("A7 ") and " BLOCKED " in line:
            blocker = line.split(" BLOCKED ", 1)[1].strip()
        parts = line.split()
        if len(parts) >= 4 and parts[0] == "A7" and parts[2] in VERDICTS:
            if not claimed:
                claimed = parts[2]
                for token in parts:
                    if token.isdigit() and checks == 0:
                        checks = int(token)
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
