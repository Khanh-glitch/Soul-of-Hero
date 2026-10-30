"""Typed, read-only view over the pinned A1/A3 snapshots.

Design rules
------------
* The model never mutates a snapshot. ``Model.docs`` is only ever deep-copied by
  fault-injection callers in :mod:`sohbalance.adversarial`.
* Unknown-but-present data is preferred over silent defaults. If a field is
  missing the model raises, so a schema change cannot quietly change numbers.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from .provenance import DEFAULT_DATA_DIR, Snapshot, snapshots_from_manifest, load_manifest

SNAPSHOT_KEYS = [
    "a1.world_plan",
    "a1.poi_route_graph",
    "a1.material_source_contracts",
    "a1.pacing_analysis",
    "a1.novice_bootstrap_contract",
    "a1.a1_a3_material_decisions",
    "a1.waystation_spec",
    "a1.relay_spec",
    "a3.loot_tables",
    "a3.items",
    "a3.sources",
    "a3.recipes",
    "a3.research",
    "a3.stations",
    "a3.progression_model",
    "a3.a1_source_adoption_v2",
]


def load_docs(data_dir: Path = DEFAULT_DATA_DIR) -> Dict[str, Any]:
    """Load every pinned snapshot into one dict keyed by snapshot key."""
    manifest = load_manifest(data_dir)
    docs: Dict[str, Any] = {}
    for snap in snapshots_from_manifest(manifest):
        if snap.key not in SNAPSHOT_KEYS:
            continue
        docs[snap.key] = snap.load()
    missing = [key for key in SNAPSHOT_KEYS if key not in docs]
    if missing:
        raise KeyError(f"pinned snapshots missing from manifest: {missing}")
    return docs


@dataclass
class Model:
    docs: Dict[str, Any]

    # ---------------------------------------------------------------- A1 world
    @property
    def world(self) -> Dict[str, Any]:
        return self.docs["a1.world_plan"]

    @property
    def graph_doc(self) -> Dict[str, Any]:
        return self.docs["a1.poi_route_graph"]

    @property
    def route_graph(self) -> Dict[str, Any]:
        return self.graph_doc["route_graph"]

    @property
    def pois(self) -> List[Dict[str, Any]]:
        return self.world["pois"]

    @property
    def regions(self) -> List[Dict[str, Any]]:
        return self.world["regions"]

    @property
    def resource_sites(self) -> List[Dict[str, Any]]:
        return self.world["resource_sites"]

    @property
    def resource_nodes(self) -> List[Dict[str, Any]]:
        return self.world["resource_nodes"]

    @property
    def world_capabilities(self) -> List[str]:
        return sorted(self.world["capabilities"])

    @property
    def hazards(self) -> List[Dict[str, Any]]:
        return self.world["hazards"]

    @property
    def material_keys(self) -> Dict[str, Any]:
        return self.world["materials"]

    @property
    def pacing(self) -> Dict[str, Any]:
        return self.docs["a1.pacing_analysis"]

    @property
    def bootstrap(self) -> Dict[str, Any]:
        return self.docs["a1.novice_bootstrap_contract"]

    @property
    def material_decisions(self) -> Dict[str, Any]:
        return self.docs["a1.a1_a3_material_decisions"]

    @property
    def waystation_spec(self) -> Dict[str, Any]:
        return self.docs["a1.waystation_spec"]

    @property
    def relay_spec(self) -> Dict[str, Any]:
        return self.docs["a1.relay_spec"]

    # ---------------------------------------------------------------- A3 data
    @property
    def loot_tables(self) -> Dict[str, Any]:
        return self.docs["a3.loot_tables"]["tables"]

    @property
    def items(self) -> Dict[str, Any]:
        return self.docs["a3.items"]["items"]

    @property
    def sources(self) -> Dict[str, Any]:
        return self.docs["a3.sources"]["sources"]

    @property
    def recipes(self) -> Dict[str, Any]:
        return self.docs["a3.recipes"]["recipes"]

    @property
    def technologies(self) -> Dict[str, Any]:
        return self.docs["a3.research"]["technologies"]

    @property
    def stations(self) -> Dict[str, Any]:
        return self.docs["a3.stations"]["stations"]

    @property
    def progression(self) -> Dict[str, Any]:
        return self.docs["a3.progression_model"]

    @property
    def adoption(self) -> Dict[str, Any]:
        return self.docs["a3.a1_source_adoption_v2"]

    # -------------------------------------------------------------  indexes
    def poi_index(self) -> Dict[str, Dict[str, Any]]:
        return {poi["poi_id"]: poi for poi in self.pois}

    def region_index(self) -> Dict[str, Dict[str, Any]]:
        return {region["region_id"]: region for region in self.regions}

    def node_index(self) -> Dict[str, Dict[str, Any]]:
        return {node["node_id"]: node for node in self.route_graph["nodes"]}

    def sites_by_material(self) -> Dict[str, List[Dict[str, Any]]]:
        out: Dict[str, List[Dict[str, Any]]] = {}
        for site in self.resource_sites:
            out.setdefault(site["material_key"], []).append(site)
        return out

    def item_sources(self) -> Dict[str, List[str]]:
        """item_id -> source ids that physically yield it (A3 declared source_ids)."""
        out: Dict[str, List[str]] = {}
        for item_id, item in self.items.items():
            for source_id in item.get("source_ids", []):
                out.setdefault(item_id, []).append(source_id)
        for source_id, source in self.sources.items():
            item_id = source.get("item_id")
            if item_id:
                out.setdefault(item_id, [])
                if source_id not in out[item_id]:
                    out[item_id].append(source_id)
        return {item_id: sorted(set(ids)) for item_id, ids in sorted(out.items())}

    def recipe_outputs(self) -> Dict[str, List[str]]:
        out: Dict[str, List[str]] = {}
        for recipe_id, recipe in self.recipes.items():
            for item_id in recipe["outputs"]:
                out.setdefault(item_id, []).append(recipe_id)
        return {k: sorted(v) for k, v in sorted(out.items())}

    def product_sources(self) -> List[Dict[str, Any]]:
        return self.progression["product_sources"]

    def playability(self, poi: Dict[str, Any]) -> str:
        """Honest classification of what a POI can actually do today.

        A1's own field is trusted, but the returned vocabulary makes the
        distinction between 'a shipped legacy dungeon' and 'a contract file'
        explicit so no report can accidentally call 118 POIs playable.
        """
        readiness = poi.get("content_readiness")
        if readiness == "PRESERVED_BASELINE":
            return "SHIPPED_LEGACY_SCENE_NO_A3_LOOT"
        if readiness == "INTERACTION_SPEC_AUTHORED_NOT_NATIVE":
            return "AUTHORED_SPEC_NATIVE_NOT_INTEGRATED"
        return "CONTRACT_ONLY_NOT_PLAYABLE"

    def loot_bearing_in_authored_contract(self, poi: Dict[str, Any]) -> bool:
        """Whether this POI could hand out A3 loot *according to its A1 record*.

        Scope warning (Control Tower review 2026-10-30): this reads the A1
        authored status field only. It is **not** a measurement of the live A0
        world, and a count of 0 here must not be reported as "the running game
        has no loot". The live question is answered by
        ``sohbalance.product`` against pinned production bytes
        (``PROD-02``), and anything neither can settle is ``NOT_TESTED``.
        """
        if poi.get("status") != "NATIVE_INTEGRATED":
            return False
        return poi.get("content_readiness") != "WORLD_SITE_CONTRACT_ONLY"

    def is_loot_bearing_natively(self, poi: Dict[str, Any]) -> bool:
        """Deprecated alias. Prefer :meth:`loot_bearing_in_authored_contract`."""
        return self.loot_bearing_in_authored_contract(poi)

    def clone_docs(self) -> Dict[str, Any]:
        return copy.deepcopy(self.docs)

    @classmethod
    def from_docs(cls, docs: Dict[str, Any]) -> "Model":
        missing = [key for key in SNAPSHOT_KEYS if key not in docs]
        if missing:
            raise KeyError(f"model requires snapshot keys: {missing}")
        return cls(docs=docs)

    @classmethod
    def load(cls, data_dir: Path = DEFAULT_DATA_DIR) -> "Model":
        return cls(docs=load_docs(data_dir))


def require(mapping: Dict[str, Any], key: str, where: str) -> Any:
    if key not in mapping:
        raise KeyError(f"{where}: missing required field {key!r}")
    return mapping[key]
