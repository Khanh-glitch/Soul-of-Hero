"""Executable V7 two-layer meta-economy policy contracts (not a playtest)."""
import copy, json, pathlib, unittest
import jsonschema
ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/survival'

def load(p): return json.loads((DATA / p).read_text())

class MetaEconomyPolicyContracts(unittest.TestCase):
    def setUp(self):
        self.doc = load('recipes/meta_economy.v1.json')
        self.schema = load('recipes/meta_economy.schema.json')
        self.items = load('items/items.json')['items']
        self.policy = self.doc['policy']

    def test_schema_and_creator_locks(self):
        jsonschema.validate(self.doc, self.schema)
        locked = self.policy['creator_locked']
        self.assertEqual(locked['run_max_seconds'], 14 * 24 * 3600)
        self.assertEqual(locked['ragnarok_last_seconds'], 72 * 3600)
        self.assertEqual(locked['ragnarok_start_elapsed_seconds'], 11 * 24 * 3600)
        self.assertEqual(locked['elder_region_count'], 6)
        self.assertTrue(locked['physical_deposit_required'])
        self.assertTrue(locked['no_core_vendor'])
        self.assertEqual(self.policy['rate_approval'], 'AI_TUNABLE_NOT_CREATOR_LOCKED')

    def test_currency_is_physical_unique_token_not_spares(self):
        cid = self.policy['technical_ids']['physical_currency_item']
        self.assertEqual(cid, 'ragnarok_unbanked')
        self.assertEqual(self.items[cid]['storage'], 'instance')
        self.assertEqual(self.items[cid]['kind'], 'key_item')
        self.assertIn('meta_currency', self.items[cid]['tags'])
        self.assertNotEqual(cid, 'knowledge_spares')
        self.assertEqual(self.policy['technical_ids']['profile_balance_field'], 'profile.secured_ragnarok_currency')

    def test_six_stones_are_not_currency_or_vendor_goods(self):
        stones = self.policy['elder_stones']
        self.assertEqual(len(stones), 6)
        self.assertEqual(len({s['stone_id'] for s in stones}), 6)
        for s in stones:
            self.assertEqual(s['currency_value'], 0)
            self.assertFalse(s['vendor_purchasable'])
            self.assertTrue(s['profile_achievement'])

    def test_vendor_no_core_high_tier_or_free_spawn_kit(self):
        for m in self.policy['vending_machines']:
            for iid, offer in m['stock'].items():
                self.assertIn(iid, self.items)
                self.assertNotIn(self.items[iid]['kind'], ['skill_core', 'key_item'])
                self.assertLessEqual(self.items[iid]['tier'], 2)
                self.assertGreaterEqual(offer['unit_price'], 1)
                self.assertGreaterEqual(offer['quantity'], 0)

    def test_recycler_never_emits_profile_currency(self):
        for iid, entry in self.policy['recycler_salvage'].items():
            self.assertEqual(entry['profile_currency_delta'], 0)
            for out in entry['outputs']:
                self.assertIn(out, self.items)
                self.assertNotIn('meta_currency', self.items[out].get('tags', []))

    def test_schema_rejects_core_vendor_cash_recycler_and_short_run(self):
        for path, value in [
            (['policy', 'creator_locked', 'run_max_seconds'], 86400),
            (['policy', 'creator_locked', 'no_core_vendor'], False),
            (['policy', 'rate_approval'], 'USER_LOCKED'),
            (['policy', 'recycler_salvage', 'binding_cloth', 'profile_currency_delta'], 1),
        ]:
            bad = copy.deepcopy(self.doc)
            cursor = bad
            for key in path[:-1]: cursor = cursor[key]
            cursor[path[-1]] = value
            with self.assertRaises(jsonschema.ValidationError, msg=str(path)):
                jsonschema.validate(bad, self.schema)

    def test_display_names_are_separate_working_titles(self):
        display = load('items/meta_display_names.v1.json')
        self.assertEqual(display['working_title_status'], 'WORKING_TITLE_NOT_CREATOR_CANON')
        self.assertEqual(display['unverified_speech_status'], 'NOT_CANONICAL_NOT_AN_ITEM_ID')
        self.assertIn('currency.ragnarok_unbanked', display['entries'])
        self.assertGreaterEqual(len(display['alternatives_considered']), 4)

class MetaStateSchemaContracts(unittest.TestCase):
    def setUp(self):
        self.schema = load('recipes/state.schema.json')
        self.base = {'schema': 2, 'instances': {}, 'jobs': {}, 'technologies': {}, 'commands': {}, 'counter': 0,
                     'time': {'latest_session_index': -1, 'session_id': '', 'sequence': -1, 'stations': {}}}

    def test_legacy_save_without_meta_still_valid(self):
        jsonschema.validate(self.base, self.schema)

    def test_meta_namespace_validates(self):
        doc = copy.deepcopy(self.base)
        doc['meta'] = {'schema': 1, 'run_id': 'run-v7', 'policy_sha256': '0' * 64,
                       'source_claims': {}, 'deposits': {}, 'vendor_stock': {}, 'purchases': {}, 'recycles': {}}
        jsonschema.validate(doc, self.schema)

    def test_meta_rejects_unknown_fields(self):
        doc = copy.deepcopy(self.base)
        doc['meta'] = {'schema': 1, 'run_id': 'run-v7', 'policy_sha256': '0' * 64,
                       'source_claims': {}, 'deposits': {}, 'vendor_stock': {}, 'purchases': {}, 'recycles': {}, 'wallet': 5}
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(doc, self.schema)
