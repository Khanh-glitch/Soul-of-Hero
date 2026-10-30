"""Shared fixtures for the A7 balance tests (stdlib unittest only)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
TOOL_DIR = REPO_ROOT / "tools" / "survival" / "balance"
DATA_DIR = REPO_ROOT / "data" / "survival" / "balance"
RESULTS_DIR = DATA_DIR / "results"

if str(TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(TOOL_DIR))

from sohbalance.geo import RouteNetwork  # noqa: E402
from sohbalance.hypotheses import load_hypotheses  # noqa: E402
from sohbalance.loot import tables_from_model  # noqa: E402
from sohbalance.model import Model  # noqa: E402
from sohbalance.routes import ClaimEngine, PatternSpec, run_pattern  # noqa: E402

_CACHE = {}


def model() -> Model:
    if "model" not in _CACHE:
        _CACHE["model"] = Model.load(DATA_DIR)
    return _CACHE["model"]


def oracle_payload():
    """The committed oracle verdicts, rebuilt from the same bytes report.py uses."""
    if "oracle" not in _CACHE:
        from sohbalance import oracle as oracle_module
        from sohbalance import product

        texts, _manifest = product.load_snapshot(REPO_ROOT)
        a3 = {}
        for name in ("sources.json", "world_source_bindings.v3.json"):
            path = DATA_DIR / "snapshot" / f"a3.{name}"
            if path.exists():
                a3[f"a3.{name}"] = path.read_text(encoding="utf-8")
        _CACHE["oracle"] = oracle_module.audit(
            texts, a3, model(), json.loads(texts.get("a0.survival_catalog.json", "{}") or "{}")
        )
    return _CACHE["oracle"]


def network() -> RouteNetwork:
    if "network" not in _CACHE:
        _CACHE["network"] = RouteNetwork(model().graph_doc)
    return _CACHE["network"]


def hypotheses():
    return load_hypotheses(DATA_DIR / "hypotheses.v1.json")


def tables():
    return tables_from_model(model())


def pattern(pattern_id: str) -> PatternSpec:
    for payload in hypotheses()["patterns"]:
        if payload["pattern_id"] == pattern_id:
            return PatternSpec.from_json(payload)
    raise KeyError(pattern_id)


def run_pattern_by_id(pattern_id: str, session_seconds: float = 2700.0):
    engine = ClaimEngine(model())
    engine.start_session()
    return run_pattern(
        model(),
        network(),
        pattern(pattern_id),
        tables(),
        engine,
        session_budget_seconds=session_seconds,
    )
