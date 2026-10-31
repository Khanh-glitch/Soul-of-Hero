#!/usr/bin/env python3
"""Source pin and policy cross-check, not a native/player journey."""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
PINS = {
    'game/survival/economy/vendor/a3_economy_service.gd': '109c268036bb92e5dcca2d23ec5f5c1664e1f8645c01abf189d6b5c90f06302c',
    'game/survival/economy/world_source_adapter.gd': '8bab244159e17acc34d51a22ab05112090e4f08f146511aa5c61683c7d999a47',
    'data/survival/items/items.json': 'cd1a27c48078a69489904e86182dc63750941d9fc296830f711dd5d574615520',
    'data/survival/items/sources.json': 'bc88143efb61f2202ae37c96373e07a1643cc29b7fc9a38abc84e4958fe2b984',
    'data/survival/items/world_source_bindings.v3.json': '7b9670f4971d2f161138e0754cbbe66dfe2a239bf0d15d3079a766d729dd230b',
    'data/survival/recipes/recipes.json': '4dbf48da0dbb841bedd3333f0def33f328af4ed55c0e1f919b4a19cc3385539c',
    'data/survival/recipes/research.json': '6cca178ac00a99e4d2acfa441869331d325d9bb4d7d1637709b0692db5d512b2',
    'data/survival/recipes/stations.json': 'aa05487252b8064729252994954eb73007fe525d2201f8aa725065dd0ee01851',
    'data/survival/connector/a0_legacy/world_source_bindings.c23292be.v3.json': 'b1d291d035c9e543e69281da268b378c8e1bb498be561b2f15e67c840792b353',
    'game/survival/economy/vendor/a3_world_source_c23292be.gd': '689a9b89dba4d756387b6b5c5f09b54d90ff0a787395f5e2fb523da496836efe',
}

def read(path):
    return json.loads((ROOT / path).read_text())

def policy(bindings, treatment, route):
    source = {b['action_id']: b for b in bindings['bindings']}
    desired = {
        'cache_restock': ('si:r_ashen_crown:waystation_cache:01', [406, 202], 1800, {'iron_scrap': 3, 'knowledge_spares': 2}),
        'gather_deadfall': ('node_waystation_approach_deadfall', [398, 201], 300, {'oak_wood': 2}),
        'salvage_roadside_notes': ('si:r_ashen_crown:roadside_supply:01', [395, 220], 1800, {'research_notes': 1}),
        'salvage_roadside_supplies_02': ('si:r_ashen_crown:roadside_supply:02', [400, 217], 0, {'iron_scrap': 3, 'knowledge_spares': 2}),
        'salvage_roadside_timber_03': ('si:r_ashen_crown:roadside_supply:03', [402, 221], 0, {'oak_wood': 2, 'research_notes': 1}),
    }
    assert len(source) == len(bindings['bindings']) == len(desired)
    for name, (instance, stand, cooldown, items) in desired.items():
        b = source[name]
        assert b['instance_id'] == instance and b['stand_cells'] == [stand]
        assert b['cooldown_active_seconds'] == cooldown
        assert {r['item_id']: r['quantity'] for r in b['rewards']} == items
    assert source['cache_restock']['interaction_node_id'] == 'node_waystation_cache'
    assert source['cache_restock']['transaction_key_template'] == 'a1slice:poi_crown_waystation:cache_restock:{claim_index}'
    assert source['salvage_roadside_supplies_02']['max_claims'] == source['salvage_roadside_timber_03']['max_claims'] == 1
    for suffix, cell, frame, stand in [('01', [395,219], 'cache_notes', [395,220]), ('02', [400,216], 'cache_closed', [400,217]), ('03', [402,220], 'cache_closed', [402,221])]:
        instance = 'si:r_ashen_crown:roadside_supply:' + suffix
        props = [p for p in treatment['props'] if p.get('instance_id') == instance]
        assert len(props) == 1 and props[0]['cell'] == cell and props[0]['frame'] == frame and props[0]['collision_change'] is False
        assert stand in route['outbound_cells']
    actions = {a['action_id']: a for a in bindings['world_actions']}
    assert actions['pry_locker']['reward_items'] == actions['seal_ledger']['reward_items'] == []
    assert {c['item_id']: c['quantity'] for c in actions['hand_crank_bypass']['consumes_items']} == {'iron_scrap': 2, 'oak_wood': 1}
    return True

def main():
    for path, expected in PINS.items():
        assert sha256((ROOT / path).read_bytes()).hexdigest() == expected, path
    bindings = read('data/survival/items/world_source_bindings.v3.json')
    treatment = read('data/survival/world/art/compiled/crown_roadside_visual_treatment.presentation.v1.json')
    route = read('data/survival/world/corridor/first_hour_route.v1.json')
    assert policy(bindings, treatment, route)
    for mutate in (
        lambda b: b['bindings'][0]['rewards'][0].__setitem__('quantity', 4),
        lambda b: b['bindings'][0].__setitem__('interaction_node_id', 'foreign'),
        lambda b: b['bindings'][3].__setitem__('max_claims', 2),
    ):
        bad = deepcopy(bindings)
        mutate(bad)
        try:
            policy(bad, treatment, route)
        except AssertionError:
            continue
        raise AssertionError('negative mutation accepted')
    print('PASS: A3 V5 byte pins, A1 source/stand data and negative source-policy mutations (static only)')

if __name__ == '__main__':
    main()
