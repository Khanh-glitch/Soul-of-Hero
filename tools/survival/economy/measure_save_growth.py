#!/usr/bin/env python3
"""Measure serialized save-growth pressure from the deterministic A3 model.

This is a SERIALIZATION MODEL, not a native disk benchmark and not a human
playtest. It uses the actual SaveService receipt shape and the schema-2 A3
namespace shape to compare legacy duplicate command history with the compacted
receipt-only design. Native CI separately prints a 30-transaction micro-measure.
"""
from __future__ import annotations
import argparse, json, math, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/survival/economy'))
import simulate_economy as sim

def compact(value) -> int:
    return len(json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))

def receipt(index: int, operation: str = 'wear') -> dict:
    event = f'growth.event.{index:08d}'
    key = f'soh.a3.{operation}.{index:064x}'
    return key, {
        'applied_at_unix': 1790000000 + index,
        'metadata': {
            'kind': 'survival_economy',
            'operation': operation,
            'event_id': event,
            'payload_sha256': f'{index:064x}',
        },
    }

def instance_record(index: int) -> dict:
    token = f'soh_i_{index:012d}_{index & 0xffffffff:08x}'
    return token, {
        'instance_id': token, 'item_id': 'core_venom', 'location': 'consumed_by_research',
        'condition': 100, 'max_condition': 100, 'uses': 0, 'max_uses': 12,
        'revision': 3, 'origin': 'economy',
    }

def namespace(instance_count: int, legacy_commands: int = 0) -> dict:
    instances = dict(instance_record(i) for i in range(instance_count))
    commands = {f'soh.a3.wear.{i:064x}': f'{i:064x}' for i in range(legacy_commands)}
    return {
        'schema': 2, 'instances': instances, 'jobs': {}, 'technologies': {},
        'commands': commands, 'counter': instance_count,
        'time': {
            'latest_session_index': 14, 'session_id': 'growth-model-session', 'sequence': 1000,
            'stations': {f'station_{i}': {'active_ticks': 100000, 'station_revision': 'rev-1'} for i in range(7)},
        },
    }

def scenario(name: str, transactions: int, instances: int) -> dict:
    receipts = dict(receipt(i) for i in range(transactions))
    compact_doc = {'applied_transactions': receipts, 'survival_economy': namespace(instances)}
    legacy_doc = {'applied_transactions': receipts, 'survival_economy': namespace(instances, transactions)}
    compact_bytes = compact(compact_doc)
    legacy_bytes = compact(legacy_doc)
    return {
        'name': name, 'transactions': transactions, 'terminal_instance_records': instances,
        'schema2_compacted_bytes': compact_bytes,
        'legacy_duplicate_commands_bytes': legacy_bytes,
        'bytes_saved_by_compaction': legacy_bytes - compact_bytes,
        'average_bytes_per_transaction': round(compact_bytes / max(1, transactions), 2),
    }

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', type=pathlib.Path)
    args = ap.parse_args()
    model = sim.run(30, 14, 45)
    items = sim.load('items/items.json')['items']
    recipes = sim.load('recipes/recipes.json')['recipes']
    instance_crafted = 0
    for rid, count in model['crafted'].items():
        for iid, qty in recipes[rid]['outputs'].items():
            if items[iid]['storage'] == 'instance':
                instance_crafted += qty * count
    loot_instances = sum(model['loot_instances'].values())
    # One durable receipt per claim/enqueue/advance/collect/grant. This is an
    # explicit action-count model, not a claim that a player will do exactly this.
    transactions = (
        sum(model['claims'].values())
        + 3 * (sum(model['crafted'].values()) + sum(model['recipes_researched'].values()) + len(model['technologies_learned']))
        + loot_instances + instance_crafted
    )
    instances = loot_instances + instance_crafted
    scenarios = [
        scenario('a3_14_session_model', transactions, instances),
        scenario('sensitivity_10x_actions', transactions * 10, instances * 10),
        scenario('receipt_pressure_100k', 100000, instances),
    ]
    report = {
        'schema': 'soh.economy.save_growth.v1',
        'status': 'SERIALIZATION_MODEL_NOT_NATIVE_DISK_BENCHMARK',
        'gameplay_design_status': 'NOT_HUMAN_PLAYTESTED',
        'source_model': {'seed': 30, 'sessions': 14, 'minutes_per_session': 45,
                         'claims': sum(model['claims'].values()), 'crafted': sum(model['crafted'].values()),
                         'recipes_researched': sum(model['recipes_researched'].values()),
                         'technologies_learned': len(model['technologies_learned']),
                         'loot_instances': loot_instances, 'instance_crafted': instance_crafted},
        'scenarios': scenarios,
        'findings': [
            'Schema 2 stops growing survival_economy.commands; payload signatures live in SaveService receipt metadata.',
            'Collected jobs are erased from survival_economy.jobs; SaveService receipts remain the replay authority.',
            'Terminal instance records still grow with loot/manufacture history and need an A0 retention/archival policy if significant.',
            'applied_transactions is still unbounded in SaveService; A0 must define receipt retention/compaction without breaking replay safety.',
            'Time baselines are bounded to current session plus unresolved stations, capped at 256 station entries.',
        ],
        'unresolved': ['A0 receipt retention policy', 'A0 terminal-instance archival policy', 'native long-session disk/IO benchmark', 'human action frequency'],
    }
    if args.json:
        args.json.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
