"""Source accessibility, ownership integrity and craft-reachability ladders.

Three questions, kept separate on purpose:

1. Does every item/source/loot/recipe reference in A3 actually resolve?
   (Referential integrity - a data defect, not a balance opinion.)
2. Is every A3 source geographically reachable in A1's authored world, and under
   which capabilities? (Access - the difference between "a POI exists" and
   "a player can get there".)
3. What can a player actually build from which class of source?
   (Ladder: native-proven / +legacy combat / +authored plan.)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, FrozenSet, Iterable, List, Optional, Set, Tuple

from .findings import Finding
from .geo import RouteNetwork, travel_seconds

# A3 requirement kinds that A1 does not model as a capability.
A3_REQUIREMENT_KINDS = {"tool_item", "access_tier", "power", "resistance"}


# --------------------------------------------------------------- integrity
def audit_integrity(model) -> List[Finding]:
    findings: List[Finding] = []
    items = model.items
    sources = model.sources
    stations = model.stations
    techs = model.technologies

    # sources -> items
    for source_id, source in sources.items():
        item_id = source.get("item_id")
        if item_id and item_id not in items:
            findings.append(
                Finding("SOURCE_ITEM_UNKNOWN", "BLOCKER", source_id, f"item_id {item_id!r} not in items.json", "A3")
            )
        for requirement in source.get("requirements", []) or []:
            kind = requirement.get("kind")
            if kind not in A3_REQUIREMENT_KINDS:
                findings.append(
                    Finding(
                        "SOURCE_REQUIREMENT_UNMAPPED",
                        "MAJOR",
                        f"{source_id}:{kind}",
                        "requirement kind is not part of the A1/A3 capability vocabulary",
                        "A3",
                    )
                )

    # items -> sources
    for item_id, item in items.items():
        for source_id in item.get("source_ids", []) or []:
            if source_id not in sources:
                findings.append(
                    Finding(
                        "ITEM_ORPHAN_SOURCE",
                        "MAJOR",
                        f"{item_id}->{source_id}",
                        "item declares a source that does not exist in sources.json",
                        "A3",
                    )
                )
        if item.get("acquisition_status") != "CRAFT_ONLY" and not item.get("source_ids"):
            findings.append(
                Finding("ITEM_NO_SOURCE", "MAJOR", item_id, "non-craftable item has no declared source", "A3")
            )

    # item <-> source ownership agreement
    for item_id, item in items.items():
        for source_id in item.get("source_ids", []) or []:
            source = sources.get(source_id)
            if source and source.get("item_id") and source["item_id"] != item_id:
                findings.append(
                    Finding(
                        "ITEM_SOURCE_MISMATCH",
                        "MAJOR",
                        f"{item_id}<->{source_id}",
                        f"item claims the source but the source yields {source['item_id']!r}",
                        "A3",
                    )
                )

    # multiple sources claiming one item with different yields
    by_item: Dict[str, List[Tuple[str, object]]] = {}
    for source_id, source in sources.items():
        if source.get("item_id"):
            by_item.setdefault(str(source["item_id"]), []).append((source_id, source.get("yield_per_claim")))
    for item_id, rows in by_item.items():
        yields = {row[1] for row in rows if row[1] is not None}
        if len(rows) > 1 and len(yields) > 1:
            findings.append(
                Finding(
                    "ITEM_OVEROWNED",
                    "MINOR",
                    item_id,
                    "sources disagree on yield: " + ", ".join(f"{sid}={y}" for sid, y in sorted(rows)),
                    "A3",
                )
            )

    # loot tables
    for table_id, payload in model.loot_tables.items():
        rolls = int(payload.get("rolls", 0))
        if rolls <= 0:
            findings.append(Finding("LOOT_ROLLS_INVALID", "MAJOR", table_id, f"rolls={rolls}", "A3"))
        total_weight = 0
        for entry in payload.get("entries", []):
            item_id = entry.get("item_id")
            item = items.get(item_id)
            if item is None:
                findings.append(
                    Finding("LOOT_ITEM_UNKNOWN", "BLOCKER", f"{table_id}:{item_id}", "loot item absent from items.json", "A3")
                )
                continue
            weight = int(entry.get("weight", 0))
            total_weight += weight
            low, high = (int(v) for v in entry.get("quantity", [0, 0]))
            if high < low or low < 0:
                findings.append(
                    Finding(
                        "LOOT_QUANTITY_RANGE_INVALID",
                        "MAJOR",
                        f"{table_id}:{item_id}",
                        f"quantity range [{low}, {high}]",
                        "A3",
                    )
                )
            excluded = set(payload.get("excluded_tags", []) or [])
            if excluded & set(item.get("tags", []) or []):
                findings.append(
                    Finding(
                        "LOOT_EXCLUDED_TAG_VIOLATION",
                        "BLOCKER",
                        f"{table_id}:{item_id}",
                        "table can emit an item carrying its own excluded tag",
                        "A3",
                    )
                )
        if total_weight <= 0:
            findings.append(Finding("LOOT_TABLE_DEGENERATE", "MAJOR", table_id, "no positive weight", "A3"))

    # recipes + research
    for recipe_id, recipe in model.recipes.items():
        for item_id in list(recipe["inputs"]) + list(recipe["outputs"]):
            if item_id not in items:
                findings.append(
                    Finding("RECIPE_ITEM_UNKNOWN", "MAJOR", f"{recipe_id}:{item_id}", "recipe item absent from items.json", "A3")
                )
        if recipe.get("station") not in stations:
            findings.append(
                Finding("RECIPE_UNKNOWN_STATION", "MAJOR", recipe_id, f"station {recipe.get('station')!r} absent", "A3")
            )
        for tech_id in recipe.get("required_technologies", []) or []:
            if tech_id not in techs:
                findings.append(
                    Finding("RECIPE_UNKNOWN_TECH", "MAJOR", f"{recipe_id}:{tech_id}", "technology absent from research.json", "A3")
                )
    for tech_id, tech in techs.items():
        for item_id in tech["inputs"]:
            if item_id not in items:
                findings.append(
                    Finding("RECIPE_ITEM_UNKNOWN", "MAJOR", f"{tech_id}:{item_id}", "technology item absent from items.json", "A3")
                )

    findings.extend(_recipe_cycles(model))
    return findings


def _recipe_cycles(model) -> List[Finding]:
    """Detect item-level production cycles (ignoring quantities)."""
    graph: Dict[str, Set[str]] = {}
    for recipe in model.recipes.values():
        for output in recipe["outputs"]:
            for source_item in recipe["inputs"]:
                graph.setdefault(output, set()).add(source_item)
    cycles: List[List[str]] = []
    state: Dict[str, int] = {}
    stack: List[str] = []

    def walk(node: str) -> None:
        state[node] = 1
        stack.append(node)
        for neighbour in sorted(graph.get(node, ())):
            if state.get(neighbour) == 0:
                walk(neighbour)
            elif state.get(neighbour) == 1:
                index = stack.index(neighbour)
                cycles.append(stack[index:] + [neighbour])
        stack.pop()
        state[node] = 2

    for node in sorted(graph):
        if state.get(node, 0) == 0:
            walk(node)
    findings: List[Finding] = []
    seen: Set[Tuple[str, ...]] = set()
    for cycle in cycles:
        key = tuple(sorted(set(cycle)))
        if key in seen:
            continue
        seen.add(key)
        # A self-returning cultivation recipe (seed -> crop + same seed) is a
        # deliberate seed-preserving yield, not an exploit; label it honestly.
        self_return = len(cycle) == 2 and cycle[0] == cycle[1]
        cultivation = any(
            recipe.get("category") == "cultivation" and cycle[0] in recipe["outputs"]
            for recipe in model.recipes.values()
        )
        if self_return and cultivation:
            findings.append(
                Finding(
                    "RECIPE_CYCLE",
                    "INFO",
                    " -> ".join(cycle),
                    "seed-preserving cultivation yield (crop returns one seed); not an exploit",
                    "A3",
                )
            )
        else:
            findings.append(
                Finding("RECIPE_CYCLE", "MINOR", " -> ".join(cycle), "item production cycle", "A3")
            )
    return findings


# ------------------------------------------------------- geography binding
def audit_bindings(model, network: RouteNetwork) -> Tuple[List[Finding], List[Dict[str, object]]]:
    """Do A3's loot sources exist at A1 places?"""
    findings: List[Finding] = []
    rows: List[Dict[str, object]] = []
    poi_ids = set(model.poi_index())
    region_ids = set(model.region_index())
    for source_id, source in sorted(model.sources.items()):
        related_poi = source.get("poi")
        related_region = source.get("region_id")
        poi_id = related_poi.split(":", 1)[1] if isinstance(related_poi, str) and related_poi.startswith("poi:") else related_poi
        poi_resolved = bool(poi_id) and poi_id in poi_ids
        region_resolved = bool(related_region) and related_region in region_ids
        row = {
            "source_id": source_id,
            "acquisition": source.get("acquisition"),
            "item_id": source.get("item_id"),
            "a3_poi_reference": related_poi,
            "a1_poi_resolved": poi_resolved,
            "a1_poi_id": poi_id if poi_resolved else None,
            "a3_region_reference": related_region,
            "a1_region_resolved": region_resolved,
            "integration_status": source.get("integration_status"),
            "requirements": source.get("requirements", []),
        }
        if source.get("acquisition") == "loot":
            if not poi_resolved:
                findings.append(
                    Finding(
                        "SOURCE_POI_UNRESOLVED",
                        "MAJOR",
                        source_id,
                        f"A3 POI reference {related_poi!r} is not an A1 poi_id",
                        "A3",
                    )
                )
            if not region_resolved:
                findings.append(
                    Finding(
                        "SOURCE_REGION_UNRESOLVED",
                        "MINOR",
                        source_id,
                        f"A3 region {related_region!r} is not an A1 region_id",
                        "A3",
                    )
                )
        rows.append(row)
    return findings, rows


