"""Executable V7 336h meta-balance model invariants (not a playtest)."""
import json, pathlib, subprocess, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[3]

class MetaBalanceModel(unittest.TestCase):
    def run_model(self):
        r = subprocess.run([sys.executable, str(ROOT/'tools/survival/economy/model_meta_economy.py')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        return json.loads(r.stdout)

    def test_no_universal_dominance_and_creator_locks(self):
        report = self.run_model()
        self.assertEqual(report['run_hours'], 336)
        self.assertEqual(report['ragnarok_last_hours'], 72)
        self.assertEqual(report['universally_dominant_strategies'], [])
        self.assertTrue(report['no_universal_dominance'])
        self.assertEqual(report['rate_approval'], 'AI_TUNABLE_NOT_CREATOR_LOCKED')
        self.assertEqual(len(report['baseline']), 7)
        self.assertGreaterEqual(len(report['sensitivity']), 5)

    def test_currency_route_trades_power_for_next_run_agency(self):
        report = self.run_model()
        by = {s['strategy']: s for s in report['baseline']}
        self.assertGreater(by['currency_scavenging']['expected_banked_currency'], by['home_production']['expected_banked_currency'])
        self.assertGreater(by['home_production']['run_local_power_proxy'], by['currency_scavenging']['run_local_power_proxy'])
        self.assertGreater(by['free_exploration']['rare_core_discovery_probability_proxy'], by['currency_scavenging']['rare_core_discovery_probability_proxy'])
        for s in report['baseline']:
            self.assertEqual(s['profile_delta'] if 'profile_delta' in s else 0, 0)
