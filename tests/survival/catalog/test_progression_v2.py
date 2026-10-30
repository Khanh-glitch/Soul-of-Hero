"""A3 product-model V2 regressions: A1 source reconciliation, sparse time,
hazard access != mitigation, and adversity/decision consequences.

These are SIMULATION_ONLY contract tests. They do not approve balance, native
world integration, A4 Gold casts, or human playtest.
"""
import json, pathlib, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/survival/economy'))
import model_progression as mp


class ProgressionV2Contracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inp = mp.load_inputs()
        cls.audit = mp.run_all(inputs=cls.inp)
        cls.baseline = cls.audit['baseline']
        cls.cfg = cls.inp['config']
        cls.adoption = cls.inp['adoption']

    def test_source_adoption_is_explicit_and_does_not_catalog_aliases(self):
        items = self.inp['items']
        adopted = self.adoption['adopted_source_transformations']
        self.assertEqual(len(adopted), 2)
        for a in adopted:
            self.assertIn(a['a3_item_id'], items)
            self.assertTrue(a['a1_site_status'].startswith('APPROVE_SOURCE_SPECIFIC'))
            self.assertTrue(a['status'].startswith('ADOPTED_SOURCE_SPECIFIC'))
        rejected = {a['material_key'] for a in self.adoption['rejected_global_aliases']}
        self.assertTrue({'frost_resin', 'venom_sac', 'peat', 'hardwood'} <= rejected)
        for a in self.adoption['proposed_catalog_additions']:
            self.assertNotIn(a['proposed_item_id'], items)
            self.assertEqual(a['status'], 'PROPOSED_NOT_CATALOGGED')
        for missing in self.adoption['missing_items']:
            self.assertNotIn(missing['material_key'], items)
        for src in self.cfg['product_sources']:
            if src.get('a1_material_key') in rejected and not src.get('binding_status', '').startswith('SUPERSEDED'):
                self.assertTrue(src.get('adoption_ref'), src['source_id'])

    def test_novice_first_hour_uses_a1_actions_not_roadside_bootstrap(self):
        events = self.baseline['novice_bootstrap_events']
        self.assertEqual([e['action_id'] for e in events],
                         ['waystation_locker', 'waystation_ledger', 'relay_hand_crank', 'apothecary_filter_lesson'])
        self.assertEqual([e['poi_id'] for e in events],
                         ['poi_crown_waystation', 'poi_crown_waystation', 'poi_crown_relay_shed', 'poi_amberwood_apothecary'])
        relay = next(e for e in events if e['action_id'] == 'relay_hand_crank')
        self.assertEqual(relay['costs'], {'iron_scrap': 2, 'oak_wood': 1})
        filter_lesson = next(e for e in events if e['action_id'] == 'apothecary_filter_lesson')
        self.assertEqual(filter_lesson['costs'], {'moonleaf': 1, 'reed_fibre': 1})
        self.assertNotIn('early_roadside_salvage', self.baseline['summary'].get('claimed_sources', []))
        for cap in ['cap_salvage', 'cap_seal_1', 'cap_power_1', 'cap_filter']:
            self.assertIn(cap, self.baseline['summary']['capabilities'])
        self.assertEqual(self.cfg['capability_bootstrap']['craft_grants'], {})
        self.assertEqual(self.cfg['capability_bootstrap']['source_grants'], {})

    def test_hazard_access_capability_is_not_full_mitigation(self):
        model = mp.ProgressionModel('baseline', inputs=self.inp)
        before = model._resistance_coverage('hz_crown_heat')
        self.assertFalse(before['ready'])
        model.caps.add('cap_filter')
        after = model._resistance_coverage('hz_crown_heat')
        self.assertTrue(after['ready'])
        self.assertLess(after['mitigation_fraction_proposal'], 1.0)
        self.assertEqual(after['capability'], 'cap_filter')
        # toxin_mask venom:60 must not be silently treated as heat/acid_gas/poison coverage.
        model.equipment['toxin_mask'] = {'condition': 100}
        mask = model._resistance_coverage('hz_crown_heat')
        self.assertNotIn('toxin_mask', mask['items'])
        edge = next(e for e in self.cfg['route_network']['edges'] if e['route_id'] == 'rt_east_seam')
        self.assertIn('cap_filter', edge['required_capabilities'])

    def test_session_time_is_sparse_and_not_padded(self):
        t = self.baseline['time_accounting']
        self.assertEqual(t['status'], 'SPARSE_SCENARIO_MODEL')
        self.assertGreater(t['unused_budget_seconds'], 0)
        self.assertEqual(t['combat_seconds_modeled'], 0)
        self.assertEqual(t['player_decision_seconds_modeled'], 0)
        self.assertTrue(t['station_work_overlaps_player_actions'])
        for s in self.baseline['per_session']:
            self.assertEqual(s['active_modeled_seconds'] + s['unused_budget_seconds'], s['scheduled_budget_seconds'])
            self.assertGreaterEqual(s['active_modeled_seconds'], 0)
            self.assertGreaterEqual(s['station_work_seconds'], 0)
            self.assertTrue(s['sparse_scenario_model'])
        self.assertTrue(t['required_native_and_human_evidence'])

    def test_early_loss_targeted_fallback_costs_resources_not_free_core(self):
        no_fallback = self.audit['scenarios']['early_loss_no_fallback']
        fallback = self.audit['scenarios']['early_loss_targeted_fallback']
        self.assertFalse(any(d['decision'] == 'TARGETED_RESEARCH_AFTER_LOSS' for d in no_fallback['core_decisions']))
        decisions = [d for d in fallback['core_decisions'] if d['decision'] == 'TARGETED_RESEARCH_AFTER_LOSS']
        self.assertTrue(decisions)
        self.assertEqual(decisions[0]['cost'], {'knowledge_spares': 6, 'research_notes': 2})
        # V3 canonical cache is renewable (2 Spares / 1800 active s), so the paid
        # targeted fallback can now fund a real manufacture. It is still not a
        # free Core: require the physical blank/charge path and zero native casts.
        manufactured = fallback['summary']['cores_manufactured']['core_ember']
        self.assertLessEqual(manufactured, 1)
        if manufactured:
            self.assertGreaterEqual(fallback['summary']['crafted'].get('core_blank', 0), 1)
            self.assertGreaterEqual(fallback['summary']['crafted'].get('charge_blank', 0), 1)
        self.assertEqual(fallback['summary']['native_casts_executed'], 0)
        self.assertGreaterEqual(fallback['summary']['deaths'], 1)

    def test_blocked_safe_route_forces_longer_path_not_invented_permission(self):
        blocked = self.audit['scenarios']['safe_route_blocked']
        self.assertNotIn('rt_crown_safe_approach', json.dumps(blocked.get('route_choices', [])))
        self.assertGreaterEqual(blocked['time_accounting']['active_modeled_seconds'],
                                self.baseline['time_accounting']['active_modeled_seconds'])
        self.assertEqual(blocked['technical_status'], 'PASS')

    def test_queue_interruption_persists_debt_without_free_completion(self):
        q = self.audit['scenarios']['queue_interruption']
        self.assertTrue(any(k.startswith('station_paused:') for k in q['bottlenecks']))
        self.assertIsNone(q['firsts'].get('manufacture:core_ember'))
        self.assertTrue(q['invariants']['one_time_sources_not_repeated'])

    def test_catalyst_drought_blocks_manufacture(self):
        dry = self.audit['scenarios']['catalyst_drought']
        self.assertEqual(dry['summary']['catalyst_successes'], 0)
        self.assertEqual(dry['summary']['cores_manufactured']['core_ember'], 0)
        self.assertGreaterEqual(dry['summary']['catalyst_attempts'], 1)
        self.assertTrue(dry['invariants']['manufacture_requires_catalyst'])

    def test_decision_analysis_keeps_native_casts_zero_and_names_missing_evidence(self):
        d = self.baseline['decision_analysis']
        self.assertEqual(d['native_casts_executed'], 0)
        self.assertTrue(d['fair_use_vs_sacrifice_comparison']['not_yet_fair'])
        self.assertEqual(set(d['alternatives']), {'USE', 'STORE', 'SACRIFICE'})
        self.assertTrue(d['fair_use_vs_sacrifice_comparison']['required'])
        self.assertEqual(self.baseline['summary']['native_casts_executed'], 0)


if __name__ == '__main__':
    unittest.main()