def product_source_rows(model, network: RouteNetwork, capabilities: Iterable[str]) -> Tuple[List[Finding], List[Dict[str, object]]]:
    """Resolve A3's own product-source bindings against A1 geography."""
    findings: List[Finding] = []
    rows: List[Dict[str, object]] = []
    poi_index = model.poi_index()
    node_index = model.node_index()
    have = frozenset(capabilities)
    for source in model.product_sources():
        poi_id = source.get("poi_id")
        route_node = source.get("route_node")
        status = str(source.get("binding_status", ""))
        row: Dict[str, object] = {
            "source_id": source.get("source_id"),
            "binding_status": status,
            "poi_id": poi_id,
            "route_node": route_node,
            "risk": source.get("risk"),
            "one_time": source.get("one_time"),
            "requires_capabilities": source.get("requires_capabilities", []),
            "item_id": source.get("item_id"),
            "outputs": source.get("outputs"),
            "a1_poi_resolved": None,
            "a1_poi_readiness": None,
            "path_tiles": None,
            "path_seconds": None,
            "route_locked": None,
        }
        target_node: Optional[str] = route_node if route_node in node_index else None
        if poi_id:
            poi = poi_index.get(str(poi_id))
            row["a1_poi_resolved"] = poi is not None
            if poi is None:
                findings.append(
                    Finding("SOURCE_POI_UNRESOLVED", "MAJOR", str(source.get("source_id")), f"A1 has no POI {poi_id!r}", "A3")
                )
            else:
                row["a1_poi_readiness"] = model.playability(poi)
                if str(poi_id) in node_index:
                    target_node = str(poi_id)
                elif route_node in node_index:
                    target_node = str(route_node)
        if target_node:
            path = network.shortest_path("node_refuge", target_node, have)
            if path is None:
                row["route_locked"] = True
                findings.append(
                    Finding(
                        "ROUTE_LOCKED_FOR_CAPABILITIES",
                        "INFO",
                        str(source.get("source_id")),
                        f"no route to {target_node} with {sorted(have)}",
                        "A1/A3",
                    )
                )
            else:
                row["route_locked"] = False
                row["path_tiles"] = round(path.tiles, 2)
                row["path_seconds"] = round(path.seconds, 1)
        own_caps = frozenset(source.get("requires_capabilities", []) or [])
        unknown = own_caps - frozenset(model.world_capabilities)
        if unknown:
            findings.append(
                Finding("CAPABILITY_ORPHAN", "MAJOR", str(source.get("source_id")), f"unknown capability {sorted(unknown)}", "A3")
            )
        if "PROVISIONAL" in status:
            findings.append(
                Finding(
                    "PROVISIONAL_BINDING",
                    "INFO",
                    str(source.get("source_id")),
                    f"binding status {status} is not owner-approved",
                    "A3",
                )
            )
        rows.append(row)
    return findings, rows


