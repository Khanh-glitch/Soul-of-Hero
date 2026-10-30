"""Geography tests: authored polylines, capability gating, data-quality limits."""
from __future__ import annotations

import unittest

import _support as support

from sohbalance.geo import RouteNetwork, polyline_length_tiles, travel_seconds

NOVICE_CAPS = ["cap_salvage", "cap_seal_1", "cap_power_1", "cap_filter"]


class GraphShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.net = support.network()

    def test_counts_match_a1_metrics(self) -> None:
        world_metrics = support.model().world["metrics"]
        self.assertEqual(len(self.net.nodes), 123)
        self.assertEqual(len(self.net.edges), world_metrics["route_edge_count"])
        self.assertEqual(len([e for e in self.net.edges if e["kind"] == "spur"]), 108)
        self.assertEqual(len({e["node_id"] for e in self.net.nodes.values() if e["kind"] == "poi"}), 108)

    def test_no_orphan_nodes(self) -> None:
        self.assertEqual(self.net.orphan_nodes(), [])

    def test_all_pois_resolve_to_a_node_except_legacy_inset(self) -> None:
        model = support.model()
        node_ids = set(self.net.nodes)
        missing = [poi["poi_id"] for poi in model.pois if poi["poi_id"] not in node_ids]
        self.assertEqual(len(missing), 10)
        self.assertTrue(all(pid.startswith("legacy_") for pid in missing), missing)

    def test_polyline_endpoint_gaps_are_known_and_reported(self) -> None:
        problems = self.net.endpoint_consistency()
        # Three long connector polylines do not terminate on the node cell.
        self.assertEqual(len(problems), 3, problems)
        for problem in problems:
            self.assertEqual(problem["issue"].split(" ")[0], "end")

    def test_all_capabilities_reach_every_node(self) -> None:
        reachable = self.net.distances("node_refuge", support.model().world_capabilities)
        self.assertEqual(len(reachable), len(self.net.nodes))


class CapabilityGatingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.net = support.network()

    def test_east_seam_requires_filter(self) -> None:
        self.assertEqual(sorted(self.net.route_capabilities("rt_east_seam")), ["cap_filter"])

    def test_unfiltered_path_must_take_the_safe_route(self) -> None:
        safe = self.net.shortest_path("node_refuge", "node_crown_east", [])
        self.assertIsNotNone(safe)
        self.assertEqual(list(safe.route_ids), ["rt_crown_safe_approach"])

    def test_filtered_path_prefers_the_shortcut(self) -> None:
        fast = self.net.shortest_path("node_refuge", "node_crown_east", ["cap_filter"])
        self.assertEqual(list(fast.route_ids), ["rt_east_seam"])
        safe = self.net.shortest_path("node_refuge", "node_crown_east", [])
        self.assertLess(fast.tiles, safe.tiles)

    def test_avoiding_high_risk_restores_the_safe_route(self) -> None:
        banned = {"rt_east_seam"}
        path = self.net.shortest_path(
            "node_refuge", "node_crown_east", ["cap_filter"], forbidden_route_ids=banned
        )
        self.assertEqual(list(path.route_ids), ["rt_crown_safe_approach"])

    def test_unknown_capability_grants_nothing(self) -> None:
        # Inventing a capability must not open a gate: the temple still needs
        # cap_climb / cap_filter / cap_seal_3 plus matching edges.
        self.assertIsNone(
            self.net.shortest_path("node_refuge", "poi_verdant_canopy_temple", ["cap_nonexistent"])
        )
        # ...and holding an extra, unused capability must not close one either.
        self.assertIsNotNone(
            self.net.shortest_path("node_refuge", "node_crown_east", ["cap_nonexistent"])
        )

    def test_reachable_sets_are_monotone(self) -> None:
        empty = len(self.net.reachable("node_refuge", []))
        waystation = len(self.net.reachable("node_refuge", ["cap_salvage", "cap_seal_1"]))
        filtered = len(self.net.reachable("node_refuge", NOVICE_CAPS))
        self.assertLessEqual(empty, waystation)
        self.assertLessEqual(waystation, filtered)

    def test_relay_spur_needs_salvage_from_the_waystation(self) -> None:
        # A1 grants cap_salvage at the Waystation; the Relay spur itself needs it.
        self.assertIsNone(self.net.shortest_path("node_refuge", "poi_crown_relay_shed", []))
        self.assertIsNotNone(
            self.net.shortest_path("node_refuge", "poi_crown_relay_shed", ["cap_salvage"])
        )


class TimeModelTests(unittest.TestCase):
    def test_speed_conversion(self) -> None:
        self.assertAlmostEqual(travel_seconds(6.0), 1.0, places=9)
        self.assertAlmostEqual(travel_seconds(1541.72), 256.953, places=3)

    def test_polyline_length(self) -> None:
        self.assertAlmostEqual(polyline_length_tiles([[0, 0], [3, 4], [3, 10]]), 11.0, places=9)

    def test_zero_tile_size_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            travel_seconds(1.0, tile_px=0)


if __name__ == "__main__":
    unittest.main()
