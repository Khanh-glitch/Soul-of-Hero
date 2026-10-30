"""Integration-gate tests, round 4: the gate must resist false completion.

Round 3's tests proved that a *defect* could be closed by editing text. That was
the bug: injecting ``save_service.transact_once(`` moved a blocker toward PASS.
These tests assert the opposite. They construct the exact spoofs Control Tower
rejected — comments, string literals, test files, unmounted files, dead functions,
capability probes, invented native runs — and require each one to fail to count.

Two tests do exercise the positive direction (a mounted caller plus a VERIFIED
run on the pinned commit reaches S4). Those feed the gate's *own* evidence
interface; they prove the gate can distinguish states, not that the game works.
"""
from __future__ import annotations

import copy
import json
import unittest

import _support as support

from sohbalance import evidence, gate, identity, product


def _inputs():
    texts, manifest = product.load_snapshot(support.REPO_ROOT)
    model = support.model()
    facts = product.build_facts(
        texts, manifest, loot_tables=sorted(model.loot_tables), station_ids=sorted(model.stations)
    )
    facts.update(product.model_facts(model))
    return model, texts, manifest, facts


def _build(texts, facts, manifest, evidence_payload=None, paths=None):
    return gate.build(
        support.model(),
        texts,
        facts,
        manifest,
        evidence=evidence_payload or {"schema": evidence.SCHEMA, "runs": []},
        paths=paths or product.path_index(manifest),
        tree=product.load_tree(manifest),
    )


def _link(payload, chain_id, link_id):
    chain = next(row for row in payload["chains"] if row["chain_id"] == chain_id)
    return next(row for row in chain["links"] if row["link"] == link_id)