# --------------------------------------------------------------- craft ladder
@dataclass
class ClosureResult:
    seeds: List[str]
    obtainable: List[str] = field(default_factory=list)
    blocked: List[Dict[str, object]] = field(default_factory=list)
    craftable_recipes: List[str] = field(default_factory=list)
    stations: List[str] = field(default_factory=list)
    technologies: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, object]:
        return {
            "seeds": sorted(self.seeds),
            "obtainable_count": len(self.obtainable),
            "obtainable": sorted(self.obtainable),
            "craftable_recipe_count": len(self.craftable_recipes),
            "craftable_recipes": sorted(self.craftable_recipes),
            "stations": sorted(self.stations),
            "technologies": sorted(self.technologies),
            "blocked_sample": sorted(self.blocked, key=lambda row: str(row["recipe_id"]))[:40],
            "blocked_count": len(self.blocked),
        }


def craft_closure(model, seeds: Iterable[str], label: str = "closure") -> ClosureResult:
    """Fixed point: what can be produced from the seed items alone?

    Stations are unlocked when their kit item becomes obtainable (kit -> station
    mapping comes from stations.json, so the model is not guessing). Hand
    crafting is always available.
    """
    obtainable: Set[str] = set(seeds)
    stations: Set[str] = {"hand"}
    craftable: List[str] = []
    technologies: List[str] = []
    changed = True
    while changed:
        changed = False
        for recipe_id, recipe in sorted(model.recipes.items()):
            if recipe_id in craftable:
                continue
            if recipe.get("station") not in stations:
                continue
            if any(tech not in technologies for tech in recipe.get("required_technologies", []) or []):
                continue
            if all(item in obtainable for item in recipe["inputs"]):
                craftable.append(recipe_id)
                for output in recipe["outputs"]:
                    if output not in obtainable:
                        obtainable.add(output)
                        changed = True
                for station_id, station in model.stations.items():
                    if station.get("kit") and station["kit"] in recipe["outputs"]:
                        if station_id not in stations:
                            stations.add(station_id)
                            changed = True
        # technologies are research-station actions; treat as available once the
        # research station exists and the inputs are obtainable
        if "research" in stations:
            for tech_id, tech in sorted(model.technologies.items()):
                if tech_id in technologies:
                    continue
                if any(prereq not in technologies for prereq in tech.get("prerequisites", []) or []):
                    continue
                if all(item in obtainable for item in tech["inputs"]):
                    technologies.append(tech_id)
                    changed = True
    blocked: List[Dict[str, object]] = []
    for recipe_id, recipe in sorted(model.recipes.items()):
        if recipe_id in craftable:
            continue
        missing = [item for item in recipe["inputs"] if item not in obtainable]
        reason = "station" if recipe.get("station") not in stations else ("technology" if any(t not in technologies for t in recipe.get("required_technologies", []) or []) else "material")
        blocked.append({"recipe_id": recipe_id, "reason": reason, "missing": missing})
    return ClosureResult(
        seeds=sorted(seeds),
        obtainable=sorted(obtainable),
        blocked=blocked,
        craftable_recipes=sorted(craftable),
        stations=sorted(stations),
        technologies=sorted(technologies),
    )


