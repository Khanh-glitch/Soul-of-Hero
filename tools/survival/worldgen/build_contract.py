"""SURV-050A build/overlay contract shared by the Python oracle and Godot reader.

This module is read-only. It never places structures, edits SaveService, or
replaces A0's paid-construction validator. The legacy inset intentionally keeps
the historical ``build=0`` hint; ``build_permission=2`` is the authoritative
signal that the cell must be delegated to A0 instead of being denied.
"""
from __future__ import annotations

from typing import Callable

REQUIRED_LAYERS = (
    "region", "biome", "surface", "walk", "build", "build_permission",
    "hazard", "road", "preserved", "elevation_band",
)
BINARY_LAYERS = {"walk", "build", "road", "preserved"}
MUTABLE_OVERLAY_LAYERS = {"walk", "road"}
IMMUTABLE_LAYERS = tuple(k for k in REQUIRED_LAYERS if k not in MUTABLE_OVERLAY_LAYERS)

BUILD_PERMISSION = {
    0: "deny_a1_candidate",
    1: "a1_candidate_requires_a0_validation",
    2: "delegate_to_a0_validate_cell",
}

LAYER_SEMANTICS = {
    "build": {
        "role": "historical_hint_not_final_authority",
        "values": {"0": "not_an_a1_candidate_or_legacy_non_authoritative", "1": "a1_candidate_hint"},
        "legacy_inset": "build=0 is preserved verbatim and MUST NOT be interpreted as construction forbidden",
    },
    "build_permission": {
        "role": "machine_readable_build_authority",
        "values": BUILD_PERMISSION,
        "legacy_inset_value": 2,
        "missing_delegate": "error_legacy_build_delegate_required_not_deny",
        "final_authority": "A0 SurvivalBuildSystem.validate_cell plus live occupancy/physics",
    },
    "preserved": {"1": "legacy_inset_static_hint_only_build_and_dynamic_collision_delegate_to_a0"},
    "overlay_precedence": [
        "static_chunk_layers",
        "authored_world_repair_overlay_walk_road_only",
        "legacy_dynamic_child_and_a0_occupancy_final_veto",
    ],
    "mutable_overlay_layers": sorted(MUTABLE_OVERLAY_LAYERS),
    "immutable_layers": list(IMMUTABLE_LAYERS),
    "overlay_rules": [
        "overlay may target walk or road only",
        "overlay must not target preserved legacy cells",
        "overlay must declare source_id, revision, cell, layer, value, expected_base",
        "expected_base must match the currently resolved static/overlay value",
        "overlays cannot grant capabilities, change hazards, or authorize construction",
        "dynamic child collision and A0 occupancy always win over static/overlay hints",
    ],
}


def resolve_build(permission: int, delegate: Callable | None = None,
                  dynamic_child_blocked: bool = False) -> dict:
    """Resolve a build *preview* without mutating anything.

    ``delegate`` models A0 ``validate_cell``: return ``{"ok": bool, "reason": str}``.
    A legacy cell with no delegate is an error, not a silent denial. A new-land
    candidate without a delegate remains ``candidate_not_validated``; it is never
    reported as a paid placement.
    """
    if permission not in BUILD_PERMISSION:
        return {"ok": False, "decision": "error", "reason": "unknown_build_permission"}
    if permission == 2:
        if delegate is None:
            return {"ok": False, "decision": "error", "reason": "legacy_build_delegate_required",
                    "authority": "a0"}
        result = delegate()
        if not isinstance(result, dict) or "ok" not in result:
            return {"ok": False, "decision": "error", "reason": "invalid_a0_delegate_result",
                    "authority": "a0"}
        if not result["ok"]:
            return {"ok": False, "decision": "deny", "reason": str(result.get("reason", "a0_rejected")),
                    "authority": "a0"}
        if dynamic_child_blocked:
            return {"ok": False, "decision": "deny", "reason": "dynamic_child_occupancy",
                    "authority": "a0+dynamic_child"}
        return {"ok": True, "decision": "allow", "reason": "", "authority": "a0"}
    if permission == 0:
        return {"ok": False, "decision": "deny", "reason": "a1_no_build_candidate", "authority": "a1"}
    if dynamic_child_blocked:
        return {"ok": False, "decision": "deny", "reason": "dynamic_child_occupancy",
                "authority": "dynamic_child"}
    if delegate is None:
        return {"ok": False, "decision": "candidate_not_validated", "reason": "a0_validation_required",
                "authority": "a1_candidate"}
    result = delegate()
    if not isinstance(result, dict) or "ok" not in result:
        return {"ok": False, "decision": "error", "reason": "invalid_a0_delegate_result", "authority": "a0"}
    if not result["ok"]:
        return {"ok": False, "decision": "deny", "reason": str(result.get("reason", "a0_rejected")),
                "authority": "a0"}
    return {"ok": True, "decision": "allow", "reason": "", "authority": "a0"}


def apply_overlay(resolved: dict, overlay: dict, preserved: int) -> dict:
    """Apply one walk/road overlay to a copy of resolved layer values.

    Returns ``{"ok": bool, "values": dict, "provenance": dict, "reason": str}``.
    The caller supplies the current resolved values so stale overlays fail closed.
    """
    values = dict(resolved)
    layer = overlay.get("layer")
    if layer not in MUTABLE_OVERLAY_LAYERS:
        return {"ok": False, "values": values, "reason": "immutable_overlay_layer"}
    if preserved:
        return {"ok": False, "values": values, "reason": "legacy_overlay_forbidden"}
    if layer not in values:
        return {"ok": False, "values": values, "reason": "missing_base_layer"}
    value = overlay.get("value")
    if value not in (0, 1):
        return {"ok": False, "values": values, "reason": "invalid_overlay_value"}
    if "expected_base" not in overlay or overlay["expected_base"] != values[layer]:
        return {"ok": False, "values": values, "reason": "stale_overlay_base"}
    for key in ("source_id", "revision", "cell"):
        if key not in overlay:
            return {"ok": False, "values": values, "reason": f"missing_overlay_{key}"}
    values[layer] = value
    return {"ok": True, "values": values, "reason": "", "source_id": overlay["source_id"],
            "revision": overlay["revision"]}
