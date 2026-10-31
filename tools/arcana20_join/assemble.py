#!/usr/bin/env python3
"""Assemble isolated JOIN QA from exact git objects; never checkout or merge.

A0 = historical independently passing normal-entry/restart pin, NOT latest.
A6/A1/A3 match A0's pinned A6 composition. A1/A3 are contract inputs for A6,
not a claim that their full production world/economy is mounted. CT's r4 and
soh_binding are copied verbatim, exclusively into the disposable directory.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PINS = {
    'a0': '62f6a32d08d319bfdcd28235786558f54f49b420',
    'a6': '6b801554a6af95424b4e39dd29f43c146aa13848',
    'a1_contract_inputs': '2cb1a3c5f093724eb9fecbdf45909ccb611f7b32',
    'a3_contract_inputs': '18e7afcbd576bbd9bfbcc509b2ee13216186a522',
    'pr30': 'e505173edd119fdd955cf6249511b575a5468440',
}


def extract(sha: str, out: Path, paths: list[str] | None = None) -> None:
    cmd = ['git', '-C', str(ROOT), 'archive', '--format=tar', sha]
    if paths:
        cmd.extend(paths)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    assert proc.stdout is not None
    try:
        with tarfile.open(fileobj=proc.stdout, mode='r|') as tar:
            for member in tar:
                path = Path(member.name)
                if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                    raise RuntimeError(f'unsafe archive member {member.name}')
                tar.extract(member, out)
    finally:
        proc.stdout.close()
    if proc.wait() != 0:
        raise RuntimeError(f'git archive failed for {sha} {paths}')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--avfx-sha', required=True)
    args = ap.parse_args()
    out = args.out.resolve()
    if out == ROOT or ROOT in out.parents or out.exists():
        raise SystemExit('out must be a nonexistent directory outside the repository')
    shas = dict(PINS, avfx=args.avfx_sha)
    for label, sha in shas.items():
        resolved = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--verify', sha + '^{commit}'], text=True).strip()
        if resolved != sha:
            raise SystemExit(f'{label}: use the exact 40-character SHA, got {sha} => {resolved}')
    out.mkdir(parents=True)
    extract(shas['a0'], out)
    extract(shas['a6'], out, ['game/survival/ui', 'tests/survival/ui'])
    extract(shas['pr30'], out, ['prototypes/arcana_fusion20/r4', 'prototypes/arcana_fusion20/soh_binding'])
    extract(shas['avfx'], out, ['prototypes/arcana_fusion20/renderer'])
    with tempfile.TemporaryDirectory(prefix='arcana20-inputs-') as tmp:
        t = Path(tmp)
        extract(shas['a1_contract_inputs'], t, ['data/survival/world/poi_route_graph.json', 'data/survival/world/hazard_capability_contracts.json', 'data/survival/world/material_source_contracts.json', 'data/survival/world/poi_authoring/poi_crown_waystation.v1.json', 'data/survival/world/poi_authoring/poi_crown_relay_shed.v1.json'])
        extract(shas['a3_contract_inputs'], t, ['game/survival/economy/economy_service.gd', 'data/survival/items/items.json', 'data/survival/recipes/recipes.json', 'data/survival/recipes/research.json', 'data/survival/recipes/stations.json'])
        for folder in ['world/poi_authoring', 'items', 'recipes', 'source']:
            (out / '.a6-contract-inputs' / ('a1/' if folder.startswith('world') else 'a3/') / folder).mkdir(parents=True, exist_ok=True)
        for f in ['poi_route_graph.json', 'hazard_capability_contracts.json', 'material_source_contracts.json']:
            shutil.copy2(t / 'data/survival/world' / f, out / '.a6-contract-inputs/a1/world' / f)
        for f in ['poi_crown_waystation.v1.json', 'poi_crown_relay_shed.v1.json']:
            shutil.copy2(t / 'data/survival/world/poi_authoring' / f, out / '.a6-contract-inputs/a1/world/poi_authoring' / f)
        for f in ['recipes.json', 'research.json', 'stations.json']:
            shutil.copy2(t / 'data/survival/recipes' / f, out / '.a6-contract-inputs/a3/recipes' / f)
        shutil.copy2(t / 'data/survival/items/items.json', out / '.a6-contract-inputs/a3/items/items.json')
        shutil.copy2(t / 'game/survival/economy/economy_service.gd', out / '.a6-contract-inputs/a3/source/economy_service.gd')
    manifest = {'shas': shas, 'scene': 'res://game/overworld/chapter1_overworld.tscn', 'entry': 'res://game/app/app_root.tscn via AppFlow', 'a0_normal_entry_reference_run': 41194096996, 'latest_observed_a0_not_tested': 'ee5f9f5160c8e4385f35a63b355ddda957f93d10', 'composition': 'isolated archive overlay, no merge; A1/A3 are read-only A6 inputs only', 'acceptance': 'UNVERIFIED'}
    (out / 'arcana20_join_manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