def seed_sets(model) -> Dict[str, List[str]]:
    """Three honest ladders, each labelled by the evidence it rests on."""
    live = sorted(
        {
            str(source["item_id"])
            for source in model.sources.values()
            if source.get("integration_status") == "LIVE_SURV_010" and source.get("item_id")
        }
    )
    legacy = sorted(
        {
            str(source["item_id"])
            for source in model.sources.values()
            if source.get("integration_status") == "LIVE_EXISTING_REWARDS" and source.get("item_id")
        }
    )
    authored = sorted(
        {
            str(source["item_id"])
            for source in model.sources.values()
            if source.get("integration_status") == "PROPOSED_A1" and source.get("item_id")
        }
        | {
            str(source["item_id"])
            for source in model.product_sources()
            if source.get("item_id")
        }
        | {
            str(item_id)
            for source in model.product_sources()
            for item_id in (source.get("outputs") or {})
        }
    )
    return {
        "NATIVE_PROVEN": live,
        "NATIVE_PLUS_LEGACY_REWARDS": sorted(set(live) | set(legacy)),
        "AUTHORED_PLAN_INCLUDING_LOOT": sorted(set(live) | set(legacy) | set(authored)),
    }


def bootstrap_cycle_findings(model) -> List[Finding]:
    """Find capability/item bootstraps that need their own downstream output.

    The concrete instance this checks: knowledge_spares is produced only by a
    recipe performed at the research station, while the research station's kit
    itself costs knowledge_spares.
    """
    findings: List[Finding] = []
    producers: Dict[str, List[str]] = {}
    for recipe_id, recipe in model.recipes.items():
        for output in recipe["outputs"]:
            producers.setdefault(output, []).append(recipe_id)

    research_kit = model.recipes.get("research_kit")
    if research_kit:
        spares_needed = int(research_kit["inputs"].get("knowledge_spares", 0))
        if spares_needed > 0:
            craftable_sources = [
                recipe_id
                for recipe_id in producers.get("knowledge_spares", [])
                if model.recipes[recipe_id].get("station") == "research"
            ]
            non_station_sources = [
                source_id
                for source_id, source in model.sources.items()
                if source.get("item_id") == "knowledge_spares"
                and source.get("integration_status") in ("LIVE_SURV_010", "LIVE_EXISTING_REWARDS")
            ]
            if craftable_sources and not non_station_sources:
                findings.append(
                    Finding(
                        "BOOTSTRAP_DEPENDENCY_CYCLE",
                        "MAJOR",
                        "knowledge_spares",
                        (
                            f"{research_kit['id']} needs {spares_needed} knowledge_spares, whose only "
                            f"producer ({', '.join(craftable_sources)}) runs at the research station, "
                            "and no LIVE source provides spares"
                        ),
                        "A3",
                    )
                )
    # capability grants that need the capability they grant, or a downstream one
    grants: Dict[str, List[str]] = {}
    for poi in model.pois:
        for cap in poi.get("grants_capabilities", []) or []:
            grants.setdefault(cap, []).append(poi["poi_id"])
    for cap, poi_ids in sorted(grants.items()):
        self_gated = [
            poi_id
            for poi_id in poi_ids
            if cap in (model.poi_index()[poi_id].get("required_capabilities", []) or [])
        ]
        if self_gated and len(self_gated) == len(poi_ids):
            findings.append(
                Finding(
                    "CAPABILITY_SELF_DEPENDENCY",
                    "BLOCKER",
                    cap,
                    f"only source(s) {self_gated} also require {cap}",
                    "A1",
                )
            )
    return findings


