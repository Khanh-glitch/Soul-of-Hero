"""Executable V6 offline-policy / state-schema contracts (not a playtest)."""
import copy, json, pathlib, unittest
import jsonschema
ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/survival'

def load(p): return json.loads((DATA / p).read_text())

class OfflinePolicyContracts(unittest.TestCase):
    def setUp(self):
        self.doc = load('recipes/offline_operations.v1.json')
        self.schema = load('recipes/offline_operations.schema.json')
        self.recipes = load('recipes/recipes.json')['recipes']
        self.techs = load('recipes/research.json')['technologies']
        self.sources = load('items/sources.json')['sources']
        self.bindings = {b['binding_id'] for b in load('items/world_source_bindings.v3.json')['bindings']}

    def test_policy_schema_and_references(self):
        jsonschema.validate(self.doc, self.schema)
        p = self.doc['policy']
        for rid in p['eligible_craft_recipes']:
            self.assertIn(rid, self.recipes)
            self.assertNotIn(self.recipes[rid]['category'], p['ineligible_categories'])
        for rid in p['eligible_research_recipes']:
            self.assertIn(rid, self.recipes)
        for tid in p['eligible_technologies']:
            self.assertIn(tid, self.techs)
        for bid in p['active_only_sources_unchanged']:
            self.assertIn(bid, self.bindings)

    def test_no_crop_collector_core_or_automation(self):
        p = self.doc['policy']
        self.assertFalse(p['auto_collect'])
        self.assertFalse(p['auto_start_next_queue'])
        self.assertIn('core', p['ineligible_categories'])
        self.assertIn('reconstruction', p['ineligible_categories'])
        self.assertTrue(p['cultivation']['status'].startswith('DISABLED_'))
        self.assertTrue(p['collectors']['status'].startswith('DISABLED_'))
        for rid in p['eligible_craft_recipes']:
            self.assertNotIn(self.recipes[rid]['category'], ['cultivation', 'core', 'reconstruction'])
        self.assertEqual(p['run_deadline_seconds'], 14 * 24 * 3600)
        self.assertEqual(p['user_rate_approval'], 'NOT_USER_LOCKED')

    def test_schema_rejects_rate_lock_automation_and_short_run(self):
        for path, value in [
            (['policy', 'user_rate_approval'], 'USER_LOCKED'),
            (['policy', 'auto_collect'], True),
            (['policy', 'auto_start_next_queue'], True),
            (['policy', 'run_deadline_seconds'], 86400),
            (['policy', 'operation_tick_microseconds'], 16666),
            (['policy', 'max_armed_operations'], 257),
        ]:
            bad = copy.deepcopy(self.doc)
            cursor = bad
            for key in path[:-1]: cursor = cursor[key]
            cursor[path[-1]] = value
            with self.assertRaises(jsonschema.ValidationError, msg=str(path)):
                jsonschema.validate(bad, self.schema)

class OfflineStateSchemaContracts(unittest.TestCase):
    def setUp(self):
        self.schema = load('recipes/state.schema.json')
        self.base = {'schema': 2, 'instances': {}, 'jobs': {}, 'technologies': {}, 'commands': {}, 'counter': 0,
                     'time': {'latest_session_index': -1, 'session_id': '', 'sequence': -1, 'stations': {}}}
        self.arm = {'job_id': 'job_000001', 'run_id': 'run-v6', 'station_id': 'furnace', 'station_revision': 'rev-1',
                    'armed_at_unix': 1800000000, 'last_settled_unix': 1800000000, 'tick_microseconds': 1000000,
                    'duration_ticks': 12, 'elapsed_at_arm': 0,
                    'policy_sha256': '0' * 64, 'escrow_sha256': '1' * 64}

    def test_legacy_save_without_offline_still_valid(self):
        jsonschema.validate(self.base, self.schema)

    def test_offline_namespace_validates(self):
        doc = copy.deepcopy(self.base)
        doc['offline'] = {'schema': 1, 'run_id': 'run-v6', 'last_authenticated_unix': 1800000000,
                          'last_projection_sequence': 1, 'armed': {'job_000001': self.arm}}
        jsonschema.validate(doc, self.schema)

    def test_offline_rejects_unknown_fields_floats_and_bad_tick(self):
        doc = copy.deepcopy(self.base)
        doc['offline'] = {'schema': 1, 'run_id': 'run-v6', 'last_authenticated_unix': 1800000000,
                          'last_projection_sequence': 1, 'armed': {'job_000001': self.arm}}
        bad = copy.deepcopy(doc); bad['offline']['extra'] = 1
        with self.assertRaises(jsonschema.ValidationError): jsonschema.validate(bad, self.schema)
        bad = copy.deepcopy(doc); bad['offline']['armed']['job_000001']['tick_microseconds'] = 16666
        with self.assertRaises(jsonschema.ValidationError): jsonschema.validate(bad, self.schema)
        bad = copy.deepcopy(doc); bad['offline']['armed']['job_000001']['policy_sha256'] = 'xyz'
        with self.assertRaises(jsonschema.ValidationError): jsonschema.validate(bad, self.schema)
        bad = copy.deepcopy(doc); bad['offline']['last_authenticated_unix'] = -1
        with self.assertRaises(jsonschema.ValidationError): jsonschema.validate(bad, self.schema)

if __name__ == '__main__':
    unittest.main()
