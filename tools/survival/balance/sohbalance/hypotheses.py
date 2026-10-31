"""Loader for the labelled hypothesis file.

The hypothesis file lives in ``data/survival/balance/`` and is the only place
this tool is allowed to invent a number. Each block must carry a label so the
report can print what a value rests on.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .provenance import DEFAULT_DATA_DIR

HYPOTHESES_PATH = DEFAULT_DATA_DIR / "hypotheses.v1.json"
REQUIRED_KEYS = ("session", "time_model", "route_beliefs", "patterns", "core_probability")


def load_hypotheses(path: Path = HYPOTHESES_PATH) -> Dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema") != "soh.balance.hypotheses.v1":
        raise ValueError(f"unexpected hypotheses schema: {payload.get('schema')}")
    missing = [key for key in REQUIRED_KEYS if key not in payload]
    if missing:
        raise KeyError(f"hypotheses file missing blocks: {missing}")
    for pattern in payload["patterns"]:
        for key in ("pattern_id", "label", "status", "capabilities", "stops", "claims"):
            if key not in pattern:
                raise KeyError(f"pattern {pattern.get('pattern_id')!r} missing {key!r}")
    return payload


def patterns(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    return list(payload["patterns"])