def capability_reachability(model, network: RouteNetwork) -> Dict[str, object]:
    """How much of the authored world each capability tier opens from the Refuge."""
    tiers = {
        "EMPTY_HANDED": [],
        "AFTER_WAYSTATION": ["cap_salvage", "cap_seal_1"],
        "AFTER_RELAY": ["cap_salvage", "cap_seal_1", "cap_power_1"],
        "AFTER_APOTHECARY": ["cap_salvage", "cap_seal_1", "cap_power_1", "cap_filter"],
        "ALL_AUTHORED_CAPABILITIES": list(model.world_capabilities),
    }
    poi_nodes = set(model.poi_index())
    rows: Dict[str, object] = {}
    for tier, caps in tiers.items():
        reachable_nodes = set(network.reachable("node_refuge", caps))
        reachable_pois = sorted(node for node in reachable_nodes if node in poi_nodes)
        bands: Dict[str, int] = {}
        enterable: List[str] = []
        entry_locked: List[str] = []
        for poi_id in reachable_pois:
            poi = model.poi_index()[poi_id]
            band = str(poi.get("band"))
            bands[band] = bands.get(band, 0) + 1
            if frozenset(poi.get("required_capabilities", []) or []) <= frozenset(caps):
                enterable.append(poi_id)
            else:
                entry_locked.append(poi_id)
        rows[tier] = {
            "capabilities": sorted(caps),
            "reachable_nodes": len(reachable_nodes),
            "reachable_pois": len(reachable_pois),
            "reachable_poi_bands": bands,
            "enterable_pois": len(enterable),
            "entry_locked_pois": len(entry_locked),
            "enterable_poi_ids": enterable,
            "playable_reachable_pois": sum(
                1 for poi_id in reachable_pois if model.playability(model.poi_index()[poi_id]) == "AUTHORED_SPEC_NATIVE_NOT_INTEGRATED"
            ),
            "loot_bearing_reachable_pois": sum(
                1 for poi_id in reachable_pois if model.is_loot_bearing_natively(model.poi_index()[poi_id])
            ),
        }
    return rows


