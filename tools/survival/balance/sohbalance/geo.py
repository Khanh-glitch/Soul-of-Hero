"""Route-graph geometry for the authored A1 continent.

Everything here is *authored-plan* geometry: A1's own polylines in tile
coordinates. It is not native pathfinding and it does not model collision,
cliffs outside the graded corridors, combat, or detours. Those are separate
unmeasured terms and are reported as such.
"""
from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Dict, FrozenSet, Iterable, List, Optional, Sequence, Tuple

Cell = Tuple[float, float]


def euclidean(a: Sequence[float], b: Sequence[float]) -> float:
    return math.hypot(float(a[0]) - float(b[0]), float(a[1]) - float(b[1]))


def polyline_length_tiles(points: Sequence[Sequence[float]]) -> float:
    return sum(euclidean(points[i], points[i + 1]) for i in range(len(points) - 1))


def travel_seconds(tiles: float, walk_px_per_second: float = 96.0, tile_px: float = 16.0) -> float:
    """Movement-only time. 96 px/s over 16 px tiles == 6 tiles/s (A3 assumption)."""
    if tile_px <= 0:
        raise ValueError("tile_px must be positive")
    return tiles * tile_px / walk_px_per_second


@dataclass(frozen=True)
class RoutePath:
    start: str
    goal: str
    tiles: float
    route_ids: Tuple[str, ...]
    edge_keys: Tuple[str, ...]
    bottleneck_risk: str

    @property
    def seconds(self) -> float:
        return travel_seconds(self.tiles)

    def as_dict(self) -> Dict[str, object]:
        return {
            "start": self.start,
            "goal": self.goal,
            "tiles": round(self.tiles, 3),
            "seconds": round(self.seconds, 2),
            "route_ids": list(self.route_ids),
            "bottleneck_risk": self.bottleneck_risk,
            "edge_count": len(self.edge_keys),
        }


RISK_MULTIPLIER = {"low": 1.0, "early": 1.0, "mid": 1.15, "late": 1.3, "high": 1.45, "combat": 1.0}


