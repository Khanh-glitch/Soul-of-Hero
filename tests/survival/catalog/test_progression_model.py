"""Product-facing progression model negatives/sensitivities.

These tests do NOT approve gameplay balance. They prove the separate model keeps
its scarcity, route, inventory, one-time discovery, knowledge-choice and
unresolved-alias boundaries while the older technical conservation fixture stays
unchanged.
"""
import copy, hashlib, json, pathlib, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/survival/economy'))
import model_progression as mp


class ProgressionModelContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.inp = mp.load_inputs()
        cls.audit = mp.run_all(inputs=cls.inp)
        cls.baseline = cls.audit['baseline']

    def test_config_rejects_unapproved_alias_as_confirmed_source(self):
        bad = copy.deepcopy(self.inp)
        bad['config']['product_sources'].append({
            'source_id': 'bad_frost_resin', 'binding_status': 'CONFIRMED_DIRECT_MAPPING_PROVISIONAL_WORLD',
            'a1_material_key': 'frost_resin', 'item_id': 'frost_shard', 'yield_per_claim': 1,
            'risk': 'low', 'requires_capabilities': [], 'requires_items': [], 'one_time': False,
        })
        with self.assertRaises(mp.ModelError):
            mp.validate_config(bad)

    def test_roadside_loot_is_not_rare_core_flood(self):
        road = self.inp['loot']['roadside_cache']
        for entry in road['entries']:
            item = self.inp['items'][entry['item_id']]
            self.assertNotEqual(item['kind'], 'skill_core')
            self.assertNotIn('exploration_only', item.get('tags', []))
        specimens = [s for s in self.inp['config']['product_sources'] if s.get('item_id', '').startswith('core_')]
        self.assertEqual(len(specimens), 3)
        for s in specimens:
            self.assertTrue(s['one_time'])
            self.assertEqual(s['discovery_chance'], 1.0)
        self.assertLessEqual(sum(1 for d in self.baseline['summary']['specimen_discovery_events'] if d['session'] == 1), 1)
        self.assertLessEqual(len(self.baseline['summary']['specimen_discovery_events']), 3)

    def test_technical_conservation_fixture_is_preserved(self):
        refs = self.inp['config']['source_refs']['preserved_technical_fixture']
        for rel, digest in refs.items():
            path = ROOT / ('tools/survival/economy/' + rel if rel.endswith('.py') else 'docs/survival/economy/' + rel)
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest, rel)
        old = json.loads((ROOT / 'docs/survival/economy/balance_report.json').read_text())['baseline']
        self.assertEqual(sum(old['loot_instances'].values()), 156)
        self.assertEqual(old['cores_built'], 0)
        self.assertEqual(old['finite_cast_uses_created'], 0)
        self.assertEqual(old['status'], 'MODEL_ONLY_NOT_PLAYTEST')

    def test_deterministic_replay_and_invariants(self):
        again = mp.run_scenario('baseline', inputs=self.inp)
        self.assertEqual(again, self.baseline)
        for name, report in self.audit['scenarios'].items():
            self.assertEqual(report['technical_status'], 'PASS', name)
            self.assertTrue(all(report['invariants'].values()), (name, report['invariants']))
            self.assertEqual(report['status'], 'SIMULATION_ONLY_SOH_DESIGN_PROPOSAL')
            self.assertEqual(report['gameplay_design_status'], 'NOT_HUMAN_PLAYTESTED')
            self.assertEqual(report['summary']['native_casts_executed'], 0)

    def test_finite_inventory_and_no_alias_items(self):
        for snap in self.baseline['per_session']:
            self.assertLessEqual(snap['bag_slots_used'], 30)
            self.assertLessEqual(snap['home_slots_used'], snap['home_capacity'])
            for iid in list(snap['bag_inventory']) + list(snap['home_inventory']):
                self.assertNotIn(iid, ['frost_resin', 'venom_sac', 'peat'])

    def test_use_store_sacrifice_are_distinct(self):
        use = self.audit['scenarios']['use_now']
        store = self.audit['scenarios']['store_all']
        research = self.audit['scenarios']['research_first']
        self.assertFalse(any(d['decision'] == 'SACRIFICE' for d in use['core_decisions']))
        self.assertFalse(any(d['decision'] == 'SACRIFICE' for d in store['core_decisions']))
        self.assertTrue(any(d['decision'] == 'SACRIFICE' for d in research['core_decisions']))
        self.assertEqual(use['summary']['cores_manufactured']['core_ember'], 0)
        self.assertEqual(store['summary']['cores_manufactured']['core_ember'], 0)
        self.assertGreaterEqual(research['summary']['cores_manufactured']['core_ember'], 1)
        self.assertTrue(any(d['decision'] == 'USE_CANDIDATE' and d['native_casts_executed'] == 0 for d in use['core_decisions']))
        self.assertTrue(any(d['decision'] == 'SACRIFICE' for d in self.baseline['core_decisions']))
        self.assertEqual(self.baseline['summary']['cores_manufactured']['core_ember'], 1)
        self.assertEqual(self.baseline['summary']['finite_cast_uses_created_by_manufacture'], 8)

    def test_manufacture_requires_catalyst_and_knowledge(self):
        dry = mp.run_scenario('baseline', {'rare_chance_scale': 0.0}, inputs=self.inp)
        self.assertEqual(dry['summary']['catalyst_successes'], 0)
        self.assertEqual(dry['summary']['cores_manufactured']['core_ember'], 0)
        self.assertTrue(dry['invariants']['manufacture_requires_catalyst'])
        self.assertGreaterEqual(dry['summary']['catalyst_attempts'], 1)

    def test_lost_specimen_retains_knowledge_and_home(self):
        lost = self.audit['scenarios']['lost_specimen']
        self.assertGreaterEqual(lost['summary']['deaths'], 1)
        self.assertTrue(any(x['item_id'] == 'core_frost' and x['location'] == 'lost_on_death' for x in lost['summary']['lost_instances']))
        self.assertTrue(lost['invariants']['knowledge_retained_on_death'])
        self.assertEqual(lost['summary']['cores_manufactured']['core_frost'], 0)
        self.assertIsNotNone(lost['firsts'].get('discovery:core_frost'))

    def test_sensitivity_delays_or_blocks_milestones(self):
        base_first = self.baseline['firsts']
        limited = self.audit['scenarios']['limited_playtime']
        poor = self.audit['scenarios']['poor_loot']
        failed = self.audit['scenarios']['failed_expeditions']
        shortage = self.audit['scenarios']['material_shortage']
        self.assertGreater(limited['firsts']['discovery:core_ember'], base_first['discovery:core_ember'])
        self.assertIsNone(limited['firsts'].get('manufacture:core_ember'))
        self.assertGreater(poor['firsts']['discovery:core_ember'], base_first['discovery:core_ember'])
        self.assertIsNone(poor['firsts'].get('manufacture:core_ember'))
        self.assertGreater(failed['summary']['deaths'], self.baseline['summary']['deaths'])
        self.assertEqual(shortage['summary']['cores_manufactured']['core_ember'], 0)

    def test_unprepared_route_aborts_and_late_aliases_stay_blocked(self):
        rush = mp.run_scenario('rush_east_unprepared', inputs=self.inp)
        self.assertTrue(any(r['outcome'] == 'abort_unprepared_hazard' for r in rush['route_choices']))
        self.assertNotIn('cap_boat', self.baseline['summary']['capabilities'])
        self.assertNotIn('cap_seal_3', self.baseline['summary']['capabilities'])
        self.assertGreater(self.baseline['bottlenecks'].get('capability_material_unresolved:cap_boat', 0), 0)
        self.assertGreaterEqual(self.baseline['remaining_late_goal_count'], 3)
        for goal in self.baseline['late_goals']:
            if goal['status'] == 'REMAINING_GOAL':
                self.assertTrue(goal['missing_or_unresolved_materials'] or set(goal['required_capabilities']) - set(self.baseline['summary']['capabilities']))

    def test_one_time_sources_and_no_offline_progress(self):
        self.assertTrue(self.baseline['invariants']['one_time_sources_not_repeated'])
        model = mp.ProgressionModel('baseline', {'sessions': 2, 'minutes': 5}, inputs=self.inp)
        report = model.run()
        self.assertTrue(all(report['invariants'].values()))
        # With only 5 active minutes, the model must not manufacture a Core or
        # complete the late frontier by offline catch-up.
        self.assertEqual(report['summary']['cores_manufactured']['core_ember'], 0)
        self.assertLessEqual(len(report['summary']['specimen_discovery_events']), 1)


if __name__ == '__main__':
    unittest.main()
