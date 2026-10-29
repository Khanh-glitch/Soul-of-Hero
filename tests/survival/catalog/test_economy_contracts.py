"""Executable adversarial checks for A3 catalog contracts and balance model."""
import copy, json, pathlib, subprocess, sys, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools/survival/economy'))
import validate_economy as ve
import simulate_economy as sim

class EconomyContracts(unittest.TestCase):
    def load(self,p): return json.loads((ROOT/'data/survival'/p).read_text())
    def test_current_catalog_passes(self):
        r=subprocess.run([sys.executable,str(ROOT/'tools/survival/economy/validate_economy.py')],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        report=json.loads(r.stdout); self.assertEqual(report['technical_status'],'PASS')
        self.assertEqual(report['contract_reachable_items'],report['counts']['items'])
        self.assertEqual(report['production_cycles'],[])
        self.assertEqual(report['gameplay_design_status'],'NOT_HUMAN_PLAYTESTED')
    def test_reference_and_cycle_rules_are_executable(self):
        items=self.load('items/items.json')['items']; recipes=self.load('recipes/recipes.json')['recipes']
        self.assertIn('ancient_catalyst',items)
        catalyst_recipes=[r for r in recipes.values() if 'ancient_catalyst' in r['inputs']]
        self.assertTrue(catalyst_recipes)
        self.assertFalse(any('ancient_catalyst' in r['outputs'] for r in recipes.values()), 'cultivation/manufacture must not create exploration catalyst')
        for rid,r in recipes.items():
            if r['category']=='cultivation':
                seeds=[i for i in r['inputs'] if i.endswith('_seed')]
                self.assertTrue(seeds)
                for s in seeds: self.assertLessEqual(r['outputs'].get(s,0),r['inputs'][s], 'seed loop cannot multiply seeds for free')
                self.assertTrue(set(r['inputs'])-set(seeds), 'cultivation needs an external sink such as compost')
        for iid,i in items.items():
            if 'salvage' not in i: continue
            # A direct same-item salvage loop would be an infinite exploit.
            self.assertNotIn(iid,i['salvage']['outputs'])
    def test_knowledge_and_physical_objects_are_distinct(self):
        items=self.load('items/items.json')['items']
        for plan in ['plan_venom_core','plan_frost_core','plan_ember_core']:
            self.assertEqual(items[plan]['kind'],'blueprint')
            self.assertIn('unlocks_recipe',items[plan])
            self.assertNotEqual(items[plan]['unlocks_recipe'],items[plan]['id'])
        for core in ['core_venom','core_frost','core_ember']:
            self.assertEqual(items[core]['storage'],'instance')
            self.assertEqual(items[core]['stack_limit'],1)
            self.assertEqual(items[core]['repair_policy'],'reconstruct_only')
            self.assertEqual(items[core]['skill_readiness'],'BLOCKED_PENDING_A4')
            self.assertGreater(items[core]['max_uses'],0)
    def test_existing_ids_preserved(self):
        items=self.load('items/items.json')['items']
        for iid in ['blood_crucible_blueprint','crypt_bone_shard','reaper_essence','venom_spine','soul_ember','fractured_axe_insignia','predator_jaw','oak_wood','stone_chunk','iron_scrap','reed_fibre']:
            self.assertIn(iid,items)
    def test_balance_model_conservation_and_sensitivity(self):
        a=sim.run(30,4,20); b=sim.run(30,4,20,0.75,1.25); c=sim.run(30,4,20,1.25,0.75)
        for r in [a,b,c]:
            self.assertTrue(r['invariants']['no_negative_inventory'])
            self.assertTrue(r['invariants']['farm_never_creates_catalyst'])
            self.assertEqual(r['status'],'MODEL_ONLY_NOT_PLAYTEST')
        self.assertEqual(a,sim.run(30,4,20), 'deterministic replay')
        self.assertGreaterEqual(c['produced']['oak_wood'],a['produced']['oak_wood'])
        self.assertLessEqual(b['produced']['oak_wood'],a['produced']['oak_wood'])
    def test_validator_rejects_unknown_recipe_reference(self):
        # Exercise the validator in an isolated copy by monkeypatching its loader.
        original=ve.load
        def bad(p):
            d=copy.deepcopy(original(p))
            if str(p).endswith('recipes/recipes.json'):
                d['recipes']['burn_charcoal']['inputs']['nonexistent_item']=1
            return d
        ve.load=bad
        try:
            import io,contextlib
            with tempfile.TemporaryDirectory() as td:
                out=pathlib.Path(td)/'r.json'
                old=sys.argv; sys.argv=['validate','--json',str(out)]
                try:
                    with contextlib.redirect_stdout(io.StringIO()): rc=ve.main()
                finally: sys.argv=old
                self.assertEqual(rc,1)
                self.assertTrue(any('unknown item' in e for e in json.loads(out.read_text())['errors']))
        finally: ve.load=original
if __name__=='__main__': unittest.main()

class A1MaterialMapping(unittest.TestCase):
    def test_mapping_covers_27_contracts_and_references_real_a3_items(self):
        m=json.loads((ROOT/'data/survival/items/a1_material_mapping.json').read_text())
        items=json.loads((ROOT/'data/survival/items/items.json').read_text())['items']
        self.assertEqual(m['counts']['a1_materials'],27)
        self.assertEqual(len(m['materials']),27)
        for k,v in m['materials'].items():
            self.assertEqual(v['material_key'],k)
            self.assertIn(v['mapping_status'],['MAPPED_EXISTING','MAPPED_PROPOSED_ALIAS','MISSING_A3_ITEM'])
            for iid in v['a3_item_ids']: self.assertIn(iid,items)
            if v['mapping_status']=='MISSING_A3_ITEM': self.assertEqual(v['a3_item_ids'],[])
            else: self.assertTrue(v['a3_item_ids'])
            self.assertEqual(v['a1_contract']['status'],'CONTRACT_NOT_SPAWNED')
        self.assertEqual(m['counts']['missing_a3_item'],12)