class RouteNetwork:
    """Capability-gated shortest paths over the authored polyline graph."""

    def __init__(self, graph_doc: Dict[str, object]) -> None:
        graph = graph_doc["route_graph"] if "route_graph" in graph_doc else graph_doc
        self.nodes: Dict[str, Dict[str, object]] = {
            node["node_id"]: node for node in graph["nodes"]  # type: ignore[index]
        }
        self.edges: List[Dict[str, object]] = list(graph["edges"])  # type: ignore[arg-type]
        self._adjacency: Dict[str, List[Tuple[str, Dict[str, object], float]]] = {
            node_id: [] for node_id in self.nodes
        }
        self._edge_index: Dict[str, Dict[str, object]] = {}
        for edge in self.edges:
            length = polyline_length_tiles(edge["polyline"])  # type: ignore[arg-type]
            key = _edge_key(edge)  # type: ignore[arg-type]
            self._edge_index[key] = edge
            self._adjacency.setdefault(edge["from"], []).append((edge["to"], edge, length))  # type: ignore[arg-type]
            self._adjacency.setdefault(edge["to"], []).append((edge["from"], edge, length))  # type: ignore[arg-type]

    # ------------------------------------------------------------------ basics
    def cell(self, node_id: str) -> Optional[Cell]:
        node = self.nodes.get(node_id)
        if node is None:
            return None
        cell = node["cell"]
        return (float(cell[0]), float(cell[1]))  # type: ignore[index]

    def edge_length(self, edge: Dict[str, object]) -> float:
        return polyline_length_tiles(edge["polyline"])  # type: ignore[arg-type]

    def edge_capabilities(self, edge: Dict[str, object]) -> FrozenSet[str]:
        return frozenset(edge.get("required_capabilities", []) or [])

    def route_ids(self) -> List[str]:
        return sorted({str(edge["route_id"]) for edge in self.edges})

    def edges_by_route(self, route_id: str) -> List[Dict[str, object]]:
        return [edge for edge in self.edges if edge.get("route_id") == route_id]

    def route_length(self, route_id: str) -> Optional[float]:
        edges = self.edges_by_route(route_id)
        if not edges:
            return None
        return sum(self.edge_length(edge) for edge in edges)

    def route_capabilities(self, route_id: str) -> FrozenSet[str]:
        caps: set[str] = set()
        for edge in self.edges_by_route(route_id):
            caps |= self.edge_capabilities(edge)
        return frozenset(caps)

    def route_risk(self, route_id: str) -> Optional[str]:
        risks = [str(edge.get("risk")) for edge in self.edges_by_route(route_id)]
        if not risks:
            return None
        order = ["low", "early", "mid", "late", "high", "combat"]
        return max(risks, key=lambda value: order.index(value) if value in order else 0)

    # -------------------------------------------------------------- traversal
    def shortest_path(
        self,
        start: str,
        goal: str,
        capabilities: Iterable[str] = (),
        forbidden_route_ids: Iterable[str] = (),
    ) -> Optional[RoutePath]:
        have = frozenset(capabilities)
        banned = frozenset(forbidden_route_ids)
        if start not in self.nodes or goal not in self.nodes:
            return None
        if start == goal:
            return RoutePath(start, goal, 0.0, (), (), "low")
        best: Dict[str, float] = {start: 0.0}
        previous: Dict[str, Tuple[str, Dict[str, object]]] = {}
        queue: List[Tuple[float, str]] = [(0.0, start)]
        while queue:
            cost, node = heapq.heappop(queue)
            if cost > best.get(node, math.inf) + 1e-12:
                continue
            if node == goal:
                break
            for neighbour, edge, length in self._adjacency.get(node, []):
                if str(edge.get("route_id")) in banned:
                    continue
                if not self.edge_capabilities(edge) <= have:
                    continue
                new_cost = cost + length
                if new_cost < best.get(neighbour, math.inf) - 1e-12:
                    best[neighbour] = new_cost
                    previous[neighbour] = (node, edge)
                    heapq.heappush(queue, (new_cost, neighbour))
        if goal not in best:
            return None
        # reconstruct
        route_ids: List[str] = []
        risks: List[str] = []
        cursor = goal
        while cursor != start:
            prev, edge = previous[cursor]
            route_ids.append(str(edge.get("route_id")))
            risks.append(str(edge.get("risk")))
            cursor = prev
        route_ids.reverse()
        risks.reverse()
        order = ["low", "early", "mid", "late", "high", "combat"]
        bottleneck = max(risks, key=lambda value: order.index(value) if value in order else 0) if risks else "low"
        return RoutePath(
            start=start,
            goal=goal,
            tiles=best[goal],
            route_ids=tuple(route_ids),
            edge_keys=tuple(route_ids),
            bottleneck_risk=bottleneck,
        )

    def distances(self, start: str, capabilities: Iterable[str] = ()) -> Dict[str, float]:
        have = frozenset(capabilities)
        best: Dict[str, float] = {start: 0.0}
        queue: List[Tuple[float, str]] = [(0.0, start)]
        while queue:
            cost, node = heapq.heappop(queue)
            if cost > best.get(node, math.inf) + 1e-12:
                continue
            for neighbour, edge, length in self._adjacency.get(node, []):
                if not self.edge_capabilities(edge) <= have:
                    continue
                new_cost = cost + length
                if new_cost < best.get(neighbour, math.inf) - 1e-12:
                    best[neighbour] = new_cost
                    heapq.heappush(queue, (new_cost, neighbour))
        return best

    def reachable(self, start: str, capabilities: Iterable[str] = ()) -> List[str]:
        return sorted(self.distances(start, capabilities))

    def blocked_targets(self, start: str, capabilities: Iterable[str] = ()) -> List[str]:
        reachable = set(self.reachable(start, capabilities))
        return sorted(node_id for node_id in self.nodes if node_id not in reachable)

    def orphan_nodes(self) -> List[str]:
        """Nodes with no edges at all (a data defect, not a design choice)."""
        return sorted(node_id for node_id, adj in self._adjacency.items() if not adj)

    def endpoint_consistency(self) -> List[Dict[str, object]]:
        """Does each edge polyline start/end at its declared node cells?"""
        problems: List[Dict[str, object]] = []
        for edge in self.edges:
            polyline = edge["polyline"]
            if len(polyline) < 2:
                problems.append({"edge": _edge_key(edge), "issue": "polyline shorter than 2 points"})
                continue
            for node_id, point, position in (
                (edge["from"], polyline[0], "start"),
                (edge["to"], polyline[-1], "end"),
            ):
                cell = self.cell(str(node_id))
                if cell is None:
                    problems.append({"edge": _edge_key(edge), "issue": f"{position} node {node_id} missing"})
                    continue
                gap = euclidean(cell, point)
                if gap > 1.0:
                    problems.append(
                        {
                            "edge": _edge_key(edge),
                            "issue": f"{position} point is {gap:.2f} tiles from {node_id}",
                        }
                    )
        return problems


def _edge_key(edge: Dict[str, object]) -> str:
    return f"{edge.get('route_id')}:{edge.get('from')}->{edge.get('to')}"
