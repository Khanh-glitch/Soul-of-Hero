"""Four different things that used to be conflated as "unresolved POIs".

The A3 loot layer names::

    {"acquisition": "loot", "poi_id": "poi:roadside_cache", "region_id": "opening_marches"}

A1 names::

    poi_id   "poi_crown_waystation"   (instance, 108 of them)
    region   "r_ashen_crown"          (11 of them)

Those are not the same vocabulary, and one A3 string is not one missing POI.
This module separates, for every loot record, four independent identity layers:

    source class      what kind of thing can be opened ("roadside_cache")
    physical instance where a copy of that class stands (an A1 POI id)
    region            which authored region that instance belongs to
    POI id            the identifier scheme the owner actually published

The point is to stop filing one ticket per record. The actionable question is
"does a shared identifier contract exist, and how many *instances* would the
world have to author", not "which of 16 POIs is missing".
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence

CLASS_NAMESPACE = re.compile(r"^(?:poi|class|src):(?P<name>[a-z0-9_]+)$")
INSTANCE_PREFIX = re.compile(r"^poi_(?P<name>[a-z0-9_]+)$")


def classify_target(raw_id: Optional[str]) -> Dict[str, object]:
    """Split one A3 target string into namespace + bare name."""
    if not raw_id:
        return {"raw": None, "kind": "ABSENT", "name": None, "namespace": None}
    match = CLASS_NAMESPACE.match(raw_id)
    if match:
        return {
            "raw": raw_id,
            "kind": "CLASS_NAMESPACE",
            "name": match.group("name"),
            "namespace": raw_id.split(":", 1)[0],
        }
    match = INSTANCE_PREFIX.match(raw_id)
    if match:
        return {
            "raw": raw_id,
            "kind": "INSTANCE_PREFIX",
            "name": match.group("name"),
            "namespace": "poi_",
        }
    return {"raw": raw_id, "kind": "UNKNOWN_SCHEME", "name": raw_id, "namespace": None}


def _a1_names(model) -> tuple[set[str], set[str]]:
    poi_names = set()
    for poi_id in model.poi_index():
        poi_names.add(poi_id)
        poi_names.add(re.sub(r"^poi_", "", poi_id))
        poi_names.add(re.sub(r"^legacy_", "", poi_id))
    region_names = set(model.region_index())
    for region_id in model.region_index():
        region_names.add(re.sub(r"^r_", "", region_id))
    return poi_names, region_names


def loot_identity_map(model) -> Dict[str, object]:
    """Class / instance / region / scheme facts for every authored loot record."""
    records: List[Dict[str, object]] = []
    for source_id, source in sorted(model.sources.items()):
        if str(source.get("acquisition")) != "loot":
            continue
        target = classify_target(source.get("poi_id"))  # type: ignore[arg-type]
        records.append(
            {
                "source_id": source_id,
                "item_id": source.get("item_id"),
                "declared_poi_id": source.get("poi_id"),
                "declared_region_id": source.get("region_id"),
                "target_kind": target["kind"],
                "target_name": target["name"],
            }
        )

    poi_names, region_names = _a1_names(model)
    by_target: Dict[str, Dict[str, object]] = {}
    for row in records:
        key = str(row["declared_poi_id"])
        entry = by_target.setdefault(
            key,
            {
                "declared_poi_id": key,
                "target_kind": row["target_kind"],
                "target_name": row["target_name"],
                "record_count": 0,
                "source_ids": [],
                "resolves_to_a1_instance": bool(row["target_name"] in poi_names),
                "physical_instances_in_a1": 0,
                "regions": [],
            },
        )
        entry["record_count"] = int(entry["record_count"]) + 1  # type: ignore[arg-type]
        entry["source_ids"].append(row["source_id"])  # type: ignore[union-attr]
        region = row["declared_region_id"]
        if region not in entry["regions"]:  # type: ignore[operator]
            entry["regions"].append(region)  # type: ignore[union-attr]
        if row["target_name"] in poi_names:
            entry["physical_instances_in_a1"] = 1  # type: ignore[assignment]

    regions: List[Dict[str, object]] = []
    for region_id in sorted({str(row["declared_region_id"]) for row in records}):
        regions.append(
            {
                "declared_region_id": region_id,
                "resolves_to_a1_region": region_id in region_names,
                "a1_region_example": sorted(model.region_index())[0] if model.region_index() else None,
            }
        )

    class_ids = sorted({str(k) for k, v in by_target.items() if v["target_kind"] == "CLASS_NAMESPACE"})
    return {
        "records": records,
        "record_count": len(records),
        "distinct_targets": len(by_target),
        "targets": {key: by_target[key] for key in sorted(by_target)},
        "class_namespaced_targets": class_ids,
        "instance_namespaced_targets": sorted(
            key for key, value in by_target.items() if value["target_kind"] == "INSTANCE_PREFIX"
        ),
        "targets_resolving_to_a1_instance": sorted(
            key for key, value in by_target.items() if value["resolves_to_a1_instance"]
        ),
        "physical_container_instances_authored_by_a1": sum(
            int(value["physical_instances_in_a1"]) for value in by_target.values()
        ),
        "a1_container_class_vocabulary": _a1_container_vocabulary(model),
        "regions": regions,
        "regions_unresolved": [row["declared_region_id"] for row in regions if not row["resolves_to_a1_region"]],
        "finding": (
            "A3 loot records name class targets in a ':' namespace and regions in a bare vocabulary; "
            "A1 publishes 'poi_*' instance ids and 'r_*' regions. The gap is one missing shared identifier "
            f"contract plus the physical instances it would imply - not {len(records)} missing individual POIs."
        ),
    }


def _a1_container_vocabulary(model) -> List[str]:
    """Does A1 author *any* container/supply vocabulary at all?

    Derived by scanning A1's own world document for container-like keys rather
    than asserting from a review. Zero means the loot layer has no A1 counterpart.
    """
    needles = ("container", "supply", "cache", "loot", "crate", "chest")
    found: List[str] = []

    def walk(node, path: str) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                text = str(key)
                if any(needle in text.lower() for needle in needles):
                    found.append(f"{path}.{text}")
                walk(value, f"{path}.{text}")
        elif isinstance(node, list):
            for index, value in enumerate(node[:50]):
                walk(value, f"{path}[{index}]")

    world = model.world
    walk(world() if callable(world) else world, "world")
    return sorted(set(found))


def binding_adoption(model, contract: Dict[str, object]) -> Dict[str, object]:
    """Compare A1's authorized source bindings with A3's own source rows.

    This is the precise join the earlier "0 of 16" claim never made: A1's
    vertical-slice contract already says *which* A3 source pays *what* at *which*
    instance*, with a transaction key. The question is therefore not "does a POI
    exist" but "has A3 adopted the binding".
    """
    rows: List[Dict[str, object]] = []
    for binding in contract.get("bindings", []) or []:
        request = str(binding.get("binding_request") or "")
        # A1 uses two different binding kinds and they must not be judged alike:
        # a REBIND moves a provisional class id onto a physical instance, while a
        # live-source reuse keeps A3's region-scoped identity by design.
        rebind = request.startswith("REBIND_FROM_PROVISIONAL")
        reuse_live = request.startswith("A1_APPROACH_NODE_USES_EXISTING_LIVE_SOURCE")  # type: ignore[union-attr]
        source_id = str(binding.get("source_id"))
        source = model.sources.get(source_id, {})
        declared = source.get("poi_id")
        rows.append(
            {
                "source_id": source_id,
                "item_id": binding.get("item_id"),
                "a1_authorized_poi": binding.get("poi_id"),
                "a1_authorized_yield": binding.get("yield_per_claim"),
                "a1_renewable": binding.get("renewable"),
                "a1_cooldown_seconds": binding.get("cooldown_active_seconds"),
                "a3_declared_poi": declared,
                "a3_declared_acquisition": source.get("acquisition"),
                "a3_declared_yield": source.get("yield_per_claim"),
                "a3_status": source.get("integration_status"),
                "binding_kind": "REBIND_TO_INSTANCE" if rebind else ("LIVE_SOURCE_REUSE" if reuse_live else "UNKNOWN"),
                "adopted": (
                    str(declared) == str(binding.get("poi_id"))
                    if rebind
                    else (bool(source) and source.get("item_id") == binding.get("item_id"))
                ),
                "yield_agrees": source.get("yield_per_claim") in (None, binding.get("yield_per_claim")),
                "region_differs": bool(source.get("region_id")) and bool(binding.get("region_id")) and source.get("region_id") != binding.get("region_id"),
                "binding_request": request,
            }
        )
    adopted = [row for row in rows if row["adopted"]]
    pending = [row for row in rows if not row["adopted"]]
    rebind_rows = [row for row in rows if row["binding_kind"] == "REBIND_TO_INSTANCE"]
    rebind_adopted = [row for row in rebind_rows if row["adopted"]]
    return {
        "rows": rows,
        "authorized_bindings": len(rows),
        "adopted_by_a3": len(adopted),
        "rebind_required": len(rebind_rows),
        "rebind_adopted": len(rebind_adopted),
        "pending_rebind": [row for row in pending if row["binding_kind"] == "REBIND_TO_INSTANCE"],
        "pending_other": [row for row in pending if row["binding_kind"] != "REBIND_TO_INSTANCE"],
        "summary": (
            f"{len(adopted)}/{len(rows)} A1-authorized source bindings are adopted by A3 "
            f"({len(rebind_adopted)}/{len(rebind_rows)} instance rebinds, "
            f"{len(rows) - len(rebind_rows)} live-source reuse)."
        ),
    }