# --------------------------------------------------------------- risk labels
def risk_vocabulary_findings(model, network: RouteNetwork) -> Tuple[List[Finding], Dict[str, object]]:
    """A1's single ``risk`` field mixes severity and progression band."""
    counts: Dict[str, int] = {}
    for edge in network.edges:
        label = str(edge.get("risk"))
        counts[label] = counts.get(label, 0) + 1
    severity_labels = {"low", "medium", "high", "combat"}
    band_labels = {"early", "mid", "late"}
    used_severity = sorted(set(counts) & severity_labels)
    used_band = sorted(set(counts) & band_labels)
    death_keys = set((model.progression["assumptions"].get("base_death_chance") or {}).keys())
    covered = sum(count for label, count in counts.items() if label in death_keys)
    findings: List[Finding] = []
    if used_severity and used_band:
        findings.append(
            Finding(
                "DEATH_CARGO_LOSS_UNMODELLED",
                "MAJOR",
                "A1 route_graph.risk",
                (
                    "edge risk mixes severity " + ",".join(used_severity)
                    + " with progression band " + ",".join(used_band)
                    + f"; A3's death-chance keys {sorted(death_keys)} cover {covered}/{len(network.edges)} edges,"
                    " so cargo-loss expectation cannot be computed for the rest"
                ),
                "A1/A3",
            )
        )
    return findings, {
        "risk_label_counts": dict(sorted(counts.items())),
        "severity_labels_used": used_severity,
        "band_labels_used": used_band,
        "a3_death_chance_keys": sorted(death_keys),
        "edges_with_death_model": covered,
        "edges_total": len(network.edges),
    }


# ------------------------------------------------------- hazard vs mitigation
def parse_resistance(requirement: object) -> Optional[Tuple[str, float]]:
    if not isinstance(requirement, str) or ":" not in requirement:
        return None
    key, _, value = requirement.partition(":")
    try:
        return key, float(value)
    except ValueError:
        return None


def item_resistances(model) -> Dict[str, Dict[str, float]]:
    out: Dict[str, Dict[str, float]] = {}
    for item_id, item in model.items.items():
        if item.get("resistances"):
            out[item_id] = {k: float(v) for k, v in item["resistances"].items()}
    return out