class GateShapeTests(unittest.TestCase):
    """What the pinned bytes say, with no promotion between claim types."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.model, cls.texts, cls.manifest, cls.facts = _inputs()
        cls.payload = _build(cls.texts, cls.facts, cls.manifest)

    def test_two_chains_of_eight_links(self) -> None:
        self.assertEqual([c["chain_id"] for c in self.payload["chains"]], ["waystation_cache", "a8_quarry"])
        for chain in self.payload["chains"]:
            self.assertEqual(len(chain["links"]), 8)

    def test_static_evidence_never_exceeds_s3(self) -> None:
        levels = {level["level"]: index for index, level in enumerate(self.payload["s_levels"])}
        for chain in self.payload["chains"]:
            for link in chain["links"]:
                self.assertLessEqual(levels[link["level"]], 3, f"{chain['chain_id']}/{link['link']}")
                self.assertFalse(link["native_state"] == evidence.VERIFIED)

    def test_entry_claims_are_four_separate_states(self) -> None:
        claims = self.payload["entry_claims"]
        self.assertEqual(
            sorted(claims),
            [
                "A_route_exists_in_source",
                "B_route_runs_in_native_godot",
                "C_content_is_mounted",
                "D_useful_reward_claimable",
            ],
        )
        # A is true in source: the ordinary menu route exists.
        self.assertEqual(claims["A_route_exists_in_source"]["state"], "SOURCE_PRESENT")
        route = claims["A_route_exists_in_source"]["evidence"]
        self.assertTrue(route["route_exists_in_source"])
        self.assertFalse(route["test_flag_required"], "the route must not need a test flag")
        self.assertTrue(all(step["line"] for step in route["steps"]), route["steps"])
        # B is not claimed: no native run exists on the pinned commit.
        self.assertNotEqual(claims["B_route_runs_in_native_godot"]["level"], "S4_NATIVE_VERIFIED")
        # C is absent: neither the A1 cache nor an A8 site is in that world.
        self.assertEqual(claims["C_content_is_mounted"]["state"], "ABSENT")
        self.assertEqual(claims["C_content_is_mounted"]["evidence"]["a1_instance_references_in_a0_surface"], [])
        # D is partial at best: no A1-contract-keyed claim exists.
        self.assertEqual(claims["D_useful_reward_claimable"]["state"], "PARTIAL")

    def test_entry_route_is_cited_by_file_and_line(self) -> None:
        route = self.payload["entry_claims"]["A_route_exists_in_source"]["evidence"]
        files = {step["file"] for step in route["steps"]}
        self.assertIn("game/ui/screens/hub/tabs/campaign_tab.gd", files)
        self.assertIn("game/app/app_flow.gd", files)

    def test_a8_route_actions_are_unpriced(self) -> None:
        candidate = self.payload["a8_candidate"]
        self.assertEqual(candidate["status"], "S2_CANDIDATE_BLOCKED_ON_A1_A3_A0_OWNER_INTEGRATION")
        self.assertEqual(
            sorted(row["action_id"] for row in candidate["unpriced_actions"]),
            ["brace_east_shelf", "chock_west_ramp"],
        )
        # A third action has a different A3 gap: its source is not bound to the POI.
        self.assertEqual(
            sorted(row["action_id"] for row in candidate["unbound_source_actions"]),
            ["extract_outcrop"],
        )

    def test_every_blocked_link_names_an_owner_and_a_next_action(self) -> None:
        self.assertGreater(self.payload["blocked_link_count"], 0)
        for row in self.payload["blocked_links"]:
            self.assertTrue(row["owner"])
            self.assertTrue(row["next_action"])
            self.assertTrue(row["missing"])


class CommitSeamClassificationTests(unittest.TestCase):
    """The seam is classified from live, mounted code — not from tokens."""

    @classmethod
    def setUpClass(cls) -> None:
        _model, cls.texts, cls.manifest, cls.facts = _inputs()
        cls.payload = _build(cls.texts, cls.facts, cls.manifest)
        cls.seam = cls.payload["commit_seam"]

    def test_mounted_survival_and_campaign_callers_are_found(self) -> None:
        classifications = {row["classification"] for row in self.seam["mounted_callers"]}
        self.assertIn("MOUNTED_SURVIVAL_SYSTEM_CALLER", classifications)
        self.assertIn("MOUNTED_CAMPAIGN_CALLER", classifications)
        self.assertEqual(self.seam["static_state"], "MOUNTED_SURVIVAL_SYSTEM_CALLER")

    def test_no_caller_is_keyed_on_the_a1_contract_yet(self) -> None:
        self.assertNotIn(
            "MOUNTED_A1_CONTRACT_CALLER",
            {row["classification"] for row in self.seam["mounted_callers"]},
        )

    def test_harvest_is_a_real_transactional_grant(self) -> None:
        harvest = next(
            row for row in self.seam["mounted_callers"] if row["function"] == "harvest"
        )
        self.assertEqual(harvest["classification"], "MOUNTED_SURVIVAL_SYSTEM_CALLER")
        self.assertEqual(harvest["mount_state"], "MOUNTED")
        self.assertIn("SURVIVAL_ITEM_GRANT", harvest["context"])

    def test_capability_probes_are_rejected_not_counted(self) -> None:
        reasons = {row["reason"] for row in self.seam["rejected"]}
        self.assertIn("CAPABILITY_PROBE_NOT_A_CALL", reasons)
        probe_lines = {row["line"] for row in self.seam["rejected"] if row["reason"] == "CAPABILITY_PROBE_NOT_A_CALL"}
        caller_lines = {row["line"] for row in self.seam["mounted_callers"]}
        self.assertTrue(probe_lines, "the pinned bytes contain has_method probes")
        # A probe and the real call sit in the same function, on different lines.
        self.assertTrue(caller_lines & {line + 24 for line in probe_lines} or caller_lines)

    def test_raw_tokens_exceed_mounted_callers(self) -> None:
        # The honest denominator: 65 raw occurrences collapse to a handful of
        # real mounted callers, and every rejected one has a stated reason.
        self.assertGreater(self.seam["raw_token_occurrences"], self.seam["mounted_caller_count"])
        self.assertGreater(self.seam["rejected_count"], 0)
        for row in self.seam["rejected"]:
            self.assertTrue(row["reason"])


class AntiSpoofTests(unittest.TestCase):
    """Each case is a way to fake integration. None of them may count."""

    def setUp(self) -> None:
        _model, self.texts, self.manifest, self.facts = _inputs()
        self.baseline = _build(self.texts, self.facts, self.manifest)

    def _spoof(self, key: str, body: str):
        texts = dict(self.texts)
        texts[key] = body
        return _build(texts, self.facts, self.manifest)

    def test_call_in_a_comment_does_not_count(self) -> None:
        payload = self._spoof(
            "a0.chest.gd",
            self.texts["a0.chest.gd"] + "\n# save_service.transact_once(key, mutator)\n",
        )
        self.assertEqual(
            payload["commit_seam"]["mounted_caller_count"], self.baseline["commit_seam"]["mounted_caller_count"]
        )

    def test_call_inside_a_string_literal_does_not_count(self) -> None:
        payload = self._spoof(
            "a0.chest.gd",
            self.texts["a0.chest.gd"]
            + '\nconst HINT := "save_service.call(&\\"transact_once\\", key, mutator)"\n',
        )
        self.assertEqual(
            payload["commit_seam"]["mounted_caller_count"], self.baseline["commit_seam"]["mounted_caller_count"]
        )

    def test_call_in_a_test_file_does_not_count(self) -> None:
        payload = self._spoof(
            "tests/spoof_claim_test.gd",
            "extends Node\nfunc _ready() -> void:\n\tsave_service.transact_once(key, func(c): return true)\n",
        )
        reasons = {row["reason"] for row in payload["commit_seam"]["rejected"]}
        self.assertIn("NON_PRODUCTION_PATH", reasons)
        self.assertEqual(
            payload["commit_seam"]["mounted_caller_count"], self.baseline["commit_seam"]["mounted_caller_count"]
        )

    def test_call_in_an_unmounted_file_does_not_count(self) -> None:
        payload = self._spoof(
            "game/unreferenced_claim.gd",
            "extends Node\nfunc claim() -> void:\n\tsave_service.transact_once(key, func(c): return true)\n",
        )
        reasons = {row["reason"] for row in payload["commit_seam"]["rejected"]}
        self.assertTrue(any(reason.startswith("NOT_MOUNTED") for reason in reasons), reasons)
        self.assertEqual(
            payload["commit_seam"]["mounted_caller_count"], self.baseline["commit_seam"]["mounted_caller_count"]
        )

    def test_call_in_a_function_nothing_calls_does_not_count(self) -> None:
        texts = dict(self.texts)
        texts["a0.survival_service.gd"] += (
            "\n\nfunc _never_referenced_anywhere() -> void:\n"
            "\tsave.call(&\"transact_once\", key, func(candidate): return true)\n"
        )
        payload = _build(texts, self.facts, self.manifest)
        self.assertIn(
            "UNREFERENCED_IN_PINNED_SURFACE", {row["reason"] for row in payload["commit_seam"]["rejected"]}
        )
        self.assertTrue(payload["commit_seam"]["unproven_callers"], "the gate must report what it could not prove")
        self.assertEqual(
            payload["commit_seam"]["mounted_caller_count"], self.baseline["commit_seam"]["mounted_caller_count"]
        )

    def test_has_method_probe_does_not_count(self) -> None:
        texts = dict(self.texts)
        texts["game/unreferenced_probe.gd"] = (
            "extends Node\nfunc _ready() -> void:\n\tprint(save_service.has_method(&\"transact_once\"))\n"
        )
        payload = _build(texts, self.facts, self.manifest)
        self.assertNotIn(
            "MOUNTED_A1_CONTRACT_CALLER",
            {row["classification"] for row in payload["commit_seam"]["mounted_callers"]},
        )


class NativeEvidenceTests(unittest.TestCase):
    """S4 is a door with one key: a green run on the pinned commit."""

    def setUp(self) -> None:
        _model, self.texts, self.manifest, self.facts = _inputs()
        self.manifest = self.manifest
        self.head = str(self.manifest["a0_head"])

    STEP = "New profile through actual menus and full home journey"

    def _evidence(self, head: str, status: str, conclusion: str, phrases, run_id=1, step_state="success"):
        step = {"name": self.STEP, "status": "completed", "conclusion": step_state}
        return {
            "schema": evidence.SCHEMA,
            "runs": [
                {
                    "run_id": run_id,
                    "workflow": "a0-normal-entry-home-restart.yml",
                    "head_sha": head,
                    "status": status,
                    "conclusion": conclusion,
                    "jobs": [
                        {
                            "name": "native-entry-restart",
                            "status": status,
                            "conclusion": conclusion,
                            "steps": [step],
                        }
                    ],
                    "log_phrases": list(phrases),
                }
            ],
        }

    def test_a_green_workflow_whose_proving_step_failed_is_not_evidence(self) -> None:
        # The trap round 4 fell into: the workflow is green, the step that proves the
        # claim is red, so nothing is proven.
        state = self._resolve(
            self._evidence(
                self.head,
                "completed",
                "success",
                ["NORMAL ENTRY HOME RESTART PASSED"],
                step_state="failure",
            )
        )
        self.assertEqual(state["state"], evidence.FAILED)

    def test_a_green_workflow_without_the_step_recorded_is_not_evidence(self) -> None:
        payload = self._evidence(self.head, "completed", "success", ["NORMAL ENTRY HOME RESTART PASSED"])
        payload["runs"][0]["jobs"][0].pop("steps")
        state = self._resolve(payload)
        self.assertEqual(state["state"], evidence.NOT_TESTED)
        self.assertIn("not captured", str(state.get("note")))

    def _resolve(self, payload):
        return evidence.state(payload, "a0_normal_entry_home", self.head)

    def test_queued_run_is_not_evidence(self) -> None:
        state = self._resolve(self._evidence(self.head, "queued", "", []))
        self.assertEqual(state["state"], evidence.QUEUED)
        self.assertFalse(state["phrase_found"])

    def test_green_run_on_another_commit_is_not_evidence(self) -> None:
        state = self._resolve(
            self._evidence("0" * 40, "completed", "success", ["NORMAL ENTRY HOME RESTART PASSED"], run_id=99)
        )
        self.assertEqual(state["state"], evidence.STALE_HEAD)
        self.assertEqual(state["other_commit_runs"][0]["run_id"], 99)

    def test_green_run_without_the_assertion_phrase_is_not_evidence(self) -> None:
        state = self._resolve(self._evidence(self.head, "completed", "success", ["nothing useful"]))
        self.assertEqual(state["state"], evidence.NOT_TESTED)
        self.assertFalse(state["phrase_found"])

    def test_green_run_with_the_phrase_on_this_commit_is_evidence(self) -> None:
        state = self._resolve(
            self._evidence(
                self.head, "completed", "success", ["NORMAL ENTRY HOME RESTART PASSED - 42 checks"], run_id=7
            )
        )
        self.assertEqual(state["state"], evidence.VERIFIED)
        self.assertEqual(state["run_id"], 7)

    def test_failed_run_blocks(self) -> None:
        state = self._resolve(self._evidence(self.head, "completed", "failure", ["NORMAL ENTRY HOME RESTART FAILED"]))
        self.assertEqual(state["state"], evidence.FAILED)

    def test_a_green_run_lifts_the_link_but_not_the_chain_requirement(self) -> None:
        _model, texts, manifest, facts = _inputs()
        payload = _build(
            texts,
            facts,
            manifest,
            self._evidence(
                str(manifest["a0_head"]), "completed", "success", ["NORMAL ENTRY HOME RESTART PASSED"]
            ),
        )
        entry = _link(payload, "waystation_cache", "L1_ENTRY")
        self.assertEqual(entry["level"], "S4_NATIVE_VERIFIED")
        self.assertFalse(entry["blocked"])
        # The content link is still blocked: a green entry run says nothing about mounting.
        self.assertTrue(_link(payload, "waystation_cache", "L2_ROUTE")["blocked"])


class GateClosureTests(unittest.TestCase):
    """A blocker closes only when its own condition (and native proof) is met."""

    def setUp(self) -> None:
        _model, self.texts, self.manifest, self.facts = _inputs()
        self.manifest = self.manifest

    def test_blk1_closes_when_content_is_mounted(self) -> None:
        _model, texts, manifest, facts = _inputs()
        before = _build(texts, facts, manifest)
        self.assertTrue(_link(before, "waystation_cache", "L2_ROUTE")["blocked"])

        texts = dict(texts)
        texts["a0.chapter1_overworld.tscn"] += (
            '\n[node name="WaystationCache" parent="." instance=ExtResource("9_cache")]\n'
            'node_id = "node_waystation_cache"\n'
        )
        after = _build(texts, facts, manifest)
        link = _link(after, "waystation_cache", "L2_ROUTE")
        self.assertFalse(link["blocked"])
        self.assertEqual(link["source_state"], "PRODUCTION_SEAM")
        self.assertEqual(after["entry_claims"]["C_content_is_mounted"]["state"], "SOURCE_PRESENT")

    def test_blk1_needs_a_production_path_not_a_test_harness(self) -> None:
        # The genuine round-5 false positive: A0's own test harness names the node.
        # If a test file could satisfy claim C, the claim would prove nothing.
        _model, texts, manifest, facts = _inputs()
        texts = dict(texts)
        texts["a0.survival_waystation_authority_test.gd"] += (
            '\nconst NODE := "node_waystation_cache"\nconst POI := "poi_crown_waystation"\n'
        )
        paths = product.path_index(manifest)
        paths["a0.survival_waystation_authority_test.gd"] = "tests/survival_waystation_authority_test.gd"
        harness_only = _build(texts, facts, manifest, paths=paths)
        claim_c = harness_only["entry_claims"]["C_content_is_mounted"]
        self.assertNotEqual(claim_c["state"], "SOURCE_PRESENT")
        self.assertTrue(harness_only["entry_content"]["non_production_references"])
        self.assertTrue(_link(harness_only, "waystation_cache", "L2_ROUTE")["blocked"])

    def test_blk1_does_not_close_for_a_comment_mentioning_the_node(self) -> None:
        _model, texts, manifest, facts = _inputs()
        texts = dict(texts)
        texts["a0.chapter1_overworld.tscn"] += "\n; node_waystation_cache planned for later\n"
        after = _build(texts, facts, manifest)
        self.assertTrue(_link(after, "waystation_cache", "L2_ROUTE")["blocked"])

    @staticmethod
    def _five_clause_evidence(head: str):
        """The only thing that may grant S4: five clauses, on the pinned sha."""
        return {
            "schema": evidence.SCHEMA,
            "runs": [
                {
                    "run_id": 11,
                    "workflow": "a0-normal-entry-home-restart.yml",
                    "head_sha": head,
                    "status": "completed",
                    "conclusion": "success",
                    "jobs": [
                        {
                            "name": "native-entry-restart",
                            "status": "completed",
                            "conclusion": "success",
                            "steps": [
                                {
                                    "name": "New profile through actual menus and full home journey",
                                    "status": "completed",
                                    "conclusion": "success",
                                },
                                {
                                    "name": "Independent new Godot process and actual save recovery",
                                    "status": "completed",
                                    "conclusion": "success",
                                },
                            ],
                        }
                    ],
                    "log_phrases": [
                        "NORMAL ENTRY HOME RESTART PASSED",
                        "ENTRY_HOME_SECOND_PROCESS restored",
                    ],
                },
                {
                    "run_id": 12,
                    "workflow": "a0-waystation-input-restart.yml",
                    "head_sha": head,
                    "status": "completed",
                    "conclusion": "success",
                    "jobs": [
                        {
                            "name": "waystation-input-restart",
                            "status": "completed",
                            "conclusion": "success",
                            "steps": [
                                {
                                    "name": "Real Hero input, canonical receipt, and separate process replay",
                                    "status": "completed",
                                    "conclusion": "success",
                                }
                            ],
                        }
                    ],
                    "log_phrases": [
                        "A0 WAYSTATION INPUT RESTART PASSED",
                        "independent-process cache replay during cooldown grants nothing",
                    ],
                },
            ],
        }

    def test_blk4_needs_all_five_s4_clauses(self) -> None:
        _model, texts, manifest, facts = _inputs()
        head = str(manifest["a0_head"])
        texts = dict(texts)
        texts["a0.survival_service.gd"] += (
            "\n\nfunc _ready() -> void:\n"
            "\tclaim_waystation_cache()\n"
            "\n\nfunc claim_waystation_cache() -> void:\n"
            "\tvar key := \"a1slice:poi_crown_waystation:cache_restock:1\"\n"
            "\tsave.call(&\"transact_once\", key, func(candidate: Dictionary) -> bool:\n"
            "\t\tsave.call(&\"add_items_to_candidate\", candidate, \"iron_scrap\", \"material\", 3, {})\n"
            "\t\tcandidate[\"survival\"] = candidate.get(\"survival\", {})\n"
            "\t\treturn true)\n"
        )

        # One green run is not S4: it proves C2 only, and C3/C4/C5 still do not hold.
        partial = self._five_clause_evidence(head)
        partial["runs"] = partial["runs"][:1]
        partial["runs"][0]["jobs"][0]["steps"] = partial["runs"][0]["jobs"][0]["steps"][:1]
        partial["runs"][0]["log_phrases"] = ["NORMAL ENTRY HOME RESTART PASSED"]
        one_run = _build(texts, facts, manifest, partial)
        self.assertEqual(one_run["commit_seam"]["static_state"], "MOUNTED_A1_CONTRACT_CALLER")
        self.assertFalse(one_run["s4"]["s4_granted"])
        self.assertTrue(_link(one_run, "waystation_cache", "L5_COMMIT")["blocked"])

        # A caller alone does not close it either: nothing has run.
        caller_only = _build(texts, facts, manifest, {"schema": evidence.SCHEMA, "runs": []})
        self.assertTrue(_link(caller_only, "waystation_cache", "L5_COMMIT")["blocked"])

        # All five clauses, each proved by its own step and phrase, on the pinned sha.
        both = _build(texts, facts, manifest, self._five_clause_evidence(head))
        self.assertTrue(both["s4"]["s4_granted"])
        self.assertEqual({name for name, clause in both["s4"]["clauses"].items() if clause["state"] == "HOLDS"}, {
            "C1_exact_source_identity",
            "C2_normal_entry",
            "C3_independent_process",
            "C4_authorised_commit",
            "C5_negative_replay",
        })
        link = _link(both, "waystation_cache", "L5_COMMIT")
        self.assertFalse(link["blocked"], link["missing"])
        self.assertEqual(link["level"], "S4_NATIVE_VERIFIED")
        self.assertFalse(both["s4"]["s5_granted"])

    def test_s4_is_never_granted_by_a_fixture_or_this_repository(self) -> None:
        # A7's own artifacts must never claim S4.
        payload = json.loads((support.DATA_DIR / "results" / "gate.json").read_text(encoding="utf-8"))
        self.assertFalse(payload["s4"]["s4_granted"])
        self.assertFalse(payload["s4"]["s5_granted"])
        self.assertNotIn("VERIFIED", {row["state"] for row in payload["native_states"].values()})

    def test_blk5_closes_when_a3_prices_the_two_route_actions(self) -> None:
        _model, texts, manifest, facts = _inputs()
        before = _build(texts, facts, manifest)
        self.assertEqual(len(before["a8_candidate"]["unpriced_actions"]), 2)

        candidate = json.loads(texts["a8.quarry_integration_candidate.v1.json"])
        for row in candidate["actions"]:
            if row.get("cost_quantity") is None:
                row["cost_quantity"] = 1
                row["authorization"] = "AUTHORIZED_BY_A3"
        texts = dict(texts)
        texts["a8.quarry_integration_candidate.v1.json"] = json.dumps(candidate)
        after = _build(texts, facts, manifest)
        self.assertEqual(after["a8_candidate"]["unpriced_actions"], [])
        self.assertNotEqual(_link(after, "a8_quarry", "L4_AUTHORIZATION")["source_state"], "ABSENT")


class BindingTests(unittest.TestCase):
    """A1's numbers are the authority; A3 adopted them without a rate change."""

    def test_a1_authorizes_two_rebinds_and_one_live_reuse(self) -> None:
        model, texts, manifest, facts = _inputs()
        payload = _build(texts, facts, manifest)
        contract = payload["contract"]
        rows = contract["slice_renewable_cache"]
        self.assertEqual([row["yield_per_claim"] for row in rows], [3, 2])
        self.assertTrue(all(row["cooldown_active_seconds"] == 1800 for row in rows))
        adoption = identity.binding_adoption(model, contract)
        self.assertEqual(adoption["rebind_required"], 2)
        self.assertEqual(adoption["rebind_adopted"], 2)
        self.assertEqual(adoption["pending_rebind"], [])
        kinds = {row["binding_kind"] for row in adoption["rows"]}
        self.assertIn("LIVE_SOURCE_REUSE", kinds, "A1 reuses an existing live source for the deadfall")

    def test_research_kit_is_a_workbench_recipe(self) -> None:
        model = support.model()
        self.assertEqual(model.recipes["research_kit"]["station"], "workbench")
        self.assertEqual(model.recipes["research_kit"]["inputs"]["knowledge_spares"], 3)

    def test_two_cache_claims_reach_the_first_station_kit(self) -> None:
        model, texts, manifest, facts = _inputs()
        payload = _build(texts, facts, manifest)
        spares = next(
            row for row in payload["contract"]["slice_renewable_cache"] if row["item_id"] == "knowledge_spares"
        )
        needed = int(model.recipes["research_kit"]["inputs"]["knowledge_spares"])
        self.assertEqual(-(-needed // int(spares["yield_per_claim"])), 2)


if __name__ == "__main__":
    unittest.main()
