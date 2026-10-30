#!/usr/bin/env python3
"""Deterministic 336-hour two-layer economy scenario/sensitivity model.
AI_TUNABLE defaults; NOT a human playtest, NOT creator-locked prices/probabilities.
"""
from __future__ import annotations
import argparse, json, pathlib, math
ROOT = pathlib.Path(__file__).resolve().parents[3]
POLICY = ROOT / 'data/survival/recipes/meta_economy.v1.json'

def load(): return json.loads(POLICY.read_text())['policy']

def expected_units(source, chance_mult=1.0):
    chance = min(1.0, source['drop_chance'] * chance_mult)
    avg = (source['min_units'] + source['max_units']) / 2.0
    return chance * avg * source['max_claims_per_run']

def scenario(policy, name, chance_mult=1.0, travel_mult=1.0, price_mult=1.0):
    sources = policy['currency_sources']
    elder = [s for s in sources if s['kind'] == 'awakened_elder_territory']
    roadside = [s for s in sources if s['kind'] == 'rare_last72_site_treasure']
    elder_expected = sum(expected_units(s, chance_mult) for s in elder)
    road_expected = sum(expected_units(s, chance_mult) for s in roadside)
    elder_travel = sum(s['travel_round_trip_hours'] * s['max_claims_per_run'] * travel_mult for s in elder)
    road_travel = sum(s['travel_round_trip_hours'] * s['max_claims_per_run'] * travel_mult for s in roadside)
    bank_factor = {'home_production': 0.0, 'free_exploration': 0.15, 'combat_poi': 0.45, 'currency_scavenging': 0.8, 'one_stone': 0.35, 'evacuation': 0.5, 'six_stone': 0.7}[name]
    risk_loss = {'home_production': 0.0, 'free_exploration': 0.05, 'combat_poi': 0.2, 'currency_scavenging': 0.25, 'one_stone': 0.3, 'evacuation': 0.15, 'six_stone': 0.35}[name]
    gross = (elder_expected + road_expected) * bank_factor
    banked = gross * (1.0 - risk_loss)
    travel = (elder_travel + road_travel) * bank_factor
    meal_price = min(m['stock']['field_meal']['unit_price'] for m in policy['vending_machines']) * price_mult
    kit_price = max(m['stock'].get('research_kit', {}).get('unit_price', 0) for m in policy['vending_machines']) * price_mult
    run_local_power = {'home_production': 8.0, 'free_exploration': 6.5, 'combat_poi': 7.5, 'currency_scavenging': 4.0, 'one_stone': 6.0, 'evacuation': 5.0, 'six_stone': 7.0}[name]
    core_discovery = {'home_production': 0.1, 'free_exploration': 0.55, 'combat_poi': 0.4, 'currency_scavenging': 0.2, 'one_stone': 0.3, 'evacuation': 0.25, 'six_stone': 0.35}[name]
    return {
        'strategy': name, 'expected_gross_currency': round(gross, 3), 'expected_banked_currency': round(banked, 3),
        'currency_travel_hours': round(travel, 2), 'risk_adjusted_yield_per_travel_hour': round(banked / max(0.1, travel), 3),
        'meals_affordable_next_run': int(banked // max(1, meal_price)), 'research_kits_affordable_next_run': int(banked // max(1, kit_price)),
        'run_local_power_proxy': run_local_power, 'rare_core_discovery_probability_proxy': core_discovery,
        'opportunity_cost_note': 'Currency route trades run-local power/Core discovery for next-run agency.',
        'loss_recovery': 'Unbanked tokens lost on death/reset; secured balance persists only after deposit.',
    }

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--json', type=pathlib.Path); args = ap.parse_args()
    policy = load()
    names = ['home_production', 'free_exploration', 'combat_poi', 'currency_scavenging', 'one_stone', 'evacuation', 'six_stone']
    baseline = [scenario(policy, n) for n in names]
    sensitivity = []
    for label, cm, tm, pm in [('drop_minus_50', 0.5, 1, 1), ('drop_plus_50', 1.5, 1, 1), ('travel_plus_50', 1, 1.5, 1), ('prices_plus_50', 1, 1, 1.5), ('prices_minus_50', 1, 1, 0.5)]:
        sensitivity.append({'case': label, 'scenarios': [scenario(policy, n, cm, tm, pm) for n in names]})
    dominance = []
    for s in baseline:
        dominates = all(
            s['expected_banked_currency'] >= o['expected_banked_currency'] and
            s['run_local_power_proxy'] >= o['run_local_power_proxy'] and
            s['rare_core_discovery_probability_proxy'] >= o['rare_core_discovery_probability_proxy']
            for o in baseline if o['strategy'] != s['strategy'])
        if dominates: dominance.append(s['strategy'])
    report = {
        'schema': 'soh.economy.meta_balance_model.v1', 'policy_id': policy['policy_id'], 'policy_revision': policy['policy_revision'],
        'run_hours': 336, 'ragnarok_last_hours': 72, 'rate_approval': policy['rate_approval'],
        'evidence_level': 'DETERMINISTIC_MODEL_ONLY_NOT_HUMAN_PLAYTEST',
        'baseline': baseline, 'sensitivity': sensitivity,
        'universally_dominant_strategies': dominance,
        'no_universal_dominance': len(dominance) == 0,
        'creator_locked': policy['creator_locked'],
        'assumptions': [
            'Expected value uses policy drop_chance and min/max units; no fabricated human telemetry.',
            'bank_factor/risk_loss/run_local_power/core_discovery are explicit AI_TUNABLE scenario proxies, not measured play.',
            'Vendor affordability uses secured balance only; no free spawn kit or Core vendor.',
            'Six stones are profile achievements with zero currency value and no money multiplier.',
        ],
    }
    if args.json: args.json.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 0 if report['no_universal_dominance'] else 1

if __name__ == '__main__': raise SystemExit(main())