def hazard_mitigation_matrix(model) -> Tuple[List[Finding], List[Dict[str, object]]]:
    """Can any catalogged item actually cover each declared resistance gate?

    Access preparation (cap_filter/cap_thermal) and damage mitigation
    (resistance keys) are different axes; the matrix keeps them apart and also
    reports what hazard A1 actually puts at the bound POI.
    """
    findings: List[Finding] = []
    rows: List[Dict[str, object]] = []
    resistances = item_resistances(model)
    poi_index = model.poi_index()
    binding_by_source = {
        str(source.get("source_id")): source for source in model.product_sources() if source.get("source_id")
    }
    # A3's two files do not always agree on a source id (e.g. vault_catalyst vs
    # catalyst_vault), so fall back to matching the physical item.
    binding_by_item = {
        str(source.get("item_id")): source
        for source in model.product_sources()
        if source.get("item_id") and source.get("poi_id")
    }
    for source_id, source in sorted(model.sources.items()):
        for requirement in source.get("requirements", []) or []:
            if requirement.get("kind") != "resistance":
                continue
            parsed = parse_resistance(requirement.get("value"))
            if parsed is None:
                findings.append(
                    Finding("SOURCE_REQUIREMENT_UNMAPPED", "MAJOR", f"{source_id}:resistance", "unparsable resistance requirement", "A3")
                )
                continue
            key, value = parsed
            covering = sorted(
                item_id for item_id, res in resistances.items() if res.get(key, 0.0) >= value
            )
            binding = binding_by_source.get(source_id) or binding_by_item.get(str(source.get("item_id")))
            poi_id = (binding or {}).get("poi_id")
            poi = poi_index.get(str(poi_id)) if poi_id else None
            hazard_id = poi.get("hazard_id") if poi else None
            hazard = next((h for h in model.hazards if h.get("hazard_id") == hazard_id), None)
            rows.append(
                {
                    "source_id": source_id,
                    "required_resistance": f"{key}:{value:g}",
                    "covering_items": covering,
                    "bound_poi_id": poi_id,
                    "bound_hazard_id": hazard_id,
                    "bound_hazard_kind": (hazard or {}).get("kind"),
                    "access_capability_for_hazard": (hazard or {}).get("requires"),
                    "status": "COVERED" if covering else "UNCOVERED",
                }
            )
            if not covering:
                findings.append(
                    Finding(
                        "CAPABILITY_ORPHAN",
                        "MAJOR",
                        f"{source_id}:{requirement.get('value')}",
                        "no catalogged item declares this resistance key/value",
                        "A3",
                    )
                )
            elif hazard and hazard.get("kind") and hazard.get("kind") != key:
                findings.append(
                    Finding(
                        "SOURCE_REQUIREMENT_UNMAPPED",
                        "MAJOR",
                        f"{source_id}:{requirement.get('value')}",
                        (
                            f"resistance {key}:{value:g} is required at a POI whose A1 hazard kind is "
                            f"{hazard.get('kind')} (access capability {hazard.get('requires')}); "
                            "mitigation key and hazard kind disagree"
                        ),
                        "A1/A3",
                    )
                )
    return findings, rows


def mitigation_craft_chain(model, hazard_rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    """Where the covering items sit on the craft ladder (are they reachable?)."""
    seeds = seed_sets(model)
    closures = {label: craft_closure(model, seeds[label], label) for label in seeds}
    out: List[Dict[str, object]] = []
    for row in hazard_rows:
        for item_id in row["covering_items"]:  # type: ignore[union-attr]
            recipe_ids = [rid for rid, recipe in model.recipes.items() if item_id in recipe["outputs"]]
            reach: Dict[str, bool] = {}
            for label, closure in closures.items():
                reach[label] = item_id in closure.obtainable
            out.append(
                {
                    "source_id": row["source_id"],
                    "covering_item": item_id,
                    "recipes": sorted(recipe_ids),
                    "reachable_from": reach,
                    "required_technologies": sorted(
                        {tech for rid in recipe_ids for tech in model.recipes[rid].get("required_technologies", []) or []}
                    ),
                }
            )
    return out


def source_id_divergence(model) -> List[Finding]:
    """Same physical source, different ids between sources.json and progression_model."""
    findings: List[Finding] = []
    by_item: Dict[str, List[str]] = {}
    for source_id, source in model.sources.items():
        if source.get("item_id"):
            by_item.setdefault(str(source["item_id"]), []).append(source_id)
    for product in model.product_sources():
        item_id = product.get("item_id")
        if not item_id:
            continue
        catalog_ids = by_item.get(str(item_id), [])
        product_id = str(product.get("source_id"))
        if catalog_ids and product_id not in catalog_ids:
            findings.append(
                Finding(
                    "SOURCE_ID_DIVERGENCE",
                    "MINOR",
                    str(item_id),
                    f"progression_model uses {product_id!r} while sources.json uses {sorted(catalog_ids)}",
                    "A3",
                )
            )
    return findings


def resistance_chain_findings(model, hazard_rows: List[Dict[str, object]]) -> List[Finding]:
    """If a gated source needs a mitigation item, is that item reachable at all?"""
    findings: List[Finding] = []
    chain = mitigation_craft_chain(model, hazard_rows)
    by_source: Dict[str, List[Dict[str, object]]] = {}
    for row in chain:
        by_source.setdefault(str(row["source_id"]), []).append(row)
    for source_id, rows in sorted(by_source.items()):
        reach = rows[0]["reachable_from"]
        if isinstance(reach, dict) and not any(reach.values()):
            findings.append(
                Finding(
                    "RESISTANCE_CHAIN_BLOCKED",
                    "MAJOR",
                    source_id,
                    "mitigation item is not reachable from any seed ladder",
                    "A3",
                )
            )
        elif isinstance(reach, dict) and not (reach.get("NATIVE_PROVEN") or reach.get("NATIVE_PLUS_LEGACY_REWARDS")):
            findings.append(
                Finding(
                    "RESISTANCE_CHAIN_BLOCKED",
                    "MINOR",
                    source_id,
                    "mitigation item exists only in the authored-plan ladder, not in native or legacy-reward play",
                    "A3",
                )
            )
    return findings


def quantity_ownership_findings(model) -> List[Finding]:
    """A1 owns reward policy and hints; A3 owns item quantity. Neither may speak for the other.

    A1's authored first-hour rewards declare item *hints* and a policy but no
    numbers at all. A3's progression model attaches concrete quantities to the
    same POIs. That has to stay visible as an unresolved contract instead of
    being reported as "the locker gives 2 spares".
    """
    findings: List[Finding] = []
    specs = [
        ("poi_crown_waystation", model.waystation_spec),
        ("poi_crown_relay_shed", model.relay_spec),
    ]
    for poi_id, spec in specs:
        a1_quantities = [
            reward.get("reward_id")
            for reward in spec.get("rewards", []) or []
            if "quantities" in reward
        ]
        if a1_quantities:
            findings.append(
                Finding(
                    "QUANTITY_OWNERSHIP_UNRESOLVED",
                    "MAJOR",
                    poi_id,
                    f"A1 reward(s) {a1_quantities} carry explicit quantities although A1 authors hints and policy only",
                    "A1",
                )
            )
        a3_assignments = {
            str(source.get("source_id")): source.get("outputs")
            for source in model.product_sources()
            if source.get("poi_id") == poi_id and source.get("outputs")
        }
        if not a3_assignments:
            continue
        policies = sorted(
            {
                str(reward.get("policy"))
                for reward in spec.get("rewards", []) or []
                if reward.get("a3_item_hints")
            }
        )
        findings.append(
            Finding(
                "QUANTITY_OWNERSHIP_UNRESOLVED",
                "MAJOR",
                poi_id,
                (
                    "A1 authors item hints and policy "
                    + ",".join(policies)
                    + " with 0 quantities; A3 assigns "
                    + "; ".join(f"{sid}={payload}" for sid, payload in sorted(a3_assignments.items()))
                ),
                "A3",
            )
        )
    return findings
